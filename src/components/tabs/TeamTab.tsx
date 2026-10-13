import { useEffect, useState, type FormEvent } from 'react';
import { ListSkeleton } from '../ui/Skeleton';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import type { CollaborationRole, EventCollaboration } from '../../lib/types';
import { ROLE_LABEL, type TeamMember } from '../../lib/useEventTeam';

const ROLE_HELP: Record<string, string> = {
  admin: 'Everything, including managing the team',
  editor: 'Edit the event, lineup, scouting and tasks',
  viewer: 'See everything, change nothing',
  helper: 'See the event and complete tasks assigned to them',
  vendor_manager: 'Vendor applications only (plus their own tasks)',
};

export default function TeamTab({ eventId, team = [], canManageTeam = true, filter, onPick, onChanged }: {
  eventId: string; eventTitle?: string; team?: TeamMember[]; canManageTeam?: boolean; filter?: string; onPick?: (email: string) => void; onChanged?: () => void;
}) {
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
    if (role !== 'vendor_manager' && role !== 'helper') {
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
    onChanged?.();

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
    onChanged?.();
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-display text-xl font-bold text-bone">People</h2>
      {canManageTeam && <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-3 rounded-xl bg-surface p-4">
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
            <option value="helper">Helper</option>
            <option value="vendor_manager">Vendor Manager</option>
          </select>
          <span className="text-[11px] leading-tight text-muted">{ROLE_HELP[role]}</span>
        </label>
        <button
          type="submit"
          className="rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-ink hover:bg-marigold/90"
        >
          Send invite
        </button>
      </form>}

      {error && <p className="text-sm text-magenta">{error}</p>}

      {loading ? (
        <ListSkeleton rows={4} className="mt-4" />
      ) : collabs.length === 0 ? (
        <p className="text-sm text-muted">{canManageTeam ? 'No one else yet. Invite your team above.' : 'No one else on this team yet.'}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {collabs.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-xl bg-surface px-4 py-3"
            >
              {(() => {
                const m = team.find((x) => x.email === c.collaborator_email.toLowerCase());
                const selected = filter === c.collaborator_email.toLowerCase();
                return (
                  <button type="button" onClick={() => onPick?.(selected ? 'all' : c.collaborator_email.toLowerCase())} className="flex min-w-0 items-center gap-3 text-left" title="Show their tasks">
                    {m?.profile_photo ? <img src={m.profile_photo} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" /> : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-bold text-gray-600">{(m?.full_name || c.collaborator_email).charAt(0).toUpperCase()}</span>}
                    <span className="min-w-0">
                      <span className={`block truncate text-sm font-medium ${selected ? 'text-marigold' : 'text-bone'}`}>{m?.full_name || c.collaborator_email}</span>
                      <span className="block text-xs text-muted">
                        {ROLE_LABEL[c.role] ?? c.role}{c.status && c.status !== 'accepted' ? ` · ${c.status}` : ''}
                        {m ? ` · ${m.open_tasks} open task${m.open_tasks === 1 ? '' : 's'}` : ''}
                      </span>
                    </span>
                  </button>
                );
              })()}
              {canManageTeam && <div className="flex items-center gap-3">
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
              </div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
