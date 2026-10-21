import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

// Transfer ownership of an event or an organization. The new owner gets an email and accepts while signed in with
// that email; until then nothing changes, and the transfer can be cancelled. By default you stay on as an Admin.
export default function TransferOwnershipSheet({ kind, targetId, name, onClose }: { kind: 'event' | 'organization'; targetId: string; name: string; onClose: () => void }) {
  const [pending, setPending] = useState<{ to_email: string; keep_access: boolean; created_at: string } | null | undefined>(undefined);
  const [email, setEmail] = useState('');
  const [keep, setKeep] = useState(true);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const what = kind === 'event' ? 'event' : 'organization';
  const load = () => supabase.rpc('pending_ownership_transfer', { p_kind: kind, p_target: targetId }).then(({ data }) => setPending((data ?? null) as typeof pending));
  useEffect(() => { load(); }, [kind, targetId]); // eslint-disable-line react-hooks/exhaustive-deps
  async function send() {
    setBusy(true); setErr(null);
    const { data, error } = await supabase.functions.invoke('ownership-transfer', { body: { kind, target_id: targetId, to_email: email.trim(), keep_access: keep, note: note.trim() || null } });
    let msg: string | null = data?.error ?? null;
    if (!msg && error) { try { msg = (await (error as { context?: Response }).context?.json())?.error ?? 'Something went wrong.'; } catch { msg = 'Something went wrong.'; } }
    setBusy(false);
    if (msg) return setErr(msg);
    setSent(email.trim().toLowerCase());
    load();
  }
  async function cancel() {
    if (!window.confirm('Cancel this ownership transfer? The link they received will stop working.')) return;
    setBusy(true);
    const { error } = await supabase.rpc('cancel_ownership_transfer', { p_kind: kind, p_target: targetId });
    setBusy(false);
    if (error) return setErr(error.message);
    setSent(null); load();
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Transfer ownership" onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl" style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-gray-900">🔑 Transfer ownership</h2>
            <p className="mt-0.5 text-sm text-gray-500 [overflow-wrap:anywhere]">{name}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-2xl leading-none text-gray-400">×</button>
        </div>
        {pending === undefined ? (
          <p className="mt-4 text-sm text-gray-500">Loading…</p>
        ) : pending ? (
          <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">{sent ? '✓ Sent!' : 'Waiting for them to accept'}</p>
            <p className="mt-1 [overflow-wrap:anywhere]">We emailed <strong>{pending.to_email}</strong> a link to accept. Nothing changes until they do{pending.keep_access ? ', and you\u2019ll stay on as an Admin' : ''}.</p>
            <button onClick={cancel} disabled={busy} className="mt-3 text-sm font-semibold text-amber-900 underline disabled:opacity-50">Cancel transfer</button>
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-sm text-gray-600">Make someone else the owner of this {what}. They&apos;ll get an email to accept (they can sign up free if they&apos;re new to TapIN). Nothing changes until they accept.</p>
            <label className="mt-4 block text-sm font-medium text-gray-700">New owner&apos;s email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" autoCapitalize="none" autoCorrect="off"
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-base text-gray-900 sm:text-sm" />
            </label>
            <label className="mt-3 block text-sm font-medium text-gray-700">Note <span className="font-normal text-gray-400">(optional)</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Here's your event, all set up for you!"
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-base text-gray-900 sm:text-sm" />
            </label>
            <label className="mt-3 flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} className="mt-0.5 h-4 w-4 accent-marigold" />
              <span>Keep me on as an Admin after the transfer <span className="block text-xs text-gray-500">Uncheck to step away completely.</span></span>
            </label>
            {kind === 'event' && <p className="mt-3 rounded-xl bg-gray-50 p-3 text-xs text-gray-600">Ticket sales after the transfer are paid to the new owner{''} (or the event&apos;s organization, if it belongs to one). Sales before it stay with you.</p>}
            {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
            <button onClick={send} disabled={busy || !email.trim()} className="mt-4 w-full rounded-xl bg-[#0F1B3D] py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Sending…' : 'Send transfer request'}</button>
          </div>
        )}
      </div>
    </div>
  );
}
