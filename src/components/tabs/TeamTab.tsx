import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import type { CollaborationRole, EventCollaboration } from '../../lib/types';

export default function TeamTab({ eventId, eventTitle }: { eventId: string; eventTitle: string }) {
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
    const invitedEmail = email.trim().toLowerCase();

    // The event_collaborations row is just a record of the invite --
    // actual access is granted by events.collaborators, the array RLS
    // checks for permission on tickets, orders, tasks, and vendor apps.
    // Both need updating, or the invite would look successful while
    // granting no real access.
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

    const { error } = await supabase.from('event_collaborations').insert({
      event_id: eventId,
      collaborator_email: invitedEmail,
      role,
      invited_by: user.email,
    });
    if (error) {
      setError(error.message);
      return;
    }
    const invitedRole = role;
    setEmail('');
    load();

    const eventUrl = `${window.location.origin}${import.meta.env.BASE_URL}organizer/events/${eventId}`;
    const html = `<div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#4f46e5,#14b8a6);padding:24px;color:white;">
        <div style="font-size:20px;font-weight:800;">TapIN</div>
        <div style="margin-top:8px;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;opacity:0.9;">You've been invited to help organize an event</div>
      </div>
      <div style="padding:24px;">
        <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">${eventTitle}</h1>
        <p style="font-size:14px;color:#374151;">${user.email} has invited you to help manage this event on TapIN as a <strong>${invitedRole}</strong>.</p>
        <p style="margin-top:8px;font-size:13px;color:#6b7280;">Sign in with this email address (${invitedEmail}) to access it.</p>
        <a href="${eventUrl}" style="display:block;text-align:center;margin-top:16px;background:linear-gradient(135deg,#4f46e5,#14b8a6);color:#ffffff;padding:12px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px;">Go to Event</a>
      </div>
    </div>`;
    try {
      await supabase.functions.invoke('send-ticket-confirmation', {
        body: { to: invitedEmail, subject: `You've been invited to help organize ${eventTitle}`, html },
      });
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
              <button onClick={() => remove(c.id, c.collaborator_email)} className="text-xs text-magenta hover:text-magenta/80">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
