import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Sheet from '../scouting/Sheet';

// Admin → Users: delete someone's account (e.g. one made with a wrong email). Uses the same delete-account process as
// people deleting their own account: first a check (anything that blocks it, and what will happen), then type DELETE.
// Emailing them is optional and off by default (a wrong address would just bounce).
interface Check { blockers: string[]; warnings: string[]; email: string; name: string | null }
export default function AdminDeleteAccount({ userId, label, onClose, onDeleted }: { userId: string; label: string; onClose: () => void; onDeleted: () => void }) {
  const [check, setCheck] = useState<Check | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [notify, setNotify] = useState(false);
  const [busy, setBusy] = useState(false);
  const reason = async (error: unknown, fallback: string) => {
    try { const j = await (error as { context?: Response }).context?.clone().json(); if (j?.blockers?.length) return j.blockers.join(' '); if (j?.error) return String(j.error); } catch { /* fall through */ }
    return fallback;
  };
  useEffect(() => {
    supabase.functions.invoke('delete-account', { body: { action: 'check', target_user_id: userId } }).then(async ({ data, error }) => {
      if (error) setErr(await reason(error, 'Couldn\u2019t check this account.')); else setCheck(data as Check);
    });
  }, [userId]);
  async function del() {
    setBusy(true); setErr(null);
    const { error } = await supabase.functions.invoke('delete-account', { body: { action: 'delete', confirm: 'DELETE', target_user_id: userId, notify } });
    setBusy(false);
    if (error) return setErr(await reason(error, 'Couldn\u2019t delete the account.'));
    onDeleted();
  }
  const blocked = !!check?.blockers.length;
  return (
    <Sheet title={`Delete ${label}?`} onClose={busy ? () => undefined : onClose}>
      {!check && !err && <p className="py-4 text-sm text-gray-500">Checking the account…</p>}
      {check && (
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-gray-700">{check.name ? <><strong>{check.name}</strong> · </> : null}{check.email}</p>
          {blocked ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-800">
              <p className="font-semibold">This account can&apos;t be deleted yet:</p>
              <ul className="mt-1 list-disc pl-5">{check.blockers.map((b) => <li key={b}>{b}</li>)}</ul>
            </div>
          ) : (
            <>
              <div className="rounded-xl bg-gray-50 p-3 text-gray-700">
                <p className="font-semibold text-gray-900">What happens</p>
                <ul className="mt-1 list-disc pl-5">
                  <li>Their profile, photos, posts and videos are deleted, and their login is closed.</li>
                  <li>Records others rely on (tickets, orders, payments, past events) are kept without their name or email.</li>
                  {check.warnings.map((w) => <li key={w}>{w}</li>)}
                </ul>
              </div>
              <label className="flex items-start gap-2 text-gray-700">
                <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-red-600" />
                <span>Email them that their account was deleted <span className="text-gray-500">(leave off for wrong email addresses)</span></span>
              </label>
              <label className="text-gray-700">Type <strong>DELETE</strong> to confirm
                <input value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="characters" className="mt-1 block min-h-[44px] w-full rounded-xl border border-gray-300 px-3 text-base text-gray-900" />
              </label>
              <button onClick={del} disabled={typed !== 'DELETE' || busy} className="min-h-[48px] rounded-full bg-red-600 text-sm font-semibold text-white disabled:opacity-40">{busy ? 'Deleting…' : 'Delete this account permanently'}</button>
            </>
          )}
        </div>
      )}
      {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
    </Sheet>
  );
}
