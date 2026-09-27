import { supabase } from './supabaseClient';
import type { TapEvent } from './types';

// Earnings for an organizer's own events. Amounts are what the organizer
// earns: ticket and product prices, vendor fees, and tips. The service and
// processing fees buyers pay on top go to TapIN/Stripe and are excluded.

export type Range = 'month' | '30d' | 'year' | 'all';
export const RANGE_LABELS: Record<Range, string> = { month: 'This month', '30d': 'Last 30 days', year: 'This year', all: 'All time' };

interface OrderItem { type?: string; total_price?: number; unit_price?: number; quantity?: number; item_name?: string }
export interface OrderRow { id: string; order_number: string | null; event_id: string; items: OrderItem[] | null; subtotal: number | null; created_at: string; customer_name: string | null; customer_email: string | null }
export interface TicketRow { event_id: string; quantity: number | null; price_paid: number | null; status: string; created_at: string; checked_in_at: string | null }
export interface VendorFeeRow { event_id: string; agreed_fee: number | null; business_name: string | null; created_at: string }
export interface TipRow { amount: number; created_at: string; tipper_name: string | null }

export interface EarningsData { events: TapEvent[]; orders: OrderRow[]; tickets: TicketRow[]; vendorFees: VendorFeeRow[]; tips: TipRow[] }

// Supabase returns at most 1,000 rows per request; page through larger sets.
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await build(from, from + 999);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function loadEarnings(userId: string, email: string): Promise<EarningsData> {
  const { data: events } = await supabase.from('events').select('*').eq('organizer_id', userId).order('start_date', { ascending: false });
  const ids = (events ?? []).map((e) => e.id as string);
  const chunk = <T,>(arr: T[], n: number) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
  const idChunks = chunk(ids, 150); // keep request URLs a sane length
  const [orders, tickets, vendorFees, tips] = await Promise.all([
    Promise.all(idChunks.map((c) => fetchAll<OrderRow>((f, t) => supabase.from('orders').select('id, order_number, event_id, items, subtotal, created_at, customer_name, customer_email').in('event_id', c).eq('payment_status', 'paid').range(f, t)))).then((r) => r.flat()),
    Promise.all(idChunks.map((c) => fetchAll<TicketRow>((f, t) => supabase.from('tickets').select('event_id, quantity, price_paid, status, created_at, checked_in_at').in('event_id', c).in('status', ['confirmed', 'checked_in']).range(f, t)))).then((r) => r.flat()),
    Promise.all(idChunks.map((c) => fetchAll<VendorFeeRow>((f, t) => supabase.from('event_vendor_applications').select('event_id, agreed_fee, business_name, created_at').in('event_id', c).eq('status', 'paid').range(f, t)))).then((r) => r.flat()),
    fetchAll<TipRow>((f, t) => supabase.from('tips').select('amount, created_at, tipper_name').eq('creator_email', email).eq('payment_status', 'paid').range(f, t)),
  ]);
  return { events: (events ?? []) as TapEvent[], orders, tickets, vendorFees, tips };
}

const itemTotal = (i: OrderItem) => Number(i.total_price ?? (Number(i.unit_price ?? 0) * Number(i.quantity ?? 1))) || 0;
// The order subtotal (before buyer fees) is what the organizer earns. It can
// include shipping on product orders, so anything beyond the ticket items is
// counted as merchandise & shipping.
export const orderSplit = (o: OrderRow) => {
  const items = o.items ?? [];
  let tickets = 0, products = 0;
  for (const i of items) (i.type === 'product' ? (products += itemTotal(i)) : (tickets += itemTotal(i)));
  const subtotal = Number(o.subtotal);
  if (o.subtotal === null || !Number.isFinite(subtotal)) return { tickets, products };
  const hasProducts = items.some((i) => i.type === 'product');
  // No products: the whole subtotal is ticket sales. (Orders migrated from
  // the original app list ticket items without prices.)
  if (!hasProducts) return { tickets: subtotal, products: 0 };
  // Products with unpriced ticket items: tickets are whatever isn't products.
  if (tickets === 0 && items.some((i) => i.type !== 'product')) return { tickets: Math.max(subtotal - products, 0), products };
  // Otherwise anything beyond the tickets is merchandise, including shipping.
  return { tickets, products: Math.max(subtotal - tickets, 0) };
};

