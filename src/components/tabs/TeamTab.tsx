import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import type { CollaborationRole, EventCollaboration } from '../../lib/types';

export default function TeamTab({ eventId }: { eventId: string; eventTitle?: string }) {
  const { user } = useAuth();
  const [collabs, setCollabs] = useState<EventCollaboration[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<CollaborationRole>('editor');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resentId, setResentId] = useState<string | null>(null);

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

  // The server builds the invite email and checks you're the organizer.
  async function sendInviteEmail(collaborationId: string) {
    const { error } = await supabase.functions.invoke('send-app-email', { body: { kind: 'team_invite', collaboration_id: collaborationId } });
    if (error) throw error;
  }

  async function resendInvite(collabId: string) {
    setResendingId(collabId);
    setResentId(null);
    try {
      await sendInviteEmail(collabId);
      setResentId(collabId);
    } catch (e) {
      console.error('Resend invite email failed:', e);
      setError('Could not resend the invite email. Please try again.');
    }
    setResendingId(null);
  }

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !user?.email) return;
    setError(null);
    const invitedEmail = email.trim().toLowerCase();

    // The event_collaborations row is just a record of the invite -- actual
    // access is granted separately. Admin/Editor/Viewer get full access via
    // events.collaborators (the array RLS checks for tickets, orders, tasks,
    // and vendor apps). Vendor Manager is narrower on purpose: it only sets
    // permissions=['manage_vendors'], which a dedicated RLS policy checks
    // for vendor applications specifically -- it does NOT touch
    // events.collaborators, so a vendor manager can't see tickets/orders/tasks.
    if (role !== 'vendor_manager') {
      const { data: currentEvent, error: fetchError } = await supabase
        .from('events')
        .select('collaborators')
        .eq('id', eventId)
        .single();
      if (fetchError) {
        setError(fetchError.message);
        return;
      }
      const existingCollaborators: string[] = currentEvent?.collaborators ?? [];
      if (!existingCollaborators.includes(invitedEmail)) {
        const { error: grantError } = await supabase
          .from('events')
          .update({ collaborators: [...existingCollaborators, invitedEmail] })
          .eq('id', eventId);
        if (grantError) {
          setError(grantError.message);
          return;
        }
      }
    }

    const { data: inserted, error } = await supabase.from('event_collaborations').insert({
      event_id: eventId,
      collaborator_email: invitedEmail,
      role,
      permissions: role === 'vendor_manager' ? ['manage_vendors'] : [],
      invited_by: user.email,
    }).select('id').single();
    if (error) {
      setError(error.message);
      return;
    }
    setEmail('');
    load();

    try {
      if (inserted?.id) await sendInviteEmail(inserted.id);
    } catch (e) {
      console.error('Team invite email failed:', e);
    }
  }

  async function remove(id: string, collaboratorEmail: string) {
    const { data: currentEvent } = await supabase.from('events').select('collaborators').eq('id', eventId).single();
    const remaining = (currentEvent?.collaborators ?? []).filter((e: string) => e !== collaboratorEmail);
    await supabase.from('events').update({ collaborators: remaining }).eq('id', eventId);
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
            <option value="vendor_manager">Vendor Manager</option>
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
                  {c.role === 'vendor_manager' ? 'Vendor Manager (vendor applications only)' : c.role} · {c.status}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => resendInvite(c.id)}
                  disabled={resendingId === c.id}
                  className="text-xs text-marigold hover:text-marigold/80 disabled:opacity-50"
                >
                  {resendingId === c.id ? 'Sending…' : resentId === c.id ? 'Sent!' : 'Resend invite'}
                </button>
                <button onClick={() => remove(c.id, c.collaborator_email)} className="text-xs text-magenta hover:text-magenta/80">
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
