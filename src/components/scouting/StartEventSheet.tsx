import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import Sheet from './Sheet';

// Turn a scouting board's ideas into a draft event, with those prospects as its scouting list.
export default function StartEventSheet({ boardId, boardName, shows, onClose }: { boardId: string; boardName: string; shows: { id: string; name: string; target_date: string | null; event_id: string | null }[]; onClose: () => void }) {
  const navigate = useNavigate();
  const open = shows.filter((s) => !s.event_id);
  const [showId, setShowId] = useState<string>(open[0]?.id ?? '');
  const chosen = open.find((s) => s.id === showId) ?? null;
  const [title, setTitle] = useState(chosen?.name ?? boardName);
  const [date, setDate] = useState(chosen?.target_date ?? '');
  const [busy, setBusy] = useState(false);
  const [hostOrgs, setHostOrgs] = useState<{ id: string; name: string }[]>([]);
  const [host, setHost] = useState('');
  useEffect(() => {
    supabase.rpc('my_organizations').then(({ data }) => setHostOrgs(((data ?? []) as { id: string; name: string; role: string; status?: string }[]).filter((o) => o.status !== 'deleted' && (o.role === 'owner' || o.role === 'admin'))));
  }, []);
  const [err, setErr] = useState<string | null>(null);
  const field = 'mt-1 block w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900';
  async function go() {
    setBusy(true); setErr(null);
    const { data, error } = await supabase.rpc('start_event_from_board', { p_board_id: boardId, p_show_id: showId || null, p_title: title.trim() || null, p_date: date || null, p_org_id: host || null });
    setBusy(false);
    if (error || !data) return setErr(error?.message && !/function|permission/i.test(error.message) ? error.message : "Couldn't start the event.");
    navigate(`/organizer/events/${data}/edit`);
  }
  return (
    <Sheet title="Start an event" onClose={onClose}>
      <p className="-mt-2 text-sm text-gray-600">Creates a draft event (only you can see it). Its scouting list starts with these prospects, so you can send lineup invites right away.</p>
      <label className="mt-3 block text-xs font-medium text-gray-500">Prospects from
        <select value={showId} onChange={(e) => { setShowId(e.target.value); const s = open.find((x) => x.id === e.target.value); if (s) { setTitle(s.name); setDate(s.target_date ?? ''); } }} className={field}>
          {open.map((s) => <option key={s.id} value={s.id}>{s.name}{s.target_date ? ` (${new Date(s.target_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})` : ''}</option>)}
          <option value="">Prospects not assigned to a show</option>
        </select>
      </label>
      <label className="mt-3 block text-xs font-medium text-gray-500">Event name<input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} className={field} /></label>
      <label className="mt-3 block text-xs font-medium text-gray-500">Date (optional)<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} /></label>
      {hostOrgs.length > 0 && (
        <label className="mt-3 block text-xs font-medium text-gray-500">Host as
          <select value={host} onChange={(e) => setHost(e.target.value)} className={field}>
            <option value="">Me</option>
            {hostOrgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          {host && <span className="mt-1 block font-normal text-gray-500">The organization's team is added with their roles.</span>}
        </label>
      )}
      <p className="mt-2 text-xs text-gray-500">You'll add the details, time, location and tickets next.</p>
      {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
      <button onClick={go} disabled={busy} className="mt-4 w-full rounded-xl bg-marigold py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Creating…' : 'Create draft event'}</button>
    </Sheet>
  );
}
