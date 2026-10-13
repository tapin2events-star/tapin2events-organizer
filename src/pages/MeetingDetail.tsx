import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import BackButton from '../components/BackButton';
import { MeetingSheet } from '../components/planning/MeetingSheets';
import PlanningTaskSheet from '../components/planning/PlanningTaskSheet';
import { downloadIcs, googleCalendarUrl, meetingWhen } from '../lib/meetings';

interface Detail {
  id: string; title: string; starts_at: string; ends_at: string | null; location: string | null; video_url: string | null; agenda: string | null; notes: string | null;
  status: 'scheduled' | 'cancelled'; created_by: string; creator_name: string | null; event_id: string | null; event_title: string | null;
  organization_id: string | null; org_name: string | null; org_slug: string | null; can_manage: boolean; my_rsvp: 'pending' | 'going' | 'maybe' | 'no' | null;
  invitees: { email: string; rsvp: string; full_name: string | null; photo: string | null }[] | null;
  action_items: { id: string; title: string; status: string; assigned_to: string | null; due_date: string | null; event_id: string }[] | null;
}
const RSVP = { going: ['Going', 'bg-green-600'], maybe: ['Maybe', 'bg-amber-500'], no: ["Can't make it", 'bg-gray-700'] } as const;
const decode = (t: string) => t.replace(/&#8217;|&rsquo;/g, '\u2019').replace(/&amp;/g, '&');

export default function MeetingDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [m, setM] = useState<Detail | null | undefined>(undefined);
  const [agenda, setAgenda] = useState('');
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskEvents, setTaskEvents] = useState<{ id: string; title: string; start_date: string | null }[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('meeting_detail', { p_meeting_id: id });
    const d = (data ?? null) as Detail | null;
    setM(d);
    if (d) { setAgenda(d.agenda ?? ''); setNotes(d.notes ?? ''); }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  // Events this person can add action items to (the meeting's event, or the organization's events).
  useEffect(() => {
    supabase.rpc('planning_overview').then(({ data }) => {
      const list = ((data ?? []) as { id: string; title: string; start_date: string | null; my_role: string | null; is_owner: boolean; organization_id: string | null }[])
        .filter((e) => e.is_owner || ['owner', 'admin', 'editor'].includes(e.my_role ?? ''))
        .filter((e) => !m || (m.event_id ? e.id === m.event_id : m.organization_id ? e.organization_id === m.organization_id : true));
      setTaskEvents(list.map((e) => ({ id: e.id, title: e.title, start_date: e.start_date })));
    });
  }, [m?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (m === undefined) return <div className="mx-auto max-w-3xl"><div className="h-40 animate-pulse rounded-2xl bg-gray-100" /></div>;
  if (m === null) return <div className="mx-auto max-w-3xl"><BackButton fallback="/organizer/planning#meetings" fallbackLabel="Planning" /><p className="mt-4 text-muted">This meeting doesn't exist or you're not invited.</p></div>;

  const past = new Date(m.ends_at || m.starts_at).getTime() < Date.now();
  const going = (m.invitees ?? []).filter((i) => i.rsvp === 'going').length;
  async function rsvp(v: 'going' | 'maybe' | 'no') { await supabase.rpc('rsvp_meeting', { p_meeting_id: m!.id, p_rsvp: v }); load(); }
  async function saveText() {
    const { error } = await supabase.rpc('save_meeting_notes', { p_meeting_id: m!.id, p_agenda: agenda, p_notes: notes });
    setSaved(error ? "Couldn't save." : 'Saved.'); setTimeout(() => setSaved(null), 2000);
  }
  async function cancel() {
    if (!window.confirm('Cancel this meeting? Everyone invited will be told.')) return;
    await supabase.rpc('cancel_meeting', { p_meeting_id: m!.id }); load();
  }
  async function toggleItem(t: { id: string; status: string }) {
    await supabase.from('event_tasks').update({ status: t.status === 'completed' ? 'todo' : 'completed' }).eq('id', t.id); load();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <BackButton fallback="/organizer/planning#meetings" fallbackLabel="Planning" />
      <div className="mt-3 rounded-2xl border border-gray-200 bg-surface p-4 sm:p-5">
        {m.status === 'cancelled' && <p className="mb-3 rounded-xl bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700">This meeting was cancelled.</p>}
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{[m.org_name, m.event_title && decode(m.event_title)].filter(Boolean).join(' · ') || 'Meeting'}</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold text-bone sm:text-3xl">{m.title}</h1>
        <p className="mt-2 text-sm text-bone">🗓️ <strong>{meetingWhen(m.starts_at, true)}</strong>{m.ends_at ? ` – ${new Date(m.ends_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(':00 ', ' ')}` : ''}</p>
        {m.location && <p className="mt-1 text-sm text-bone">📍 {m.location}</p>}
        <p className="mt-1 text-xs text-muted">Set up by {m.creator_name || m.created_by}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {m.video_url && m.status === 'scheduled' && <a href={m.video_url} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white">💻 Join the call</a>}
          {m.status === 'scheduled' && !past && (
            <>
              <a href={googleCalendarUrl(m)} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm font-medium text-gray-700">Add to Google Calendar</a>
              <button onClick={() => downloadIcs(m)} className="rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm font-medium text-gray-700">Apple / Outlook (.ics)</button>
            </>
          )}
        </div>

        {m.status === 'scheduled' && !past && m.my_rsvp && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Your RSVP</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {(Object.keys(RSVP) as (keyof typeof RSVP)[]).map((v) => (
                <button key={v} onClick={() => rsvp(v)} aria-pressed={m.my_rsvp === v}
                  className={`min-h-[40px] rounded-full px-4 text-sm font-semibold ${m.my_rsvp === v ? `${RSVP[v][1]} text-white` : 'bg-gray-100 text-gray-700'}`}>{RSVP[v][0]}</button>
              ))}
            </div>
          </div>
        )}

        {m.can_manage && m.status === 'scheduled' && (
          <div className="mt-4 flex flex-wrap gap-3 border-t border-gray-100 pt-3 text-sm">
            <button onClick={() => setEditing(true)} className="font-medium text-marigold">Edit time or details</button>
            <button onClick={() => setInviting(true)} className="font-medium text-marigold">Invite more people</button>
            <button onClick={cancel} className="font-medium text-gray-500 hover:text-red-600">Cancel meeting</button>
          </div>
        )}
      </div>

      {/* Who's coming */}
      <section className="mt-5">
        <h2 className="font-display text-lg font-bold text-bone">Who's coming <span className="text-sm font-normal text-muted">· {going} going of {(m.invitees ?? []).length}</span></h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {(m.invitees ?? []).map((i) => (
            <li key={i.email} className="flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3 text-sm ring-1 ring-gray-200">
              {i.photo ? <img src={i.photo} alt="" className="h-7 w-7 rounded-full object-cover" /> : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600">{(i.full_name || i.email).charAt(0).toUpperCase()}</span>}
              <span className="max-w-[10rem] truncate text-gray-900">{i.full_name || i.email}{i.email.toLowerCase() === user?.email?.toLowerCase() ? ' (you)' : ''}</span>
              <span className={`text-xs font-semibold ${i.rsvp === 'going' ? 'text-green-700' : i.rsvp === 'maybe' ? 'text-amber-700' : i.rsvp === 'no' ? 'text-gray-500' : 'text-gray-400'}`}>{i.rsvp === 'pending' ? 'No reply' : RSVP[i.rsvp as keyof typeof RSVP]?.[0] ?? i.rsvp}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Agenda & notes */}
      <section className="mt-6">
        <h2 className="font-display text-lg font-bold text-bone">Agenda</h2>
        {m.can_manage ? (
          <textarea rows={4} maxLength={5000} value={agenda} onChange={(e) => setAgenda(e.target.value)} onBlur={saveText} placeholder="What you'll cover" className="mt-2 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900" />
        ) : <p className="mt-2 whitespace-pre-wrap rounded-xl bg-gray-50 p-3 text-sm text-gray-800">{m.agenda || 'No agenda yet.'}</p>}
        <h2 className="mt-5 font-display text-lg font-bold text-bone">Notes</h2>
        <textarea rows={6} maxLength={20000} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={saveText} placeholder="Anyone at the meeting can take notes here." className="mt-2 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900" />
        <div className="mt-2 flex items-center gap-3">
          <button onClick={saveText} className="rounded-xl bg-[#0F1B3D] px-4 py-2 text-sm font-semibold text-white">Save</button>
          {saved && <span className="text-sm text-green-700">{saved}</span>}
        </div>
      </section>

      {/* Action items -> tasks */}
      <section className="mt-6 mb-8">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-bone">Action items</h2>
          {taskEvents.length > 0 && <button onClick={() => setTaskOpen(true)} className="rounded-xl bg-marigold px-3 py-2 text-sm font-semibold text-white">+ Action item</button>}
        </div>
        <p className="text-xs text-muted">Action items become tasks on an event, assigned to a teammate with a due date.</p>
        {(m.action_items ?? []).length === 0 ? <p className="mt-2 text-sm text-muted">None yet.</p> : (
          <ul className="mt-2 flex flex-col gap-1.5">
            {(m.action_items ?? []).map((t) => (
              <li key={t.id} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-2 pl-3 text-sm">
                <button onClick={() => toggleItem(t)} aria-label={t.status === 'completed' ? 'Mark not done' : 'Mark done'}
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs ${t.status === 'completed' ? 'border-green-600 bg-green-600 text-white' : 'border-gray-300 text-transparent'}`}>✓</button>
                <Link to={`/organizer/events/${t.event_id}?tab=Team %26 tasks`} className={`min-w-0 flex-1 truncate ${t.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{t.title}</Link>
                <span className="shrink-0 truncate text-xs text-gray-500">{t.assigned_to ?? 'Unassigned'}{t.due_date ? ` · ${new Date(t.due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing && <MeetingSheet targets={[]} initial={{ ...m, invitees: undefined }} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} />}
      {inviting && <InviteMore meetingId={m.id} meeting={m} onClose={() => setInviting(false)} onDone={() => { setInviting(false); load(); }} />}
      {taskOpen && <PlanningTaskSheet events={taskEvents} meetingId={m.id} onClose={() => setTaskOpen(false)} onDone={() => { setTaskOpen(false); load(); }} />}
    </div>
  );
}

// Add invitees to an existing meeting (re-saves with the extra emails; existing RSVPs are kept).
function InviteMore({ meetingId, meeting, onClose, onDone }: { meetingId: string; meeting: Detail; onClose: () => void; onDone: () => void }) {
  const [people, setPeople] = useState<{ email: string; full_name: string | null }[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [extra, setExtra] = useState('');
  const [busy, setBusy] = useState(false);
  const invited = new Set((meeting.invitees ?? []).map((i) => i.email.toLowerCase()));
  useEffect(() => {
    if (!meeting.event_id && !meeting.organization_id) return;
    supabase.rpc('meeting_candidates', { p_event_id: meeting.event_id, p_org_id: meeting.organization_id })
      .then(({ data }) => setPeople(((data ?? []) as { email: string; full_name: string | null }[]).filter((p) => !invited.has(p.email))));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function save() {
    const extras = extra.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter((e) => /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(e) && !invited.has(e));
    const all = [...new Set([...picked, ...extras])];
    if (!all.length) return onClose();
    setBusy(true);
    await supabase.rpc('save_meeting', { p: { id: meetingId, title: meeting.title, starts_at: meeting.starts_at, ends_at: meeting.ends_at, location: meeting.location ?? '', video_url: meeting.video_url ?? '', agenda: meeting.agenda ?? '', invitees: all } });
    setBusy(false);
    onDone();
  }
  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:rounded-3xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Invite more people">
        <p className="font-display text-lg font-bold text-gray-900">Invite more people</p>
        {people.length > 0 && (
          <div className="mt-3 max-h-56 overflow-y-auto rounded-xl border border-gray-200">
            {people.map((p) => (
              <label key={p.email} className="flex min-h-[44px] items-center gap-3 border-b border-gray-100 px-3 text-sm last:border-0">
                <input type="checkbox" checked={picked.includes(p.email)} onChange={() => setPicked(picked.includes(p.email) ? picked.filter((x) => x !== p.email) : [...picked, p.email])} className="h-4 w-4 accent-marigold" />
                <span className="truncate text-gray-900">{p.full_name || p.email}</span>
              </label>
            ))}
          </div>
        )}
        <label className="mt-3 block text-xs font-medium text-gray-500">Or add emails (separated by commas)
          <input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="name@example.com" className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900" />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-700">Cancel</button>
          <button onClick={save} disabled={busy} className="rounded-xl bg-marigold px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Inviting…' : 'Invite'}</button>
        </div>
      </div>
    </div>
  );
}
