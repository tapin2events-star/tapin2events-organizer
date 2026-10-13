import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';

interface Status { enabled: boolean; can_join: boolean; can_manage: boolean; members: number; requests: number; me: object | null }

// Event page (Preview): invite people going to join the networking list.
export function NetworkingInvite({ eventId }: { eventId: string }) {
  const { user } = useAuth();
  const [s, setS] = useState<Status | null>(null);
  useEffect(() => { if (user) supabase.rpc('networking_status', { p_event_id: eventId }).then(({ data }) => setS((data ?? null) as Status | null)); }, [eventId, user]);
  if (!s?.enabled || !(s.can_join || s.can_manage)) return null;
  return (
    <Link to={`/events/${eventId}/network`} className="mt-6 flex items-center gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 hover:border-indigo-400">
      <span className="text-2xl" aria-hidden="true">🤝</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-gray-900">{s.me ? 'Networking' : 'Meet other attendees'}</span>
        <span className="block text-sm text-gray-600">
          {s.me ? `${s.members} on the list${s.requests ? ` · ${s.requests} new request${s.requests === 1 ? '' : 's'}` : ''}` : `${s.members ? `${s.members} people have joined. ` : ''}Add a quick card and connect before the event.`}
        </span>
      </span>
      <span className="shrink-0 text-sm font-semibold text-indigo-700">{s.me ? 'Open ›' : 'Join ›'}</span>
    </Link>
  );
}

// Event dashboard (Preview): organizer switch.
export function NetworkingSwitch({ eventId }: { eventId: string }) {
  const [s, setS] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => supabase.rpc('networking_status', { p_event_id: eventId }).then(({ data }) => setS((data ?? null) as Status | null));
  useEffect(() => { load(); }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!s) return null;
  async function toggle(on: boolean) {
    setBusy(true);
    await supabase.rpc('set_event_networking', { p_event_id: eventId, p_enabled: on });
    setBusy(false); load();
  }
  return (
    <div className="mb-6 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4">
      <label className="flex items-start gap-3">
        <input type="checkbox" checked={s.enabled} disabled={busy} onChange={(e) => toggle(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-marigold" />
        <span>
          <span className="flex items-center gap-2 font-semibold text-bone">🤝 Attendee networking <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700">Preview</span></span>
          <span className="block text-sm text-muted">People with tickets can add a networking card (title, company, what they're looking for) and connect with each other before the event. Contact info is shared only when both connect.</span>
        </span>
      </label>
      {s.enabled && <p className="mt-2 pl-8 text-sm text-muted">{s.members} {s.members === 1 ? 'person has' : 'people have'} joined · <Link to={`/events/${eventId}/network`} className="font-medium text-marigold">Open the directory ›</Link></p>}
    </div>
  );
}
