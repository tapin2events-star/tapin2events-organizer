import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useEscapeKey } from '../lib/useEscapeKey';

async function call(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('delete-account', { body });
  if (error) {
    let payload: { error?: string; blockers?: string[] } = {};
    try { payload = await (error as { context?: Response }).context?.json() ?? {}; } catch { /* keep generic */ }
    return { error: payload.error ?? 'Something went wrong. Please try again.', blockers: payload.blockers };
  }
  return data;
}

// Profile > Delete account: shows what will happen, anything that must be
// resolved first, and requires typing DELETE.
export default function DeleteAccountSection() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [check, setCheck] = useState<{ blockers: string[]; warnings: string[] } | null>(null);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEscapeKey(() => !deleting && setOpen(false), open);

  async function start() {
    setOpen(true); setLoading(true); setError(null); setTyped(''); setCheck(null);
    const r = await call({ action: 'check' });
    setLoading(false);
    if (r?.error) setError(r.error);
    else setCheck(r);
  }

  async function confirmDelete() {
    setDeleting(true); setError(null);
    const r = await call({ action: 'delete', confirm: 'DELETE' });
    if (r?.deleted) {
      await supabase.auth.signOut().catch(() => {});
      navigate('/login?deleted=1', { replace: true });
      return;
    }
    setDeleting(false);
    if (r?.blockers) setCheck((c) => ({ blockers: r.blockers!, warnings: c?.warnings ?? [] }));
    setError(r?.error === 'blocked' ? null : r?.error ?? 'Something went wrong. Please try again.');
  }

  return (
    <div className="mt-12 border-t border-gray-200 pt-6">
      <h2 className="font-display text-lg font-semibold text-bone">Delete account</h2>
      <p className="mt-1 text-sm text-muted">Permanently delete your TapIN account and personal information.</p>
      <button type="button" onClick={start} className="mt-3 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">
        Delete my account
      </button>

      {open && (
        <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={() => !deleting && setOpen(false)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Delete account">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-xl font-bold text-gray-900">Delete your account?</h3>
              <button type="button" onClick={() => !deleting && setOpen(false)} aria-label="Close" className="-mr-1 -mt-1 flex h-10 w-10 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100">✕</button>
            </div>

            {loading ? (
              <p className="mt-4 text-sm text-gray-500">Checking your account…</p>
            ) : check ? (
              <>
                {check.blockers.length > 0 ? (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                    <p className="text-sm font-semibold text-red-800">Before you can delete your account:</p>
                    <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-red-800">
                      {check.blockers.map((b) => <li key={b}>{b}</li>)}
                    </ul>
                  </div>
                ) : (
                  <>
                    <p className="mt-3 text-sm text-gray-700">
                      This permanently deletes your profile, photos, posts and videos, follows, and notifications. It can't be undone.
                    </p>
                    <p className="mt-2 text-sm text-gray-700">
                      Payment and ticket records we're required to keep stay on file without your name or email.
                    </p>
                  </>
                )}
                {check.warnings.length > 0 && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-semibold text-amber-900">What else happens</p>
                    <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-amber-900">
                      {check.warnings.map((w) => <li key={w}>{w}</li>)}
                    </ul>
                  </div>
                )}
                {check.blockers.length === 0 && (
                  <>
                    <label htmlFor="confirm-delete" className="mt-5 block text-sm font-medium text-gray-900">Type <span className="font-mono font-bold">DELETE</span> to confirm</label>
                    <input id="confirm-delete" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="characters"
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-base text-gray-900 outline-none focus:border-red-400" />
                  </>
                )}
              </>
            ) : null}

            {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setOpen(false)} disabled={deleting} className="rounded-lg border border-gray-300 py-2.5 text-sm font-semibold text-gray-800">
                {check?.blockers.length ? 'Close' : 'Keep my account'}
              </button>
              <button type="button" onClick={confirmDelete} disabled={deleting || loading || !check || check.blockers.length > 0 || typed.trim().toUpperCase() !== 'DELETE'}
                className="rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40">
                {deleting ? 'Deleting…' : 'Delete my account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
