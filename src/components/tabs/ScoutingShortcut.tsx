import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useEventScouting } from '../../lib/useEventScouting';

// In Lineup & schedule: prospects scouted for this event who aren't booked or invited
// yet, each with a one-tap free lineup invite.
export default function ScoutingShortcut({ eventId, organizerEmail, takenResourceIds, onSent }: {
  eventId: string; organizerEmail: string; takenResourceIds: Set<string>; onSent: () => void;
}) {
  const { cards, resources, load } = useEventScouting(eventId);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const ready = cards.filter((c) => c.resource_id && !c.booking_id && !takenResourceIds.has(c.resource_id) && c.stage !== 'passed' && c.stage !== 'confirmed')
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  if (!ready.length) return null;

  async function invite(resourceId: string, name: string) {
    setBusy(resourceId); setMsg(null);
    const { error } = await supabase.from('resource_bookings').insert({
      resource_id: resourceId, resource_email: 'set-by-server', organizer_email: organizerEmail, event_id: eventId, offered_rate: 0, kind: 'lineup_invite', booking_details: {},
    });
    setBusy(null);
    setMsg(error ? `Couldn't invite ${name}. Please try again.` : `Lineup invite sent to ${name}.`);
    load(); onSent();
  }

  return (
    <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50/60 p-3">
      <p className="text-sm font-medium text-gray-900">From your scouting board</p>
      <p className="text-xs text-gray-500">Prospects you scouted for this event who aren't on the lineup yet.</p>
      <ul className="mt-2 flex flex-col gap-2">
        {ready.map((c) => {
          const r = resources.get(c.resource_id!);
          const name = r?.display_name ?? 'Artist';
          return (
            <li key={c.id} className="flex items-center gap-3 rounded-lg bg-white p-2">
              {r?.profile_image ? <img src={r.profile_image} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-200 text-sm font-bold text-gray-600">{name.charAt(0)}</span>}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-gray-900">{name}{c.rating ? <span className="ml-1 text-xs text-amber-500">{'★'.repeat(c.rating)}</span> : null}</span>
                {c.notes && <span className="block truncate text-xs text-gray-500">{c.notes}</span>}
              </span>
              <button type="button" disabled={busy === c.resource_id} onClick={() => invite(c.resource_id!, name)} className="shrink-0 rounded-lg bg-marigold px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Send invite</button>
            </li>
          );
        })}
      </ul>
      {msg && <p className="mt-2 text-xs text-gray-600">{msg}</p>}
    </div>
  );
}
