import { useEffect, useState } from 'react';
import { AGENDA_TEMPLATES } from '../../lib/meetingTemplates';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import Sheet from '../scouting/Sheet';
import { toIso, type PlanTarget } from '../../lib/meetings';

const field = 'mt-1 block w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900';
const decode = (t: string) => t.replace(/&#8217;|&rsquo;/g, '\u2019').replace(/&amp;/g, '&');
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
const ROLE_NAME: Record<string, string> = { owner: 'Owner', admin: 'Admin', editor: 'Editor', viewer: 'Viewer', helper: 'Helper', vendor_manager: 'Vendor Manager' };
// Date/time boxes: full width and a fixed height so iPhones don't collapse them when empty.
const dt = 'mt-1 block h-12 w-full min-w-0 appearance-none rounded-xl border border-gray-300 bg-white px-3 text-left text-base text-gray-900';
const pretty = (date: string, time: string) => (date ? new Date(`${date}T${time || '19:00'}`).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).replace(':00 ', ' ') : '');
const DURATIONS = [[30, '30 min'], [45, '45 min'], [60, '1 hour'], [90, '1.5 hours'], [120, '2 hours'], [180, '3 hours']] as const;

// Who it's for (an event or organization) and who's invited (that team, plus any email).
function TargetAndPeople({ targets, target, setTarget, invitees, setInvitees }: {
  targets: PlanTarget[]; target: string; setTarget: (v: string) => void; invitees: string[]; setInvitees: (v: string[]) => void;
}) {
  const { user } = useAuth();
  const me = (user?.email ?? '').toLowerCase();
  const [people, setPeople] = useState<{ email: string; full_name: string | null; role: string }[] | null>(null);
  const [extra, setExtra] = useState('');
  const t = targets.find((x) => `${x.kind}:${x.id}` === target) ?? null;
  useEffect(() => {
    if (!t) { setPeople([]); return; }
    setPeople(null);
    supabase.rpc('meeting_candidates', { p_event_id: t.kind === 'event' ? t.id : null, p_org_id: t.kind === 'org' ? t.id : null })
      .then(({ data }) => setPeople(((data ?? []) as { email: string; full_name: string | null; role: string }[]).filter((p) => p.email !== me)));
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (e: string) => setInvitees(invitees.includes(e) ? invitees.filter((x) => x !== e) : [...invitees, e]);
  const allIn = !!people?.length && people.every((p) => invitees.includes(p.email));
  return (
    <>
      <label className="mt-3 block text-xs font-medium text-gray-500">For
        <select value={target} onChange={(e) => { setTarget(e.target.value); setInvitees([]); }} className={field}>
          <option value="">Just me (invite anyone by email)</option>
          {targets.filter((x) => x.kind === 'org').length > 0 && <optgroup label="Organizations">{targets.filter((x) => x.kind === 'org').map((x) => <option key={x.id} value={`org:${x.id}`}>{x.label}</option>)}</optgroup>}
          {targets.filter((x) => x.kind === 'event').length > 0 && <optgroup label="Events">{targets.filter((x) => x.kind === 'event').map((x) => <option key={x.id} value={`event:${x.id}`}>{decode(x.label)}</option>)}</optgroup>}
        </select>
      </label>
      <div className="mt-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-gray-500">Invite</span>
          {!!people?.length && <button type="button" onClick={() => setInvitees(allIn ? invitees.filter((e) => !people.some((p) => p.email === e)) : [...new Set([...invitees, ...people.map((p) => p.email)])])} className="text-xs font-semibold text-marigold">{allIn ? 'Clear team' : `Everyone on the team (${people.length})`}</button>}
        </div>
        {people === null ? <p className="mt-1 text-sm text-gray-400">Loading the team…</p> : people.length > 0 && (
          <div className="mt-1 max-h-48 overflow-y-auto rounded-xl border border-gray-200 bg-white">
            {people.map((p) => (
              <label key={p.email} className="flex min-h-[44px] items-center gap-3 border-b border-gray-100 px-3 text-sm last:border-0">
                <input type="checkbox" checked={invitees.includes(p.email)} onChange={() => toggle(p.email)} className="h-4 w-4 accent-marigold" />
                <span className="min-w-0 flex-1 truncate text-gray-900">{p.full_name || p.email}</span>
                <span className="shrink-0 text-xs text-gray-500">{ROLE_NAME[p.role] ?? p.role}</span>
              </label>
            ))}
          </div>
        )}
        <div className="mt-2 flex gap-2">
          <input type="email" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Add someone by email" className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 sm:text-sm" />
          <button type="button" onClick={() => { const e = extra.trim().toLowerCase(); if (EMAIL_RE.test(e) && e !== me && !invitees.includes(e)) { setInvitees([...invitees, e]); setExtra(''); } }} className="rounded-xl border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700">Add</button>
        </div>
        {invitees.filter((e) => !people?.some((p) => p.email === e)).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {invitees.filter((e) => !people?.some((p) => p.email === e)).map((e) => (
              <button key={e} type="button" onClick={() => toggle(e)} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700">{e} ×</button>
            ))}
          </div>
        )}
        <p className="mt-1 text-xs text-gray-500">{invitees.length} invited · they get an email and a notification.</p>
      </div>
    </>
  );
}

export interface MeetingDraft { id?: string; title: string; starts_at: string; ends_at: string | null; location: string | null; video_url: string | null; agenda: string | null; event_id: string | null; organization_id: string | null; invitees?: string[] }

export function MeetingSheet({ targets, defaultTarget = '', initial, onClose, onSaved }: { targets: PlanTarget[]; defaultTarget?: string; initial?: MeetingDraft | null; onClose: () => void; onSaved: (id: string) => void }) {
  const editing = !!initial?.id;
  const start = initial ? new Date(initial.starts_at) : null;
  const pad = (n: number) => String(n).padStart(2, '0');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [date, setDate] = useState(start ? `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}` : '');
  const [time, setTime] = useState(start ? `${pad(start.getHours())}:${pad(start.getMinutes())}` : '19:00');
  const [duration, setDuration] = useState(initial?.ends_at && initial.starts_at ? Math.round((new Date(initial.ends_at).getTime() - new Date(initial.starts_at).getTime()) / 60000) : 60);
  const [location, setLocation] = useState(initial?.location ?? '');
  const [videoUrl, setVideoUrl] = useState(initial?.video_url ?? '');
  const [agenda, setAgenda] = useState(initial?.agenda ?? '');
  // Meeting extras: repeat, and agenda templates (built-in + saved).
  const [repeat, setRepeat] = useState<'none' | 'weekly' | 'biweekly' | 'monthly'>('none');
  const [repeatCount, setRepeatCount] = useState(8);
  const [saved, setSaved] = useState<{ id: string; name: string; agenda: string; org_name: string | null }[]>([]);
  const [tplMsg, setTplMsg] = useState<string | null>(null);
  useEffect(() => { supabase.rpc('my_agenda_templates').then(({ data }) => setSaved((data ?? []) as typeof saved)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  function applyTemplate(v: string) {
    if (!v) return;
    const t = v.startsWith('b:') ? AGENDA_TEMPLATES[Number(v.slice(2))] : saved.find((x) => x.id === v.slice(2));
    if (t && (!agenda.trim() || window.confirm('Replace the current agenda with this template?'))) setAgenda(t.agenda);
  }
  async function saveTemplate() {
    if (!agenda.trim()) return setTplMsg('Write an agenda first.');
    const name = window.prompt('Name this agenda template', title.trim() || 'My agenda');
    if (!name?.trim()) return;
    const [kind, tid] = target.split(':');
    const { error } = await supabase.rpc('save_agenda_template', { p_name: name.trim(), p_agenda: agenda, p_org_id: kind === 'org' ? tid : null });
    if (error) return setTplMsg(error.message && !/function|permission/i.test(error.message) ? error.message : "Couldn't save the template.");
    setTplMsg(`Saved "${name.trim()}" to your agenda templates.`);
    supabase.rpc('my_agenda_templates').then(({ data }) => setSaved((data ?? []) as typeof saved));
  }
  const [target, setTarget] = useState(initial ? (initial.event_id ? `event:${initial.event_id}` : initial.organization_id ? `org:${initial.organization_id}` : '') : defaultTarget);
  const [invitees, setInvitees] = useState<string[]>(initial?.invitees ?? []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function save() {
    if (!title.trim()) return setErr('Give the meeting a name.');
    if (!date) return setErr('Pick a date.');
    if (videoUrl.trim() && !/^https?:\/\//i.test(videoUrl.trim())) return setErr('The video link should start with https://');
    setBusy(true); setErr(null);
    const starts = toIso(date, time);
    const [kind, id] = target.split(':');
    const { data, error } = await supabase.rpc('save_meeting', { p: {
      id: initial?.id ?? null, title: title.trim(), starts_at: starts, ends_at: new Date(new Date(starts).getTime() + duration * 60000).toISOString(),
      location: location.trim(), video_url: videoUrl.trim(), agenda, event_id: kind === 'event' ? id : null, organization_id: kind === 'org' ? id : null, invitees,
    } });
    setBusy(false);
    if (error || !data) return setErr(error?.message && !/function|permission denied/i.test(error.message) ? error.message : "Couldn't save the meeting.");
    if (!editing && repeat !== 'none') await supabase.rpc('repeat_meeting', { p_meeting_id: data as string, p_every: repeat, p_count: repeatCount });
    onSaved(data as string);
  }
  return (
    <Sheet title={editing ? 'Edit meeting' : 'Schedule a meeting'} onClose={onClose}>
      <label className="block text-xs font-medium text-gray-500">Meeting name<input value={title} maxLength={150} onChange={(e) => setTitle(e.target.value)} placeholder="Lineup check-in" className={field} autoFocus={!editing} /></label>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block min-w-0 text-xs font-medium text-gray-500">Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={dt} /></label>
        <label className="block min-w-0 text-xs font-medium text-gray-500">Time<input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={dt} /></label>
      </div>
      {date && <p className="mt-1 text-xs text-gray-500">{pretty(date, time)}</p>}
      {!editing && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-gray-500">Repeats
            <select value={repeat} onChange={(e) => setRepeat(e.target.value as typeof repeat)} className={field}>
              <option value="none">Doesn't repeat</option><option value="weekly">Every week</option><option value="biweekly">Every 2 weeks</option><option value="monthly">Every month</option>
            </select>
          </label>
          {repeat !== 'none' && <label className="block text-xs font-medium text-gray-500">How many meetings
            <select value={repeatCount} onChange={(e) => setRepeatCount(Number(e.target.value))} className={field}>{[4, 6, 8, 12, 26].map((n) => <option key={n} value={n}>{n}</option>)}</select>
          </label>}
        </div>
      )}
      {!editing && repeat !== 'none' && <p className="mt-1 text-xs text-gray-500">Everyone is invited once; the whole series shows up on their TapIN calendar, with reminders before each meeting.</p>}
      <label className="mt-3 block text-xs font-medium text-gray-500">How long
        <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={field}>{DURATIONS.map(([m, l]) => <option key={m} value={m}>{l}</option>)}</select>
      </label>
      <label className="mt-3 block text-xs font-medium text-gray-500">Video link (optional)<input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://meet.google.com/… or Zoom link" className={field} inputMode="url" /></label>
      <label className="mt-3 block text-xs font-medium text-gray-500">Place (optional)<input value={location} maxLength={300} onChange={(e) => setLocation(e.target.value)} placeholder="Coffee shop, studio, office…" className={field} /></label>
      {!editing && <TargetAndPeople targets={targets} target={target} setTarget={setTarget} invitees={invitees} setInvitees={setInvitees} />}
      {editing && <p className="mt-3 text-xs text-gray-500">Changing the time asks everyone to RSVP again. Invite more people from the meeting page.</p>}
      <div className="mt-3 flex items-end justify-between gap-2">
        <span className="text-xs font-medium text-gray-500">Agenda (optional)</span>
        <select value="" onChange={(e) => applyTemplate(e.target.value)} aria-label="Use an agenda template" className="max-w-[60%] rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700">
          <option value="">📋 Use a template…</option>
          <optgroup label="Ready-made">{AGENDA_TEMPLATES.map((t, i) => <option key={t.name} value={`b:${i}`}>{t.name}</option>)}</optgroup>
          {saved.length > 0 && <optgroup label="Saved">{saved.map((t) => <option key={t.id} value={`s:${t.id}`}>{t.name}{t.org_name ? ` (${t.org_name})` : ''}</option>)}</optgroup>}
        </select>
      </div>
      <textarea rows={5} maxLength={5000} value={agenda} onChange={(e) => setAgenda(e.target.value)} placeholder="What we'll cover" aria-label="Agenda" className={field} />
      <button type="button" onClick={saveTemplate} className="mt-1 text-xs font-medium text-marigold">Save this agenda as a template</button>
      {tplMsg && <p className="mt-1 text-xs text-gray-600">{tplMsg}</p>}
      {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
      <button onClick={save} disabled={busy} className="mt-4 w-full rounded-xl bg-marigold py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : editing ? 'Save changes' : 'Schedule & invite'}</button>
    </Sheet>
  );
}

export function PollSheet({ targets, defaultTarget = '', onClose }: { targets: PlanTarget[]; defaultTarget?: string; onClose: () => void }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(60);
  const [options, setOptions] = useState<{ date: string; time: string }[]>([{ date: '', time: '19:00' }, { date: '', time: '19:00' }, { date: '', time: '19:00' }]);
  const [videoUrl, setVideoUrl] = useState('');
  const [location, setLocation] = useState('');
  const [target, setTarget] = useState(defaultTarget);
  const [invitees, setInvitees] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const filled = options.filter((o) => o.date);
  async function create() {
    if (!title.trim()) return setErr('Give it a name, like "Planning kickoff".');
    if (filled.length < 2) return setErr('Suggest at least 2 times.');
    if (invitees.length === 0) return setErr('Invite at least one person.');
    setBusy(true); setErr(null);
    const [kind, id] = target.split(':');
    const { data, error } = await supabase.rpc('create_poll', { p: {
      title: title.trim(), duration_minutes: duration, location: location.trim(), video_url: videoUrl.trim(),
      options: [...new Set(filled.map((o) => toIso(o.date, o.time)))], invitees,
      event_id: kind === 'event' ? id : null, organization_id: kind === 'org' ? id : null,
    } });
    setBusy(false);
    if (error || !data) return setErr(error?.message && !/function|permission denied/i.test(error.message) ? error.message : "Couldn't create the poll.");
    navigate(`/organizer/polls/${data}`);
  }
  return (
    <Sheet title="Find a time" onClose={onClose}>
      <p className="-mt-2 text-sm text-gray-600">Suggest a few times, and everyone taps the ones that work. Then pick the winner and it becomes a meeting.</p>
      <label className="mt-3 block text-xs font-medium text-gray-500">What's it for<input value={title} maxLength={150} onChange={(e) => setTitle(e.target.value)} placeholder="Planning kickoff" className={field} autoFocus /></label>
      <label className="mt-3 block text-xs font-medium text-gray-500">How long
        <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={field}>{DURATIONS.map(([m, l]) => <option key={m} value={m}>{l}</option>)}</select>
      </label>
      <div className="mt-3">
        <span className="text-xs font-medium text-gray-500">Times to choose from</span>
        {options.map((o, i) => (
          <div key={i} className="mt-2 rounded-2xl border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-gray-900">Option {i + 1}</span>
              {options.length > 2 && <button type="button" onClick={() => setOptions(options.filter((_, j) => j !== i))} className="min-h-[36px] rounded-lg px-2 text-sm text-gray-500 hover:text-red-600">Remove</button>}
            </div>
            <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="block min-w-0 text-xs font-medium text-gray-500">Date
                <input type="date" value={o.date} onChange={(e) => setOptions(options.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} className={dt} />
              </label>
              <label className="block min-w-0 text-xs font-medium text-gray-500">Time
                <input type="time" value={o.time} onChange={(e) => setOptions(options.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))} className={dt} />
              </label>
            </div>
            <p className={`mt-1.5 text-xs ${o.date ? 'font-medium text-indigo-700' : 'text-gray-400'}`}>{o.date ? pretty(o.date, o.time) : 'Pick a date'}</p>
          </div>
        ))}
        {options.length < 8 && <button type="button" onClick={() => setOptions([...options, { date: options[options.length - 1]?.date ?? '', time: options[options.length - 1]?.time ?? '19:00' }])} className="mt-2 min-h-[44px] w-full rounded-xl border border-dashed border-gray-300 text-sm font-semibold text-marigold">+ Add another time</button>}
        <p className="mt-1 text-xs text-gray-500">{filled.length} of {options.length} times picked · at least 2 needed</p>
      </div>
      <label className="mt-3 block text-xs font-medium text-gray-500">Video link (optional)<input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://…" className={field} inputMode="url" /></label>
      <label className="mt-3 block text-xs font-medium text-gray-500">Place (optional)<input value={location} maxLength={300} onChange={(e) => setLocation(e.target.value)} className={field} /></label>
      <TargetAndPeople targets={targets} target={target} setTarget={setTarget} invitees={invitees} setInvitees={setInvitees} />
      {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
      <button onClick={create} disabled={busy} className="mt-4 w-full rounded-xl bg-marigold py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Creating…' : 'Send the poll'}</button>
    </Sheet>
  );
}
