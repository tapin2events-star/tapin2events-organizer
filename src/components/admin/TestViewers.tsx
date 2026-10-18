import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

// Admin > Preview: accounts that can see published test events (besides admins), for testing as different people.
export default function TestViewers() {
  const [rows, setRows] = useState<{ email: string; name: string | null }[] | null>(null);
  const [email, setEmail] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => { const { data } = await supabase.rpc('test_viewers_list'); setRows((data ?? []) as typeof rows); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  async function set(em: string, add: boolean) {
    setErr(null);
    const { error } = await supabase.rpc('set_test_viewer', { p_email: em, p_add: add });
    if (error) return setErr(error.message && !/function|permission/i.test(error.message) ? error.message : "Couldn't update the list.");
    setEmail(''); load();
  }
  return (
    <section className="rounded-2xl border border-gray-200 bg-surface p-5">
      <h2 className="font-display text-lg font-semibold text-bone">🧪 Test viewers</h2>
      <p className="mt-1 text-sm text-muted">These accounts can see <strong>published test events</strong> (besides admins), so you can test as a buyer, promoter or teammate. Nobody else can see test events.</p>
      {rows === null ? <p className="mt-3 text-sm text-gray-500">Loading…</p> : (
        <ul className="mt-3 flex flex-col gap-1.5">
          {rows.length === 0 && <li className="text-sm text-gray-500">No test viewers yet.</li>}
          {rows.map((r) => (
            <li key={r.email} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
              <span className="min-w-0"><span className="block truncate font-medium text-gray-900">{r.name || r.email}</span>{r.name && <span className="block truncate text-xs text-gray-500">{r.email}</span>}</span>
              <button onClick={() => set(r.email, false)} className="shrink-0 text-xs text-gray-400 hover:text-red-600">Remove</button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex gap-2">
        <input value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && email.trim() && set(email, true)} type="email" placeholder="test.account@email.com" aria-label="Test viewer email"
          className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 sm:text-sm" />
        <button onClick={() => email.trim() && set(email, true)} disabled={!email.trim()} className="rounded-xl bg-[#0F1B3D] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Add</button>
      </div>
      {err && <p role="alert" className="mt-2 text-sm text-red-600">{err}</p>}
    </section>
  );
}
