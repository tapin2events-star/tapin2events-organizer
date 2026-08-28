import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import type { EventTask, TaskStatus } from '../../lib/types';

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  completed: 'Completed',
};

export default function TasksTab({ eventId }: { eventId: string }) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<EventTask[]>([]);
  const [title, setTitle] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase
      .from('event_tasks')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });
    setTasks((data ?? []) as EventTask[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [eventId]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !user?.email) return;
    await supabase.from('event_tasks').insert({
      event_id: eventId,
      title,
      assigned_to: assignedTo || null,
      assigned_by: user.email,
      due_date: dueDate || null,
    });
    setTitle('');
    setAssignedTo('');
    setDueDate('');
    load();
  }

  async function updateStatus(taskId: string, status: TaskStatus) {
    await supabase.from('event_tasks').update({ status }).eq('id', taskId);
    load();
  }

  async function remove(taskId: string) {
    await supabase.from('event_tasks').delete().eq('id', taskId);
    load();
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3 rounded-xl bg-surface p-4">
        <label className="flex flex-1 min-w-[160px] flex-col gap-1 text-xs text-muted">
          Task
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Confirm sound equipment"
            className="rounded-lg border border-gray-300 bg-surface2 px-3 py-2 text-sm text-bone outline-none focus-visible:border-marigold"
          />
        </label>
        <label className="flex w-44 flex-col gap-1 text-xs text-muted">
          Assign to (email)
          <input
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            placeholder="teammate@email.com"
            className="rounded-lg border border-gray-300 bg-surface2 px-3 py-2 text-sm text-bone outline-none focus-visible:border-marigold"
          />
        </label>
        <label className="flex w-40 flex-col gap-1 text-xs text-muted">
          Due date
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="rounded-lg border border-gray-300 bg-surface2 px-3 py-2 text-sm text-bone outline-none focus-visible:border-marigold"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-ink hover:bg-marigold/90"
        >
          Add task
        </button>
      </form>

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-muted">No tasks yet. Add one above to start organizing your team.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-surface px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-bone">{task.title}</p>
                <p className="font-mono text-xs text-muted">
                  {task.assigned_to || 'Unassigned'}
                  {task.due_date ? ` · due ${task.due_date}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={task.status}
                  onChange={(e) => updateStatus(task.id, e.target.value as TaskStatus)}
                  className="rounded-lg border border-gray-300 bg-surface2 px-2 py-1 text-xs text-bone"
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => remove(task.id)}
                  className="text-xs text-magenta hover:text-magenta/80"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
