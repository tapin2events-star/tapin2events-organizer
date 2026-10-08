import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

interface Found { id: string; display_name: string; profile_image: string | null; kind: string | null; categories: string[] | null; city: string | null }
export interface PendingInvite { id: string; resource_id: string; resource_name: string; resource_image: string | null; role: string | null }

// "Add from TapIN": find an artist, resource or group and send them a free lineup invite.
// They appear on the public lineup only after they accept.
export default function LineupInvite({ eventId, organizerEmail, existingResourceIds, onSent, onClose }: {
  eventId: string; organizerEmail: string; existingResourceIds: Set<string>; onSent: () => void; onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Found[]>([]);
  const [picked, setPicked] = useState<Found | null>(null);
  const [role, setRole] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const term = q.trim().replace(/[%_,()]/g, ' ');
    if (term.length < 2) { setResults([]); return; }
    const t = window.setTimeout(async () => {
      const { data } = await supabase.from('resources').select('id, display_name, profile_image, kind, categories, city')
        .eq('status', 'active').neq('verification_status', 'rejected').ilike('display_name', `%${term}%`).order('display_name').limit(8);
      setResults((data ?? []) as Found[]);
    }, 250);
    return () => window.clearTimeout(t);
  }, [q]);

  async function send() {
    if (!picked) return;
    setBusy(true); setError(null);
    const { error: e } = await supabase.from('resource_bookings').insert({
      resource_id: picked.id, resource_email: 'set-by-server', organizer_email: organizerEmail, event_id: eventId,
      offered_rate: 0, kind: 'lineup_invite', message_from_organizer: note.trim().slice(0, 600) || null,
      booking_details: role.trim() ? { lineup_role: role.trim().slice(0, 80) } : {},
    });
    setBusy(false);
    if (e) return setError(/already have an open booking/i.test(e.message) ? `${picked.display_name} already has an open invite or booking for this event.` : "Couldn't send the invite. Please try again.");
    onSent();
  }

  const input = 'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900';
  return (
    <div className="mt-3 flex flex-col gap-3 rounded-xl border border-marigold/40 bg-marigold/5 p-3">
      {!picked ? (
        <>
          <label className="text-sm font-medium text-gray-700">Find an artist, resource, or group
            <input className={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name" autoFocus />
          </label>
          {results.length > 0 && (
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
              {results.map((r) => {
                const taken = existingResourceIds.has(r.id);
                return (
                  <li key={r.id}>
                    <button type="button" disabled={taken} onClick={() => setPicked(r)} className="flex w-full items-center gap-3 p-2 text-left hover:bg-gray-50 disabled:opacity-50">
                      {r.profile_image ? <img src={r.profile_image} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 font-bold text-gray-600">{r.display_name.charAt(0)}</span>}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-gray-900">{r.display_name}{r.kind === 'group' && <span className="ml-1.5 rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-800">Group</span>}</span>
                        <span className="block truncate text-xs text-gray-500">{[...(r.categories ?? []).slice(0, 2), r.city].filter(Boolean).join(' · ')}</span>
                      </span>
                      {taken && <span className="text-xs text-gray-400">Already added</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {q.trim().length >= 2 && results.length === 0 && <p className="text-sm text-gray-500">No one on TapIN matches that name. You can add them by hand with "+ Add someone".</p>}
          <button type="button" onClick={onClose} className="self-start text-sm text-gray-500">Cancel</button>
        </>
      ) : (
        <>
          <div className="flex items-center gap-3">
            {picked.profile_image ? <img src={picked.profile_image} alt="" className="h-11 w-11 rounded-full object-cover" /> : <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-200 font-bold text-gray-600">{picked.display_name.charAt(0)}</span>}
            <div className="min-w-0 flex-1"><p className="truncate font-medium text-gray-900">{picked.display_name}</p><button type="button" onClick={() => setPicked(null)} className="text-xs text-marigold">Choose someone else</button></div>
          </div>
          <label className="text-sm font-medium text-gray-700">Role <span className="font-normal text-gray-400">(optional)</span>
            <input className={input} value={role} maxLength={80} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Featured poet, Guest DJ, Host" />
          </label>
          <label className="text-sm font-medium text-gray-700">Note to them <span className="font-normal text-gray-400">(optional)</span>
            <textarea className={input} rows={2} maxLength={600} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Set time, what you'd love them to do, anything they should know" />
          </label>
          <p className="text-xs text-gray-500">This is a free listing, not a paid booking. {picked.display_name} gets an invite to accept or decline. They won't show on your public lineup until they accept. To pay them, send a booking from their profile instead.</p>
          {error && <p role="alert" className="text-sm text-magenta">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={send} disabled={busy} className="rounded-lg bg-marigold px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Sending…' : 'Send lineup invite'}</button>
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700">Cancel</button>
          </div>
        </>
      )}
    </div>
  );
}
