import { useCallback, useEffect, useState } from 'react';
export type InviteKind = 'group' | 'org' | 'claim' | 'manager';
import { supabase } from '../../lib/supabaseClient';
import { toast, toastError } from '../../lib/toast';

// Invites for people who aren't on TapIN yet (artist groups and organizations): send an invite email, and see pending
// invites with Resend and Cancel. Shown on the group's Manage page and the organization's Team tab.
interface Pending { id: string; email: string; name: string | null; role: string; title: string | null; sent_at: string | null; created_at: string }
const reason = async (error: unknown, fallback: string) => {
  try { const j = await (error as { context?: Response }).context?.clone().json(); if (j?.error) return String(j.error); } catch { /* none */ }
  return (error as { message?: string } | null)?.message ?? fallback;
};

export async function sendEmailInvite(kind: InviteKind, targetId: string, p: { email: string; name?: string; role: string; title?: string; note?: string }): Promise<string | null> {
  const { data: id, error } = await supabase.rpc('create_email_invite', { p_kind: kind, p_target: targetId, p_email: p.email, p_name: p.name || null, p_role: p.role, p_title: p.title || null, p_note: p.note || null });
  if (error || !id) return error?.message ?? 'Couldn\u2019t create the invite.';
  const { error: sErr } = await supabase.functions.invoke('email-invites', { body: { action: 'send', id } });
  if (sErr) return await reason(sErr, 'The invite was created, but the email couldn\u2019t be sent. Use Resend.');
  return null;
}

// "They're not on TapIN yet": name and an optional note, then send.
export function InviteByEmailForm({ kind, targetId, email, role, title, onSent, onCancel }: { kind: InviteKind; targetId: string; email: string; role: string; title?: string; onSent: () => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
      <p className="text-sm font-semibold text-indigo-950">{email} isn&apos;t on TapIN yet</p>
      <p className="text-xs text-indigo-900">We&apos;ll email them an invite. They can sign up in a minute (no password) and join right away.</p>
      <div className="mt-3 flex flex-col gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Their name (optional)" aria-label="Their name" className="min-h-[44px] rounded-xl border border-gray-300 bg-white px-3 text-base text-gray-900 sm:text-sm" />
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} placeholder="Add a personal note (optional)" aria-label="Personal note" className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 sm:text-sm" />
        <div className="flex gap-2">
          <button disabled={busy} onClick={async () => { setBusy(true); const err = await sendEmailInvite(kind, targetId, { email, name, role, title, note }); setBusy(false); if (err) return toastError(err); toast(`📧 Invite emailed to ${email}`); onSent(); }}
            className="min-h-[44px] flex-1 rounded-full bg-indigo-600 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Sending…' : 'Send invite email'}</button>
          <button onClick={onCancel} className="min-h-[44px] rounded-full border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700">Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function PendingEmailInvites({ kind, targetId, refreshKey }: { kind: InviteKind; targetId: string; refreshKey?: unknown }) {
  const [list, setList] = useState<Pending[]>([]);
  const load = useCallback(() => { supabase.rpc('pending_email_invites', { p_kind: kind, p_target: targetId }).then(({ data }) => setList((data ?? []) as Pending[])); }, [kind, targetId]);
  useEffect(() => { load(); }, [load, refreshKey]);
  if (list.length === 0) return null;
  return (
    <div className="mt-4">
      <p className="text-sm font-semibold text-gray-900">Invited · not on TapIN yet</p>
      <ul className="mt-2 divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
        {list.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-gray-900">{i.name || i.email}</span>
              <span className="block truncate text-xs text-gray-500">{i.name ? `${i.email} · ` : ''}{i.title || i.role} · {i.sent_at ? `emailed ${new Date(i.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'not sent yet'}</span></span>
            <button onClick={async () => { const { error } = await supabase.functions.invoke('email-invites', { body: { action: 'send', id: i.id } }); if (error) return toastError(await reason(error, 'Couldn\u2019t resend.')); toast('Invite resent'); load(); }}
              className="min-h-[36px] rounded-full border border-gray-300 px-3 text-xs font-medium text-gray-700">Resend</button>
            <button onClick={async () => { const { error } = await supabase.rpc('cancel_email_invite', { p_id: i.id }); if (error) return toastError(error.message); toast('Invite cancelled'); load(); }}
              className="min-h-[36px] rounded-full border border-red-200 px-3 text-xs font-medium text-red-700">Cancel</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
