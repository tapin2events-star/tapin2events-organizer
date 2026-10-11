import { supabase } from './supabaseClient';
import { rangeStart, type Range } from './earnings';

export interface BookingEarning { booking_id: string; event_id: string | null; event_title: string | null; event_date: string | null; organizer_name: string | null; source: 'individual' | 'group'; group_name: string | null; amount: number; refunded: number; status: 'paid' | 'refunded' | 'upcoming'; paid_at: string | null }
export interface BookingCost { booking_id: string; event_id: string | null; event_title: string | null; event_date: string | null; resource_name: string | null; price: number; fees: number; refunded: number; status: string; paid_at: string | null }

export async function loadBookingMoney() {
  const [{ data: e }, { data: c }] = await Promise.all([supabase.rpc('my_booking_earnings'), supabase.rpc('my_booking_costs')]);
  const num = (x: unknown) => Number(x) || 0;
  return {
    earnings: ((e ?? []) as BookingEarning[]).map((r) => ({ ...r, amount: num(r.amount), refunded: num(r.refunded) })),
    costs: ((c ?? []) as BookingCost[]).map((r) => ({ ...r, price: num(r.price), fees: num(r.fees), refunded: num(r.refunded) })),
  };
}

const within = (iso: string | null, range: Range) => {
  const start = rangeStart(range);
  return !start || (!!iso && new Date(iso) >= start);
};

export function summarizeBookings(earnings: BookingEarning[], costs: BookingCost[], range: Range) {
  const paid = earnings.filter((r) => r.status !== 'upcoming' && within(r.paid_at, range));
  const earned = paid.reduce((n, r) => n + r.amount - r.refunded, 0);
  const upcoming = earnings.filter((r) => r.status === 'upcoming');
  const upcomingTotal = upcoming.reduce((n, r) => n + r.amount, 0);
  const costRows = costs.filter((r) => within(r.paid_at, range));
  const costTotal = costRows.reduce((n, r) => n + r.price + r.fees - r.refunded, 0);
  const costByEvent = new Map<string, number>();
  costRows.forEach((r) => { if (r.event_id) costByEvent.set(r.event_id, (costByEvent.get(r.event_id) ?? 0) + r.price + r.fees - r.refunded); });
  return { paid, earned, paidCount: paid.filter((r) => r.status === 'paid').length, upcoming, upcomingTotal, costRows, costTotal, costByEvent };
}
