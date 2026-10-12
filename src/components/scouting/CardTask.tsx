import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import type { TeamMember } from '../../lib/useEventTeam';

// "Make this a task": turn a scouting card into a task on the linked event, assigned
// to a teammate. When they finish it, the card moves to In talks.
export default function CardTask({ cardId, artistName, eventId, onCreated }: { cardId: string; artistName: string; eventId: string; onCreated: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [canAssign, setCanAssign] = useState(false);
  const [title, setTitle] = useState(`Reach out to ${artistName}`);
  const [assignee, setAssignee] = useState('');
  const [due, setDue] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    Promise.all([supabase.rpc('event_team', { p_event_id: eventId }), supabase.rpc('event_team_role', { p_event_id: eventId })]).then(([t, r]) => {
      setTeam((t.data ?? []) as TeamMember[]);
      setCanAssign(['owner', 'admin', 'editor'].includes(String(r.data ?? '')));
    });
  }, [eventId]);
  if (!canAssign) return null;

  async function create() {
    if (!user?.email || !title.trim()) return;
    setMsg(null);
    const { data, error } = await supabase.from('event_tasks').insert({
      event_id: eventId, title: title.trim().slice(0, 200), assigned_to: assignee || null, assigned_by: user.email,
      status: 'todo', due_date: due || null, scout_card_id: cardId,
    }).select('id').single();
    if (error) return setMsg({ ok: false, text: "Couldn't create the task." });
    if (assignee && assignee !== user.email && data?.id) supabase.functions.invoke('send-app-email', { body: { kind: 'task_assigned', task_id: data.id } }).catch(() => {});
    await supabase.from('scout_cards').update({ stage: 'reach_out' }).eq('id', cardId).eq('stage', 'watching');
    setMsg({ ok: true, text: `Task created${assignee ? ` for ${team.find((m) => m.email === assignee)?.full_name || assignee}` : ''}. The card moves to In talks when it's done.` });
    setOpen(false);
    onCreated();
  }

  const field = 'mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900';
  return (
    <div className="mt-3">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="text-sm font-medium text-marigold">+ Make this a task</button>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={field} aria-label="Task" />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={field} aria-label="Assign to">
              <option value="">Unassigned</option>
              {team.map((m) => <option key={m.email} value={m.email}>{m.full_name || m.email}</option>)}
            </select>
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={field} aria-label="Due date" />
          </div>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={create} className="rounded-lg bg-marigold px-3 py-2 text-sm font-semibold text-white">Create task</button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700">Cancel</button>
          </div>
        </div>
      )}
      {msg && <p className={`mt-2 text-xs ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</p>}
    </div>
  );
}
