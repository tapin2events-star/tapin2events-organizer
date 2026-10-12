import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export interface MyTask { id: string; event_id: string; event_title: string | null; event_date: string | null; title: string; status: string; due_date: string | null; assigned_by_name: string | null; assigned_by: string | null }

export async function loadMyTasks(): Promise<MyTask[]> {
  const { data } = await supabase.rpc('my_tasks');
  return (data ?? []) as MyTask[];
}

// My Activity > Tasks: everything assigned to me, across every event.
export default function MyTasks({ initial, onChange }: { initial: MyTask[]; onChange?: (open: number) => void }) {
  const [tasks, setTasks] = useState<MyTask[]>(initial);
  const [showDone, setShowDone] = useState(false);
  useEffect(() => setTasks(initial), [initial]);
  const today = new Date().toISOString().slice(0, 10);

  async function toggle(t: MyTask, done: boolean) {
    const status = done ? 'completed' : 'todo';
    const next = tasks.map((x) => (x.id === t.id ? { ...x, status } : x));
    setTasks(next);
    onChange?.(next.filter((x) => x.status !== 'completed').length);
    await supabase.from('event_tasks').update({ status }).eq('id', t.id);
  }

  const open = tasks.filter((t) => t.status !== 'completed');
  const done = tasks.filter((t) => t.status === 'completed');
  const list = showDone ? [...open, ...done] : open;
  return (
    <div>
      <h2 className="mt-8 font-display text-xl font-bold text-gray-900">Tasks</h2>
      {list.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">You're all caught up.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {list.map((t) => {
            const overdue = t.due_date && t.due_date < today && t.status !== 'completed';
            return (
              <li key={t.id} className={`flex items-start gap-3 rounded-xl border bg-white p-3 ${t.status === 'completed' ? 'border-gray-100 opacity-60' : 'border-gray-200'}`}>
                <input type="checkbox" checked={t.status === 'completed'} onChange={(e) => toggle(t, e.target.checked)} aria-label={`Mark "${t.title}" done`} className="mt-0.5 h-5 w-5 shrink-0 accent-marigold" />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium text-gray-900 ${t.status === 'completed' ? 'line-through' : ''}`}>{t.title}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    <Link to={`/organizer/events/${t.event_id}`} className="font-medium text-marigold hover:underline">{t.event_title ?? 'Event'}</Link>
                    {t.due_date && <span className={overdue ? ' font-semibold text-red-600' : ''}> · due {new Date(t.due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{overdue ? ' (overdue)' : ''}</span>}
                    {t.assigned_by_name && <span> · from {t.assigned_by_name}</span>}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {done.length > 0 && <button onClick={() => setShowDone((v) => !v)} className="mt-2 text-xs font-medium text-gray-500">{showDone ? 'Hide' : 'Show'} done ({done.length})</button>}
    </div>
  );
}
