import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import Sheet from '../scouting/Sheet';

export interface Person { email: string; full_name: string | null; profile_photo: string | null; planning_role: string | null; events: { id: string; title: string; role: string; start_date: string | null }[]; orgs: { name: string; slug: string; role: string }[]; open_tasks: number; overdue_tasks: number }
interface PlanTask { id: string; event_id: string; event_title: string; title: string; due_date: string | null; assigned_to: string | null }
interface MyEvent { id: string; title: string; start_date: string | null; is_owner: boolean }

const ROLES: { key: string; label: string; desc: string }[] = [
  { key: 'admin', label: 'Admin', desc: 'Everything, including managing event teams' },
  { key: 'editor', label: 'Editor', desc: 'Edit events, lineups, scouting and tasks' },
  { key: 'viewer', label: 'Viewer', desc: 'See everything, change nothing' },
  { key: 'helper', label: 'Helper', desc: 'See events and complete their own tasks' },
];
const ROLE_NAME: Record<string, string> = { owner: 'Organizer', admin: 'Admin', editor: 'Editor', viewer: 'Viewer', helper: 'Helper', vendor_manager: 'Vendor Manager', member: 'Member' };
const decode = (t: string) => t.replace(/&#8217;|&rsquo;/g, '\u2019').replace(/&amp;/g, '&');
const field = 'mt-1 block w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900';
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
const today = () => new Date().toISOString().slice(0, 10);

function Avatar({ p }: { p: Person }) {
  return p.profile_photo
    ? <img src={p.profile_photo} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
    : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-200 font-bold text-gray-600">{(p.full_name || p.email).charAt(0).toUpperCase()}</span>;
}

// Planning > Team: your planning team (on all your events) and everyone you work with.
interface OrgTeam { id: string; name: string; slug: string; logo_url: string | null; kind: string; color: string | null; my_role: string; members: { email: string; role: string; full_name: string | null; photo: string | null }[] | null }

export default function PlanningTeam({ query, tasks, events, onChanged, scope = 'all', scopeOrgId = null }: { query: string; tasks: PlanTask[]; events: MyEvent[]; onChanged: () => void; scope?: 'all' | 'me' | 'org'; scopeOrgId?: string | null }) {
  const { user } = useAuth();
  const [people, setPeople] = useState<Person[] | null>(null);
  const [team, setTeam] = useState<{ member_email: string; role: string }[]>([]);
  const [adding, setAdding] = useState(false);
  const [openTasks, setOpenTasks] = useState<string | null>(null);
  const [addTo, setAddTo] = useState<Person | null>(null);
  const [assign, setAssign] = useState<Person | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [orgTeams, setOrgTeams] = useState<OrgTeam[]>([]);
  useEffect(() => { supabase.rpc('my_org_teams').then(({ data }) => setOrgTeams((data ?? []) as OrgTeam[])); }, []);

  const load = useCallback(async () => {
    const [{ data: ppl }, { data: pt }] = await Promise.all([
      supabase.rpc('planning_people'),
      user?.id ? supabase.from('planning_team').select('member_email, role').eq('owner_id', user.id).order('added_at') : Promise.resolve({ data: [] }),
    ]);
    setPeople(((ppl ?? []) as Person[]).map((p) => ({ ...p, open_tasks: Number(p.open_tasks), overdue_tasks: Number(p.overdue_tasks) })));
    setTeam((pt ?? []) as { member_email: string; role: string }[]);
  }, [user?.id]);
  useEffect(() => { load(); }, [load]);
  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(null), 4000); };

  const q = query.trim().toLowerCase();
  const scopeOrg = orgTeams.find((o) => o.id === scopeOrgId) ?? null;
  const scopeEmails = new Set((scopeOrg?.members ?? []).map((m) => m.email));
  const shown = (people ?? [])
    .filter((p) => scope !== 'org' || scopeEmails.has(p.email))
    .filter((p) => !q || (p.full_name ?? '').toLowerCase().includes(q) || p.email.includes(q) || p.events.some((e) => e.title.toLowerCase().includes(q)));
  const shownOrgTeams = orgTeams.filter((o) => scope === 'all' || (scope === 'org' && o.id === scopeOrgId));
  const nameOf = (email: string) => (people ?? []).find((p) => p.email === email.toLowerCase())?.full_name || email;

  async function changeRole(email: string, role: string) {
    const { error } = await supabase.rpc('add_planning_member', { p_email: email, p_role: role });
    if (!error) { flash('Role updated on all your events.'); load(); onChanged(); }
  }
  async function remove(email: string) {
    if (!window.confirm(`Remove ${nameOf(email)} from your planning team? They'll come off the events they were added to through it.`)) return;
    const { error } = await supabase.rpc('remove_planning_member', { p_email: email });
    if (!error) { flash('Removed from your planning team.'); load(); onChanged(); }
  }

  return (
    <div className="flex flex-col gap-6">
      {msg && <p role="status" className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">{msg}</p>}

      {/* Planning team (follows you) */}
      {scope !== 'org' && (
      <section className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg font-bold text-bone">Your planning team</h3>
            <p className="text-sm text-muted">People who help you plan everything. They're added to <strong>all your events</strong>, including new ones, with the role you choose.</p>
          </div>
          <button onClick={() => setAdding(true)} className="shrink-0 rounded-xl bg-marigold px-4 py-2 text-sm font-semibold text-white">+ Add</button>
        </div>
        {team.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {team.map((m) => (
              <li key={m.member_email} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-3">
                <span className="min-w-0 truncate text-sm font-medium text-gray-900">
                  {nameOf(m.member_email)}
                  {nameOf(m.member_email) !== m.member_email && <span className="block truncate text-xs font-normal text-gray-500">{m.member_email}</span>}
                </span>
                <span className="flex items-center gap-2">
                  <select value={m.role} onChange={(e) => changeRole(m.member_email, e.target.value)} aria-label="Role" className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm">
                    {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                  </select>
                  <button onClick={() => remove(m.member_email)} className="px-1 text-sm text-gray-400 hover:text-red-600">Remove</button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      )}

      {/* Organization teams (follow each organization's events) */}
      {shownOrgTeams.map((o) => (
        <section key={o.id} className="rounded-2xl border border-gray-200 bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3">
              {o.logo_url ? <img src={o.logo_url} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold text-white" style={{ background: o.color || '#0F1B3D' }}>{o.name.charAt(0)}</span>}
              <div className="min-w-0">
                <h3 className="truncate font-display text-lg font-bold text-bone">{o.name} team</h3>
                <p className="text-xs text-muted">On all of {o.name}'s events with their role · you're {ROLE_NAME[o.my_role] ?? o.my_role}</p>
              </div>
            </div>
            {(o.my_role === 'owner' || o.my_role === 'admin') && <Link to={`/business/${o.slug}/manage`} className="shrink-0 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700">Manage team ›</Link>}
          </div>
          <ul className="mt-3 flex flex-wrap gap-2">
            {(o.members ?? []).map((m) => (
              <li key={m.email} className="flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3 text-sm ring-1 ring-gray-200">
                {m.photo ? <img src={m.photo} alt="" className="h-7 w-7 rounded-full object-cover" /> : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600">{(m.full_name || m.email).charAt(0).toUpperCase()}</span>}
                <span className="max-w-[10rem] truncate text-gray-900">{m.full_name || m.email}</span>
                <span className="text-xs text-gray-500">{ROLE_NAME[m.role] ?? m.role}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {/* Everyone you work with */}
      <section>
        <h3 className="font-display text-lg font-bold text-bone">People you work with</h3>
        <p className="text-sm text-muted">Teammates on your events and organizations, with their workload.</p>
        {people === null ? <div className="mt-3 h-24 animate-pulse rounded-2xl bg-gray-100" /> : shown.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-muted">
            {(people ?? []).length === 0 ? 'No teammates yet. Add people to your planning team, or to an event from its Team & tasks tab.' : 'No one matches.'}
          </p>
        ) : (
          <ul className="mt-3 grid gap-3 lg:grid-cols-2">
            {shown.map((p) => {
              const theirTasks = tasks.filter((t) => (t.assigned_to ?? '').toLowerCase() === p.email);
              return (
                <li key={p.email} className="rounded-2xl border border-gray-200 bg-surface p-4">
                  <div className="flex items-start gap-3">
                    <Avatar p={p} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-bone">
                        {p.full_name || p.email}
                        {p.planning_role && <span className="ml-1.5 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700">Planning · {ROLE_NAME[p.planning_role]}</span>}
                      </p>
                      {p.full_name && <p className="truncate text-xs text-muted">{p.email}</p>}
                      <p className={`mt-0.5 text-xs font-medium ${p.overdue_tasks ? 'text-red-600' : 'text-muted'}`}>
                        {p.open_tasks} open task{p.open_tasks === 1 ? '' : 's'}{p.overdue_tasks ? ` · ${p.overdue_tasks} overdue` : ''}
                      </p>
                    </div>
                  </div>
                  {(p.events.length > 0 || p.orgs.length > 0) && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {p.events.slice(0, 3).map((e) => (
                        <Link key={e.id} to={`/organizer/events/${e.id}?tab=Team %26 tasks`} className="max-w-full truncate rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700">{ROLE_NAME[e.role] ?? e.role} · {decode(e.title)}</Link>
                      ))}
                      {p.events.length > 3 && <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-500">+{p.events.length - 3} more</span>}
                      {p.orgs.map((o) => (
                        <Link key={o.slug} to={`/business/${o.slug}/manage`} className="rounded-full bg-[#C9A227]/15 px-2.5 py-1 text-xs text-[#8a6d12]">{o.name} · {ROLE_NAME[o.role] ?? o.role}</Link>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2 text-sm">
                    {theirTasks.length > 0 && (
                      <button onClick={() => setOpenTasks(openTasks === p.email ? null : p.email)} className="min-h-[36px] rounded-lg border border-gray-300 bg-white px-3 font-medium text-gray-700">
                        {openTasks === p.email ? 'Hide tasks' : `Tasks (${theirTasks.length})`}
                      </button>
                    )}
                    <button onClick={() => setAssign(p)} className="min-h-[36px] rounded-lg border border-gray-300 bg-white px-3 font-medium text-gray-700">Assign a task</button>
                    <button onClick={() => setAddTo(p)} className="min-h-[36px] rounded-lg border border-gray-300 bg-white px-3 font-medium text-gray-700">Add to an event</button>
                  </div>
                  {openTasks === p.email && (
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {theirTasks.map((t) => (
                        <li key={t.id}>
                          <Link to={`/organizer/events/${t.event_id}?tab=Team %26 tasks`} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm">
                            <span className="min-w-0 truncate">{t.title}<span className="block truncate text-xs text-gray-500">{decode(t.event_title)}</span></span>
                            {t.due_date && (
                              <span className={`shrink-0 text-xs ${t.due_date < today() ? 'font-semibold text-red-600' : 'text-gray-500'}`}>
                                {new Date(t.due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {adding && <AddPlanningSheet onClose={() => setAdding(false)} onDone={(t) => { setAdding(false); flash(t); load(); onChanged(); }} />}
      {addTo && <AddToEventSheet person={addTo} events={events.filter((e) => !addTo.events.some((x) => x.id === e.id))} onClose={() => setAddTo(null)} onDone={(t) => { setAddTo(null); flash(t); load(); }} />}
      {assign && (
        <AssignTaskSheet person={assign}
          events={assign.events.length ? assign.events.map((e) => ({ id: e.id, title: e.title })) : events.map((e) => ({ id: e.id, title: e.title }))}
          onClose={() => setAssign(null)} onDone={(t) => { setAssign(null); flash(t); load(); onChanged(); }} />
      )}
    </div>
  );
}

function AddPlanningSheet({ onClose, onDone }: { onClose: () => void; onDone: (msg: string) => void }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('editor');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function add() {
    const e = email.trim().toLowerCase();
    if (!EMAIL_RE.test(e)) return setErr('Enter a valid email address.');
    setBusy(true); setErr(null);
    const { data, error } = await supabase.rpc('add_planning_member', { p_email: e, p_role: role });
    if (error) { setBusy(false); return setErr(error.message && !/function|permission/i.test(error.message) ? error.message : "Couldn't add them."); }
    await supabase.functions.invoke('planning-invite-email', { body: { email: e } }).catch(() => {});
    setBusy(false);
    const n = Number(data) || 0;
    onDone(`Added to your planning team and ${n} event${n === 1 ? '' : 's'}. We've emailed ${e}.`);
  }
  return (
    <Sheet title="Add to your planning team" onClose={onClose}>
      <p className="-mt-2 text-sm text-gray-600">They'll be added to <strong>all your events</strong> (current and future) with this role. You can change the role or remove them anytime.</p>
      <label className="mt-3 block text-xs font-medium text-gray-500">Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="partner@example.com" className={field} autoFocus /></label>
      <div className="mt-3 flex flex-col gap-2">
        {ROLES.map((r) => (
          <label key={r.key} className={`flex min-h-[48px] items-center gap-3 rounded-xl border px-3 text-sm ${role === r.key ? 'border-marigold bg-marigold/5' : 'border-gray-200 bg-white'}`}>
            <input type="radio" checked={role === r.key} onChange={() => setRole(r.key)} className="h-4 w-4 accent-marigold" />
            <span><strong className="text-gray-900">{r.label}</strong><span className="block text-xs text-gray-500">{r.desc}</span></span>
          </label>
        ))}
      </div>
      {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
      <button onClick={add} disabled={busy} className="mt-4 w-full rounded-xl bg-marigold py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Adding…' : 'Add to planning team'}</button>
    </Sheet>
  );
}

function AddToEventSheet({ person, events, onClose, onDone }: { person: Person; events: MyEvent[]; onClose: () => void; onDone: (msg: string) => void }) {
  const [eventId, setEventId] = useState(events[0]?.id ?? '');
  const [role, setRole] = useState('editor');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function add() {
    if (!eventId) return;
    setBusy(true); setErr(null);
    const { data, error } = await supabase.rpc('add_event_teammate', { p_event_id: eventId, p_email: person.email, p_role: role });
    if (error) { setBusy(false); return setErr(error.message && !/function|permission/i.test(error.message) ? error.message : "Couldn't add them."); }
    if (data) supabase.functions.invoke('send-app-email', { body: { kind: 'team_invite', collaboration_id: data } }).catch(() => {});
    setBusy(false);
    onDone(`${person.full_name || person.email} was added to ${decode(events.find((e) => e.id === eventId)?.title ?? 'the event')}.`);
  }
  return (
    <Sheet title={`Add ${person.full_name || person.email} to an event`} onClose={onClose}>
      {events.length === 0 ? <p className="text-sm text-gray-600">They're already on all your upcoming events.</p> : (
        <>
          <label className="block text-xs font-medium text-gray-500">Event
            <select value={eventId} onChange={(e) => setEventId(e.target.value)} className={field}>
              {events.map((e) => <option key={e.id} value={e.id}>{decode(e.title)}{e.start_date ? ` (${new Date(e.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})` : ''}</option>)}
            </select>
          </label>
          <label className="mt-3 block text-xs font-medium text-gray-500">Role
            <select value={role} onChange={(e) => setRole(e.target.value)} className={field}>{ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}: {r.desc}</option>)}</select>
          </label>
          {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
          <button onClick={add} disabled={busy} className="mt-4 w-full rounded-xl bg-marigold py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Adding…' : 'Add to event'}</button>
        </>
      )}
    </Sheet>
  );
}

function AssignTaskSheet({ person, events, onClose, onDone }: { person: Person; events: { id: string; title: string }[]; onClose: () => void; onDone: (msg: string) => void }) {
  const { user } = useAuth();
  const [eventId, setEventId] = useState(events[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function save() {
    if (!title.trim() || !eventId || !user?.email) return setErr('Write the task and pick an event.');
    setBusy(true); setErr(null);
    const { data, error } = await supabase.from('event_tasks').insert({ event_id: eventId, title: title.trim().slice(0, 200), assigned_to: person.email, assigned_by: user.email, status: 'todo', due_date: due || null }).select('id').single();
    setBusy(false);
    if (error) return setErr("Couldn't add the task. You need to be the organizer, an Admin or an Editor of that event.");
    if (data?.id && person.email !== user.email.toLowerCase()) supabase.functions.invoke('send-app-email', { body: { kind: 'task_assigned', task_id: data.id } }).catch(() => {});
    onDone(`Task assigned to ${person.full_name || person.email}.`);
  }
  return (
    <Sheet title={`Assign a task to ${person.full_name || person.email}`} onClose={onClose}>
      <label className="block text-xs font-medium text-gray-500">Task<input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="Confirm the sound check time" className={field} autoFocus /></label>
      <label className="mt-3 block text-xs font-medium text-gray-500">Event
        <select value={eventId} onChange={(e) => setEventId(e.target.value)} className={field}>{events.map((e) => <option key={e.id} value={e.id}>{decode(e.title)}</option>)}</select>
      </label>
      <label className="mt-3 block text-xs font-medium text-gray-500">Due (optional)<input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={field} /></label>
      {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
      <button onClick={save} disabled={busy} className="mt-4 w-full rounded-xl bg-marigold py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Assigning…' : 'Assign task'}</button>
    </Sheet>
  );
}
