import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

// Ticket page: perks this ticket unlocks. Show it at the counter; staff can tap Redeem (once per ticket).
interface Perk { id: string; name: string; address: string | null; perk: string; perk_details: string | null; redeemed_at: string | null }
export default function TicketPerks({ ticketId }: { ticketId: string }) {
  const [rows, setRows] = useState<Perk[]>([]);
  const load = useCallback(() => { supabase.rpc('ticket_perks', { p_ticket_id: ticketId }).then(({ data }) => setRows((data ?? []) as Perk[])); }, [ticketId]);
  useEffect(() => { load(); }, [load]);
  if (!rows.length) return null;
  async function redeem(p: Perk) {
    if (!window.confirm(`For ${p.name} staff: mark "${p.perk}" as used for this ticket? It can only be redeemed once.`)) return;
    const { error } = await supabase.rpc('redeem_perk', { p_ticket_id: ticketId, p_partner_id: p.id });
    if (error) window.alert(error.message && !/function|permission/i.test(error.message) ? error.message : "Couldn't redeem it.");
    load();
  }
  return (
    <section className="mt-6 rounded-2xl border border-[#C9A227]/50 bg-[#C9A227]/10 p-4 text-left">
      <p className="font-bold text-gray-900">🎁 Your ticket perks</p>
      <p className="text-sm text-gray-600">Show this screen at the counter.</p>
      <ul className="mt-3 flex flex-col gap-2">
        {rows.map((p) => (
          <li key={p.id} className="rounded-xl bg-white p-3">
            <p className="font-semibold text-gray-900">{p.perk}</p>
            <p className="text-sm text-gray-600">at <strong>{p.name}</strong>{p.address ? ` · ${p.address}` : ''}</p>
            {p.perk_details && <p className="mt-0.5 text-xs text-gray-500">{p.perk_details}</p>}
            {p.redeemed_at
              ? <p className="mt-2 text-sm font-semibold text-gray-500">✓ Redeemed {new Date(p.redeemed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
              : <div className="mt-2 flex flex-wrap items-center gap-2"><span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-800">Valid ✓</span><button onClick={() => redeem(p)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700">Staff: tap to redeem</button></div>}
          </li>
        ))}
      </ul>
    </section>
  );
}