export function rangeStart(range: Range, now = new Date()): Date | null {
  if (range === 'all') return null;
  if (range === '30d') return new Date(now.getTime() - 30 * 86400000);
  if (range === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  return new Date(now.getFullYear(), 0, 1);
}
export const inRange = (iso: string, start: Date | null) => !start || new Date(iso) >= start;

export interface EventStats { ticketRevenue: number; productRevenue: number; vendorRevenue: number; ticketsSold: number; paidTickets: number; freeRegistrations: number; checkedIn: number }
const blank = (): EventStats => ({ ticketRevenue: 0, productRevenue: 0, vendorRevenue: 0, ticketsSold: 0, paidTickets: 0, freeRegistrations: 0, checkedIn: 0 });

export function summarize(d: EarningsData, range: Range) {
  const start = rangeStart(range);
  const byEvent = new Map<string, EventStats>();
  const get = (id: string) => byEvent.get(id) ?? (byEvent.set(id, blank()), byEvent.get(id)!);
  for (const o of d.orders) {
    if (!inRange(o.created_at, start)) continue;
    const s = orderSplit(o);
    get(o.event_id).ticketRevenue += s.tickets;
    get(o.event_id).productRevenue += s.products;
  }
  for (const t of d.tickets) {
    if (!inRange(t.created_at, start)) continue;
    const q = Number(t.quantity ?? 1) || 1;
    const st = get(t.event_id);
    st.ticketsSold += q;
    if (Number(t.price_paid ?? 0) > 0) st.paidTickets += q;
    else st.freeRegistrations += q;
    if (t.checked_in_at) st.checkedIn += q;
  }
  for (const v of d.vendorFees) if (inRange(v.created_at, start)) get(v.event_id).vendorRevenue += Number(v.agreed_fee ?? 0);
  const tips = d.tips.filter((t) => inRange(t.created_at, start)).reduce((n, t) => n + Number(t.amount ?? 0), 0);

  const totals = blank();
  byEvent.forEach((s) => (Object.keys(totals) as (keyof EventStats)[]).forEach((k) => (totals[k] += s[k])));
  // Check-in rate only counts events that have already started.
  const now = Date.now();
  let startedTickets = 0, startedCheckins = 0;
  for (const e of d.events) {
    if (!e.start_date || new Date(e.start_date).getTime() > now) continue;
    const s = byEvent.get(e.id);
    if (s) { startedTickets += s.ticketsSold; startedCheckins += s.checkedIn; }
  }
  const earned = totals.ticketRevenue + totals.productRevenue + totals.vendorRevenue + tips;
  return { byEvent, totals, tips, earned, checkInRate: startedTickets ? startedCheckins / startedTickets : null };
}

/** Earnings per month for the last 12 months (oldest first). */
export function monthly(d: EarningsData) {
  const now = new Date();
  const months = Array.from({ length: 12 }, (_, i) => {
    const m = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    return { key: `${m.getFullYear()}-${m.getMonth()}`, label: m.toLocaleDateString('en-US', { month: 'short' }), year: m.getFullYear(), total: 0 };
  });
  const add = (iso: string, amount: number) => {
    const dt = new Date(iso);
    const m = months.find((x) => x.key === `${dt.getFullYear()}-${dt.getMonth()}`);
    if (m) m.total += amount;
  };
  d.orders.forEach((o) => { const s = orderSplit(o); add(o.created_at, s.tickets + s.products); });
  d.vendorFees.forEach((v) => add(v.created_at, Number(v.agreed_fee ?? 0)));
  d.tips.forEach((t) => add(t.created_at, Number(t.amount ?? 0)));
  return months;
}

export const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });


export function earningsRows(d: EarningsData, range: Range): (string | number)[][] {
  const start = rangeStart(range);
  const title = new Map(d.events.map((e) => [e.id, e.title]));
  const rows: (string | number)[][] = [['Date', 'Type', 'Event', 'Reference', 'From', 'Tickets', 'Merchandise & shipping', 'Vendor fees', 'Tips', 'Total earned']];
  const date = (iso: string) => new Date(iso).toLocaleDateString('en-US');
  for (const o of d.orders.filter((o) => inRange(o.created_at, start))) {
    const s = orderSplit(o);
    rows.push([date(o.created_at), 'Order', title.get(o.event_id) ?? '', o.order_number ?? o.id, o.customer_name || o.customer_email || '', s.tickets.toFixed(2), s.products.toFixed(2), '0.00', '0.00', (s.tickets + s.products).toFixed(2)]);
  }
  for (const v of d.vendorFees.filter((v) => inRange(v.created_at, start))) {
    const fee = Number(v.agreed_fee ?? 0);
    rows.push([date(v.created_at), 'Vendor fee', title.get(v.event_id) ?? '', '', v.business_name ?? '', '0.00', '0.00', fee.toFixed(2), '0.00', fee.toFixed(2)]);
  }
  for (const t of d.tips.filter((t) => inRange(t.created_at, start))) {
    const amt = Number(t.amount ?? 0);
    rows.push([date(t.created_at), 'Tip', '', '', t.tipper_name ?? '', '0.00', '0.00', '0.00', amt.toFixed(2), amt.toFixed(2)]);
  }
  return rows;
}
