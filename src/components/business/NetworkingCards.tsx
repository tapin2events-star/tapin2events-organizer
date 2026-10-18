import { useEffect, useState } from 'react';
import PremiumBadge, { PremiumNotice } from './PremiumBadge';
import ShareQR from '../ShareQR';
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

// Event dashboard Overview (Preview): networking switch, stats, announce, and a venue QR poster.
export function NetworkingSwitch({ eventId, eventTitle }: { eventId: string; eventTitle?: string }) {
  const [s, setS] = useState<{ enabled: boolean; members: number; connections: number; pending: number; ticket_holders: number; announced_at: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const load = () => supabase.rpc('networking_stats', { p_event_id: eventId }).then(({ data }) => setS((data ?? null) as typeof s));
  useEffect(() => { load(); }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!s) return null;
  async function toggle(on: boolean) {
    setBusy(true);
    await supabase.rpc('set_event_networking', { p_event_id: eventId, p_enabled: on });
    setBusy(false); load();
  }
  async function announce() {
    if (!window.confirm('Let ticket holders who haven\u2019t joined yet know networking is open? They get a notification and an email.')) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('announce_networking', { p_event_id: eventId });
    setBusy(false);
    setMsg(error ? (error.message && !/function|permission/i.test(error.message) ? error.message : "Couldn't send.") : `Sent to ${data} ${data === 1 ? 'person' : 'people'}.`);
    setTimeout(() => setMsg(null), 4000);
    load();
  }
  const announcedRecently = !!s.announced_at && Date.now() - new Date(s.announced_at).getTime() < 86400000;
  return (
    <div className="mb-6 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4">
      <label className="flex items-start gap-3">
        <input type="checkbox" checked={s.enabled} disabled={busy} onChange={(e) => toggle(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-marigold" />
        <span>
          <span className="flex items-center gap-2 font-semibold text-bone">🤝 Attendee networking <PremiumBadge feature="networking" /></span>
          <PremiumNotice feature="Attendee networking" featureKey="networking" />
          <span className="mt-1 block text-sm text-muted">Ticket holders add a networking card and connect before and during the event. Contact info is shared only when both connect.</span>
        </span>
      </label>
      {s.enabled && (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-white p-2"><p className="text-xl font-extrabold text-bone">{s.members}</p><p className="text-[11px] text-muted">joined of {s.ticket_holders}</p></div>
            <div className="rounded-xl bg-white p-2"><p className="text-xl font-extrabold text-bone">{s.connections}</p><p className="text-[11px] text-muted">connections</p></div>
            <div className="rounded-xl bg-white p-2"><p className="text-xl font-extrabold text-bone">{s.pending}</p><p className="text-[11px] text-muted">pending requests</p></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={announce} disabled={busy || announcedRecently} className="rounded-xl bg-marigold px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">📣 {announcedRecently ? 'Announced today' : 'Announce networking'}</button>
            <ShareQR path={`/events/${eventId}/network`} title={eventTitle ? `Network at ${eventTitle}` : 'Network with attendees'} subtitle="Scan to meet people at this event" label="Venue QR poster"
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700" />
            <Link to={`/events/${eventId}/network`} className="inline-flex items-center rounded-xl px-3 py-2 text-sm font-medium text-marigold">Open the directory ›</Link>
          </div>
          {msg && <p role="status" className="mt-2 text-sm text-green-700">{msg}</p>}
          <p className="mt-2 text-xs text-muted">Ticket holders also get a reminder the day before the event.</p>
        </>
      )}
    </div>
  );
}
