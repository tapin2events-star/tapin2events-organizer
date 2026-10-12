import { supabase } from './supabaseClient';

// Same math as the checkout: 3.7% service + 2.9% processing, plus $0.50 unless the gift
// rides on a payment that already includes paid tickets.
export function donationFee(amount: number, withPaidTickets: boolean) {
  const c = Math.round(amount * 100);
  return (Math.round(c * 0.037) + Math.round(c * 0.029) + (withPaidTickets ? 0 : 50)) / 100;
}
export const MIN_DONATION = 5;
export const money2 = (n: number) => `$${n.toFixed(2)}`;
export const money0 = (n: number) => `$${Number.isInteger(n) ? n.toLocaleString() : n.toFixed(2)}`;

export interface DonationSummary { raised: number; count: number; goal: number | null; donors: { name: string; message: string | null; at: string }[] }
export async function loadDonationSummary(eventId: string): Promise<DonationSummary | null> {
  const { data } = await supabase.rpc('donation_summary', { p_event_id: eventId });
  if (!data) return null;
  const d = data as DonationSummary;
  return { ...d, raised: Number(d.raised) || 0, goal: d.goal ? Number(d.goal) : null };
}
