import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import type { CollaborationRole, EventCollaboration } from '../../lib/types';

export default function TeamTab({ eventId }: { eventId: string }) {
  const { user } = useAuth();
  const [collabs, setCollabs] = useState<EventCollaboration[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<CollaborationRole>('editor');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase
      .from('event_collaborations')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });
    setCollabs((data ?? []) as EventCollaboration[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [eventId]);

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !user?.email) return;
    setError(null);
    const { error } = await supabase.from('event_collaborations').insert({
      event_id: eventId,
      collaborator_email: email,
      role,
      invited_by: user.email,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setEmail('');
    load();
  }

  async function remove(id: string) {
    await supabase.from('event_collaborations').delete().eq('id', id);
    load();
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-3 rounded-xl bg-surface p-4">
        <label className="flex flex-1 min-w-[200px] flex-col gap-1 text-xs text-muted">
          Invite by email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="collaborator@email.com"
            className="rounded-lg border border-gray-300 bg-surface2 px-3 py-2 text-sm text-bone outline-none focus-visible:border-marigold"
          />
        </label>
        <label className="flex w-36 flex-col gap-1 text-xs text-muted">
          Role
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as CollaborationRole)}
            className="rounded-lg border border-gray-300 bg-surface2 px-3 py-2 text-sm text-bone"
          >
            <option value="admin">Admin</option>
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-ink hover:bg-marigold/90"
        >
          Send invite
        </button>
      </form>

      {error && <p className="text-sm text-magenta">{error}</p>}

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : collabs.length === 0 ? (
        <p className="text-sm text-muted">No collaborators yet. Invite your team above.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {collabs.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-xl bg-surface px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-bone">{c.collaborator_email}</p>
                <p className="font-mono text-xs text-muted">
                  {c.role} · {c.status}
                </p>
              </div>
              <button onClick={() => remove(c.id)} className="text-xs text-magenta hover:text-magenta/80">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
