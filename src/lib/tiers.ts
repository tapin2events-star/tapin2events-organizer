import { supabase } from './supabaseClient';

export interface TierAvail { id: string; name: string; description: string | null; price: number; quantity: number | null; sold: number; remaining: number | null; max_per_order: number; sales_start: string | null; sales_end: string | null; status: 'on_sale' | 'sold_out' | 'not_started' | 'ended'; sort_order: number }

export async function loadTiers(eventId: string): Promise<TierAvail[]> {
  const { data } = await supabase.rpc('tier_availability', { p_event_id: eventId });
  return ((data ?? []) as TierAvail[]).map((t) => ({ ...t, price: Number(t.price), sold: Number(t.sold) }));
}
