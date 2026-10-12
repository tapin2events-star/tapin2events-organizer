import { supabase } from './supabaseClient';

export interface TierAvail { id: string; name: string; description: string | null; price: number; quantity: number | null; sold: number; remaining: number | null; max_per_order: number; sales_start: string | null; sales_end: string | null; status: 'on_sale' | 'sold_out' | 'not_started' | 'ended'; sort_order: number }

export async function loadTiers(eventId: string): Promise<TierAvail[]> {
  const { data } = await supabase.rpc('tier_availability', { p_event_id: eventId });
  return ((data ?? []) as TierAvail[]).map((t) => ({ ...t, price: Number(t.price), sold: Number(t.sold) }));
}

// ---- Editing tiers inside the event form ----
export interface TierDraft { key: string; id?: string; name: string; price: string; quantity: string; sales_start: string; sales_end: string; max_per_order: string; description: string; active: boolean }

const toLocal = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso); const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const newDraft = (name = '', price = ''): TierDraft => ({ key: Math.random().toString(36).slice(2), name, price, quantity: '', sales_start: '', sales_end: '', max_per_order: '10', description: '', active: true });

// Existing tiers for an event (all, including hidden), plus how many each has sold.
export async function loadTierDrafts(eventId: string): Promise<{ drafts: TierDraft[]; sold: Record<string, number> }> {
  const [{ data }, { data: t }] = await Promise.all([
    supabase.from('event_ticket_tiers').select('*').eq('event_id', eventId).order('sort_order').order('price').order('created_at'),
    supabase.from('tickets').select('tier_id, quantity').eq('event_id', eventId).in('status', ['confirmed', 'used']).not('tier_id', 'is', null),
  ]);
  const sold: Record<string, number> = {};
  (t ?? []).forEach((r) => { sold[r.tier_id as string] = (sold[r.tier_id as string] ?? 0) + Math.max(Number(r.quantity) || 1, 1); });
  const drafts = (data ?? []).map((r) => ({
    key: r.id, id: r.id, name: r.name, price: Number(r.price) ? String(Number(r.price)) : '', quantity: r.quantity ? String(r.quantity) : '',
    sales_start: toLocal(r.sales_start), sales_end: toLocal(r.sales_end), max_per_order: String(r.max_per_order ?? 10), description: r.description ?? '', active: r.active,
  }));
  return { drafts, sold };
}

// Problems to fix before saving (empty list = fine).
export function tierProblems(drafts: TierDraft[], sold: Record<string, number>): string[] {
  const out: string[] = [];
  const live = drafts.filter((d) => d.active);
  if (live.length === 0) out.push('Add at least one ticket type, or turn off multiple ticket types.');
  drafts.forEach((d, i) => {
    const label = d.name.trim() || `Ticket type ${i + 1}`;
    if (!d.name.trim()) out.push(`Ticket type ${i + 1} needs a name.`);
    const p = d.price === '' ? 0 : Number(d.price);
    if (!Number.isFinite(p) || p < 0 || p > 10000) out.push(`${label}: price must be between $0 and $10,000.`);
    if (d.quantity && parseInt(d.quantity, 10) < 1) out.push(`${label}: quantity must be at least 1 (or blank for no limit).`);
    if (d.id && d.quantity && parseInt(d.quantity, 10) < (sold[d.id] ?? 0)) out.push(`${label}: ${sold[d.id]} already sold, so the quantity can't be lower.`);
    if (d.sales_start && d.sales_end && d.sales_end <= d.sales_start) out.push(`${label}: sales must end after they start.`);
  });
  return out;
}

// Save the form's tiers: add new ones, update changed ones; removed tiers are deleted,
// or hidden if they've already sold tickets. enabled=false hides every tier.
export async function saveTierDrafts(eventId: string, drafts: TierDraft[], originalIds: string[], sold: Record<string, number>, enabled: boolean) {
  if (!enabled) {
    if (originalIds.length) await supabase.from('event_ticket_tiers').update({ active: false }).in('id', originalIds);
    return null;
  }
  const keep = new Set(drafts.filter((d) => d.id).map((d) => d.id as string));
  for (const id of originalIds.filter((x) => !keep.has(x))) {
    if ((sold[id] ?? 0) > 0) await supabase.from('event_ticket_tiers').update({ active: false }).eq('id', id);
    else await supabase.from('event_ticket_tiers').delete().eq('id', id);
  }
  for (const [i, d] of drafts.entries()) {
    const row = {
      event_id: eventId, name: d.name.trim(), description: d.description.trim() || null,
      price: Math.round((d.price === '' ? 0 : Number(d.price)) * 100) / 100,
      quantity: d.quantity ? parseInt(d.quantity, 10) : null,
      sales_start: d.sales_start ? new Date(d.sales_start).toISOString() : null,
      sales_end: d.sales_end ? new Date(d.sales_end).toISOString() : null,
      max_per_order: Math.min(50, Math.max(1, parseInt(d.max_per_order, 10) || 10)),
      active: d.active, sort_order: i,
    };
    const { error } = d.id ? await supabase.from('event_ticket_tiers').update(row).eq('id', d.id) : await supabase.from('event_ticket_tiers').insert(row);
    if (error) return `Couldn't save "${row.name}".`;
  }
  return null;
}
