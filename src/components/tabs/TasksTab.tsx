import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { ROLE_LABEL, type TeamMember } from '../../lib/useEventTeam';

type TaskStatus = 'todo' | 'in_progress' | 'completed';
interface Task { id: string; title: string; description: string | null; assigned_to: string | null; assigned_by: string | null; status: TaskStatus; priority: string | null; due_date: string | null; scout_card_id: string | null }
const STATUS_LABEL: Record<TaskStatus, string> = { todo: 'To do', in_progress: 'In progress', completed: 'Done' };
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

// Tasks for an event, assigned to people on the event's team. Owners, admins and editors
// create and manage tasks; everyone else sees them and updates the ones assigned to them.
export default function TasksTab({ eventId, team, canManage, filter, onFilter, onTeamChanged }: {
  eventId: string; team: TeamMember[]; canManage: boolean; filter: string; onFilter: (f: string) => void; onTeamChanged: () => void;
}) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showDone, setShowDone] = useState(false);

  async function load() {
    const { data } = await supabase.from('event_tasks').select('*').eq('event_id', eventId).order('due_date', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false });
    setTasks((data ?? []) as Task[]);
  }
  useEffect(() => { load(); }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  const nameOf = (email: string | null) => {
    if (!email) return 'Unassigned';
    const m = team.find((t) => t.email === email.toLowerCase());
    return m?.full_name || email;
  };

  async function addTask(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !user?.email) return;
    setBusy(true); setMsg(null);
    let to: string | null = assignee && assignee !== '__new' ? assignee : null;
    // Someone not on the team yet: add them as a Helper (and email them the invite).
    if (assignee === '__new') {
      const email = newEmail.trim().toLowerCase();
      if (!EMAIL_RE.test(email)) { setBusy(false); return setMsg({ ok: false, text: 'Enter a valid email address.' }); }
      const { data: inv, error: invErr } = await supabase.from('event_collaborations').insert({ event_id: eventId, collaborator_email: email, role: 'helper', permissions: [], invited_by: user.email }).select('id').single();
      if (invErr) { setBusy(false); return setMsg({ ok: false, text: "Couldn't add them to the team." }); }
      if (inv?.id) supabase.functions.invoke('send-app-email', { body: { kind: 'team_invite', collaboration_id: inv.id } }).catch(() => {});
      to = email;
      onTeamChanged();
    }
    const { data: inserted, error } = await supabase.from('event_tasks').insert({
      event_id: eventId, title: title.trim().slice(0, 200), assigned_to: to, assigned_by: user.email, status: 'todo', due_date: dueDate || null,
    }).select('id').single();
    setBusy(false);
    if (error) return setMsg({ ok: false, text: "Couldn't add the task." });
    if (to && to !== user.email && inserted?.id) supabase.functions.invoke('send-app-email', { body: { kind: 'task_assigned', task_id: inserted.id } }).catch(() => {});
    setTitle(''); setAssignee(''); setNewEmail(''); setDueDate('');
    setMsg({ ok: true, text: to ? `Task added and assigned to ${nameOf(to)}.` : 'Task added.' });
    load(); onTeamChanged();
  }

  async function setStatus(t: Task, status: TaskStatus) {
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, status } : x)));
    await supabase.from('event_tasks').update({ status }).eq('id', t.id);
    onTeamChanged();
  }
  async function reassign(t: Task, email: string) {
    await supabase.from('event_tasks').update({ assigned_to: email || null }).eq('id', t.id);
    if (email && email !== user?.email) supabase.functions.invoke('send-app-email', { body: { kind: 'task_assigned', task_id: t.id } }).catch(() => {});
    load(); onTeamChanged();
  }
  async function remove(t: Task) {
    await supabase.from('event_tasks').delete().eq('id', t.id);
    load(); onTeamChanged();
  }

  const visible = useMemo(() => tasks.filter((t) =>
    (filter === 'all' || (filter === 'unassigned' ? !t.assigned_to : (t.assigned_to ?? '').toLowerCase() === filter)) && (showDone || t.status !== 'completed')), [tasks, filter, showDone]);
  const doneCount = tasks.filter((t) => t.status === 'completed' && (filter === 'all' || (filter === 'unassigned' ? !t.assigned_to : (t.assigned_to ?? '').toLowerCase() === filter))).length;
  const today = new Date().toISOString().slice(0, 10);
  const field = 'rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900';

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl font-bold text-bone">Tasks</h2>
        <div className="flex flex-wrap gap-1.5 text-xs">
          {[{ k: 'all', l: 'Everyone' }, ...team.filter((m) => m.open_tasks > 0 || filter === m.email).map((m) => ({ k: m.email, l: (m.full_name || m.email).split(' ')[0] })), { k: 'unassigned', l: 'Unassigned' }].map((f) => (
            <button key={f.k} onClick={() => onFilter(f.k)} className={`rounded-full px-3 py-1.5 font-medium ${filter === f.k ? 'bg-marigold text-white' : 'border border-gray-300 bg-white text-gray-600'}`}>{f.l}</button>
          ))}
        </div>
      </div>

      {canManage && (
        <form onSubmit={addTask} className="mt-3 grid gap-2 rounded-2xl border border-gray-200 bg-surface p-3 sm:grid-cols-[2fr_1.4fr_1fr_auto]">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New task, e.g. Confirm sound equipment" className={field} aria-label="Task" />
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={field} aria-label="Assign to">
            <option value="">Unassigned</option>
            {team.map((m) => <option key={m.email} value={m.email}>{m.full_name || m.email} · {ROLE_LABEL[m.role] ?? m.role}</option>)}
            <option value="__new">+ Someone not on the team…</option>
          </select>
          <input type="date" value={dueDate} min={today} onChange={(e) => setDueDate(e.target.value)} className={field} aria-label="Due date" />
          <button type="submit" disabled={busy || !title.trim()} className="rounded-lg bg-marigold px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Adding…' : 'Add task'}</button>
          {assignee === '__new' && (
            <div className="sm:col-span-4">
              <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Their email" className={`${field} w-full`} aria-label="Email" />
              <p className="mt-1 text-xs text-muted">They'll join this event's team as a <strong>Helper</strong>: they can see the event and complete tasks assigned to them, but can't change anything else.</p>
            </div>
          )}
        </form>
      )}
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`mt-2 text-sm ${msg.ok ? 'text-green-700' : 'text-magenta'}`}>{msg.text}</p>}

      {visible.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-muted">{tasks.length === 0 ? 'No tasks yet.' : 'Nothing open here.'}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {visible.map((t) => {
            const mine = (t.assigned_to ?? '').toLowerCase() === (user?.email ?? '').toLowerCase();
            const canUpdate = canManage || mine;
            const overdue = t.due_date && t.due_date < today && t.status !== 'completed';
            return (
              <li key={t.id} className={`flex items-start gap-3 rounded-xl border bg-white p-3 ${t.status === 'completed' ? 'border-gray-100 opacity-60' : 'border-gray-200'}`}>
                <input type="checkbox" checked={t.status === 'completed'} disabled={!canUpdate} onChange={(e) => setStatus(t, e.target.checked ? 'completed' : 'todo')}
                  aria-label={`Mark "${t.title}" done`} className="mt-0.5 h-5 w-5 shrink-0 accent-marigold" />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium text-gray-900 ${t.status === 'completed' ? 'line-through' : ''}`}>{t.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
                    {canManage ? (
                      <select value={(t.assigned_to ?? '').toLowerCase()} onChange={(e) => reassign(t, e.target.value)} className="-ml-1 rounded border-0 bg-transparent p-0.5 text-xs text-gray-600" aria-label="Assigned to">
                        <option value="">Unassigned</option>
                        {team.map((m) => <option key={m.email} value={m.email}>{m.full_name || m.email}</option>)}
                        {t.assigned_to && !team.some((m) => m.email === t.assigned_to?.toLowerCase()) && <option value={t.assigned_to.toLowerCase()}>{t.assigned_to}</option>}
                      </select>
                    ) : <span>{mine ? 'You' : nameOf(t.assigned_to)}</span>}
                    {t.due_date && <span className={overdue ? 'font-semibold text-red-600' : ''}>· due {new Date(t.due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{overdue ? ' (overdue)' : ''}</span>}
                    {t.scout_card_id && <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">from scouting</span>}
                  </p>
                </div>
                {canUpdate && t.status !== 'completed' && (
                  <select value={t.status} onChange={(e) => setStatus(t, e.target.value as TaskStatus)} className="shrink-0 rounded-lg border border-gray-200 bg-white px-1.5 py-1 text-xs text-gray-600" aria-label="Status">
                    {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                )}
                {canManage && <button onClick={() => remove(t)} aria-label="Delete task" className="shrink-0 px-1 text-gray-300 hover:text-red-600">✕</button>}
              </li>
            );
          })}
        </ul>
      )}
      {doneCount > 0 && <button onClick={() => setShowDone((v) => !v)} className="mt-2 text-xs font-medium text-gray-500">{showDone ? 'Hide' : 'Show'} done ({doneCount})</button>}
    </section>
  );
}
