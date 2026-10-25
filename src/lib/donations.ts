import { supabase } from './supabaseClient';

// Gifts always reach the organizer in full: only Stripe's card processing is added on top (same math as the
// checkout services). With paid tickets or merch in the same payment: 2.9% of the gift (the ticket fees already
// cover Stripe's $0.30). On their own: 2.9% + $0.30 of the whole payment (gift + optional tip), grossed up.
export function donationFee(amount: number, withPaidTickets: boolean, tip = 0) {
  const c = Math.round(amount * 100);
  const t = Math.round(tip * 100);
  return (withPaidTickets ? Math.round(c * 0.029) : Math.ceil((c + t + 30) / (1 - 0.029)) - c - t) / 100;
}
// Optional tip to TapIN on standalone gifts (keeps TapIN free for organizers).
export const TIP_CHOICES = [0, 0.05, 0.1, 0.15];
export const DEFAULT_TIP = 0; // No tip unless the donor chooses one
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
