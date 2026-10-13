import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import Sheet from '../scouting/Sheet';

interface TeamMember { email: string; full_name: string | null; role: string; status: string | null }
export interface TaskEventOption { id: string; title: string; start_date: string | null }
export interface EditTask { id: string; event_id: string; event_title: string; title: string; due_date: string | null; assigned_to: string | null }

const ROLE_NAME: Record<string, string> = { owner: 'Organizer', admin: 'Admin', editor: 'Editor', viewer: 'Viewer', helper: 'Helper', vendor_manager: 'Vendor Manager' };
const decode = (t: string) => t.replace(/&#8217;|&rsquo;/g, '\u2019').replace(/&amp;/g, '&');
const field = 'mt-1 block w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900';

// Planning > Tasks: create a task for a teammate on one of your events, or reassign an existing one.
export default function PlanningTaskSheet({ events, task, meetingId, onClose, onDone }: { events: TaskEventOption[]; task?: EditTask | null; meetingId?: string; onClose: () => void; onDone: (msg: string) => void }) {
  const { user } = useAuth();
  const editing = !!task;
  const [eventId, setEventId] = useState(task?.event_id ?? events[0]?.id ?? '');
  const [title, setTitle] = useState(task?.title ?? '');
  const [assignee, setAssignee] = useState(task?.assigned_to?.toLowerCase() ?? '');
  const [due, setDue] = useState(task?.due_date ?? '');
  const [team, setTeam] = useState<TeamMember[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // The chosen event's team (organizer, admins, editors, helpers...) to pick the assignee from.
  useEffect(() => {
    if (!eventId) { setTeam([]); return; }
    setTeam(null);
    supabase.rpc('event_team', { p_event_id: eventId }).then(({ data }) => {
      const list = ((data ?? []) as TeamMember[]).filter((m) => !/declined|removed/i.test(m.status ?? '') && m.role !== 'vendor_manager');
      setTeam(list);
      if (!editing && assignee && !list.some((m) => m.email.toLowerCase() === assignee)) setAssignee('');
    });
  }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!user?.email) return;
    if (!title.trim()) return setErr('Write what needs doing.');
    if (!eventId) return setErr('Pick an event.');
    setBusy(true); setErr(null);
    const me = user.email.toLowerCase();
    if (editing && task) {
      const { error } = await supabase.from('event_tasks').update({ title: title.trim().slice(0, 200), assigned_to: assignee || null, due_date: due || null }).eq('id', task.id);
      setBusy(false);
      if (error) return setErr("Couldn't save. You need to be the organizer, an Admin or an Editor of that event.");
      if (assignee && assignee !== (task.assigned_to ?? '').toLowerCase() && assignee !== me) supabase.functions.invoke('send-app-email', { body: { kind: 'task_assigned', task_id: task.id } }).catch(() => {});
      return onDone(assignee && assignee !== (task.assigned_to ?? '').toLowerCase() ? `Reassigned to ${nameOf(assignee)}.` : 'Task updated.');
    }
    const { data, error } = await supabase.from('event_tasks')
      .insert({ event_id: eventId, title: title.trim().slice(0, 200), assigned_to: assignee || null, assigned_by: user.email, status: 'todo', due_date: due || null, ...(meetingId ? { meeting_id: meetingId } : {}) })
      .select('id').single();
    setBusy(false);
    if (error) return setErr("Couldn't add the task. You need to be the organizer, an Admin or an Editor of that event.");
    if (data?.id && assignee && assignee !== me) supabase.functions.invoke('send-app-email', { body: { kind: 'task_assigned', task_id: data.id } }).catch(() => {});
    onDone(assignee ? `Task assigned to ${nameOf(assignee)}.` : 'Task added (unassigned).');
  }
  const nameOf = (email: string) => team?.find((m) => m.email.toLowerCase() === email)?.full_name || email;

  return (
    <Sheet title={editing ? 'Edit task' : meetingId ? 'New action item' : 'New task'} onClose={onClose}>
      <label className="block text-xs font-medium text-gray-500">Task
        <input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="Confirm the sound check time" className={field} autoFocus={!editing} />
      </label>
      <label className="mt-3 block text-xs font-medium text-gray-500">Event
        <select value={eventId} disabled={editing} onChange={(e) => setEventId(e.target.value)} className={`${field} disabled:bg-gray-50`}>
          {events.length === 0 && <option value="">No events you can add tasks to</option>}
          {events.map((e) => <option key={e.id} value={e.id}>{decode(e.title)}{e.start_date ? ` (${new Date(e.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})` : ''}</option>)}
        </select>
      </label>
      <label className="mt-3 block text-xs font-medium text-gray-500">Assign to
        <select value={assignee} onChange={(e) => setAssignee(e.target.value)} disabled={team === null} className={field}>
          <option value="">Unassigned</option>
          {(team ?? []).map((m) => (
            <option key={m.email} value={m.email.toLowerCase()}>
              {m.full_name || m.email}{m.email.toLowerCase() === user?.email?.toLowerCase() ? ' (you)' : ''} · {ROLE_NAME[m.role] ?? m.role}
            </option>
          ))}
        </select>
        <span className="mt-1 block font-normal text-gray-500">Only people on this event's team. Add someone from the event's Team &amp; tasks tab, or the Team tab here.</span>
      </label>
      <label className="mt-3 block text-xs font-medium text-gray-500">Due (optional)<input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={field} /></label>
      {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
      <button onClick={save} disabled={busy || events.length === 0} className="mt-4 w-full rounded-xl bg-marigold py-3 text-sm font-semibold text-white disabled:opacity-50">
        {busy ? 'Saving…' : editing ? 'Save' : assignee ? 'Assign task' : 'Add task'}
      </button>
      {!editing && assignee && <p className="mt-2 text-center text-xs text-gray-500">They'll get a notification and an email.</p>}
    </Sheet>
  );
}
