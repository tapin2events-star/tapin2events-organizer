import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toast, toastError } from '../lib/toast';

// Profile > Other emails: add addresses you also use (confirmed with a 6-digit code). Invitations, lineup spots,
// promotion links, revenue splits and tickets sent to them then show up on this account, with no duplicate account.
interface Row { id: string; email: string; verified: boolean }
const LABELS: Record<string, string> = { org_teams: 'organization team spot', event_teams: 'event team spot', promotion_links: 'promotion link', splits: 'revenue split', lineup: 'lineup spot', tickets: 'ticket' };

export default function OtherEmailsSection() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => { supabase.rpc('my_other_emails').then(({ data }) => setRows((data ?? []) as Row[])); }, []);
  useEffect(() => { load(); }, [load]);
  async function call(body: Record<string, unknown>) {
    setBusy(true); setErr(null);
    const { data, error } = await supabase.functions.invoke('user-emails', { body });
    let msg: string | null = data?.error ?? null;
    if (!msg && error) { try { msg = (await (error as { context?: Response }).context?.json())?.error ?? 'Something went wrong.'; } catch { msg = 'Something went wrong.'; } }
    setBusy(false);
    if (msg) { setErr(msg); return null; }
    return data as { moved?: Record<string, number> };
  }
  async function send(addr: string) {
    const r = await call({ action: 'add', email: addr });
    if (r) { setPending(addr.trim().toLowerCase()); setCode(''); toast(`Code sent to ${addr.trim()}`); load(); }
  }
  async function verify() {
    if (!pending) return;
    const r = await call({ action: 'verify', email: pending, code });
    if (!r) return;
    const moved = Object.entries(r.moved ?? {}).filter(([, n]) => Number(n) > 0).map(([k, n]) => `${n} ${LABELS[k] ?? k}${Number(n) === 1 ? '' : 's'}`);
    toast(moved.length ? `✓ Confirmed. Moved to your account: ${moved.join(', ')}` : '✓ Email confirmed');
    setPending(null); setCode(''); setEmail(''); load();
  }
  async function remove(addr: string) {
    if (!window.confirm(`Remove ${addr}? Anything already moved to your account stays.`)) return;
    if (await call({ action: 'remove', email: addr })) { toast('Email removed'); if (pending === addr) setPending(null); load(); } else toastError();
  }
  const field = 'w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 sm:text-sm';
  return (
    <div>
      <p className="text-sm text-muted">Use more than one email? Add it here. Team invitations, lineup spots, promotion links, revenue splits and tickets sent to it will show up on this account, so you never end up with two accounts.</p>
      {rows && rows.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 bg-surface px-3 py-2">
              <span className="min-w-0 text-sm text-bone [overflow-wrap:anywhere]">{r.email} {r.verified ? <span className="ml-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800">Confirmed</span> : <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Not confirmed</span>}</span>
              <span className="flex gap-3 text-xs">
                {!r.verified && pending !== r.email && <button onClick={() => send(r.email)} disabled={busy} className="font-semibold text-marigold">Send code</button>}
                <button onClick={() => remove(r.email)} disabled={busy} className="text-gray-500 hover:text-red-600">Remove</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {pending ? (
        <div className="mt-3 rounded-xl bg-gray-50 p-3">
          <p className="text-sm text-gray-700">Enter the 6-digit code we sent to <strong className="[overflow-wrap:anywhere]">{pending}</strong>.</p>
          <div className="mt-2 flex gap-2">
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" aria-label="Code" className={`${field} max-w-[10rem] tracking-[0.3em]`} />
            <button onClick={verify} disabled={busy || code.length !== 6} className="rounded-xl bg-marigold px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Checking…' : 'Confirm'}</button>
          </div>
          <button onClick={() => send(pending)} disabled={busy} className="mt-2 text-xs text-gray-500 underline">Send a new code</button>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="another@email.com" autoCapitalize="none" aria-label="Another email" className={field} />
          <button onClick={() => send(email)} disabled={busy || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())} className="shrink-0 rounded-xl bg-[#0F1B3D] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Sending…' : 'Send code'}</button>
        </div>
      )}
      {err && <p role="alert" className="mt-2 text-sm text-red-600">{err}</p>}
    </div>
  );
}
