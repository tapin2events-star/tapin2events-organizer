import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

// Event page: perks from local partners for ticket holders (a reason to buy).
interface Partner { id: string; name: string; address: string | null; website: string | null; perk: string; perk_details: string | null; distance_m: number | null }
export default function EventPerks({ eventId }: { eventId: string }) {
  const [rows, setRows] = useState<Partner[]>([]);
  useEffect(() => { supabase.rpc('event_partners_list', { p_event_id: eventId }).then(({ data }) => setRows((data ?? []) as Partner[])); }, [eventId]);
  if (!rows.length) return null;
  return (
    <section className="mt-6 rounded-2xl border border-[#C9A227]/50 bg-[#C9A227]/10 p-4">
      <p className="font-display text-lg font-bold text-gray-900">🎁 Ticket-holder perks</p>
      <p className="text-sm text-gray-600">Your ticket unlocks {rows.length === 1 ? 'a perk' : `${rows.length} perks`} nearby. Just show your TapIN ticket.</p>
      <ul className="mt-3 flex flex-col gap-2">
        {rows.map((p) => (
          <li key={p.id} className="rounded-xl bg-white p-3">
            <p className="font-semibold text-gray-900">{p.perk}</p>
            <p className="text-sm text-gray-600">at <strong>{p.name}</strong>{p.distance_m != null ? ` · ${p.distance_m < 120 ? 'steps away' : `${Math.max(1, Math.round(p.distance_m / 80))} min walk`}` : ''}{p.address ? ` · ${p.address}` : ''}</p>
            {p.perk_details && <p className="mt-0.5 text-xs text-gray-500">{p.perk_details}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
