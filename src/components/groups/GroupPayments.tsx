import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { rpcError } from '../../lib/groups';

interface Row { user_email: string; full_name: string | null; share_pct: number | null; effective_pct: number; payouts_ready: boolean }

// How booking payments are shared, and who still needs to connect payouts.
export default function GroupPayments({ groupId, isOwner }: { groupId: string; isOwner: boolean }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    const { data } = await supabase.rpc('group_split_status', { p_group: groupId });
    const list = (data ?? []) as Row[];
    setRows(list);
    setDraft(Object.fromEntries(list.map((r) => [r.user_email, String(Number(r.effective_pct))])));
  }
  useEffect(() => { load(); }, [groupId]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = Object.values(draft).reduce((n, v) => n + (parseFloat(v) || 0), 0);
  const notReady = (rows ?? []).filter((r) => Number(r.effective_pct) > 0 && !r.payouts_ready);
  const custom = (rows ?? []).some((r) => r.share_pct !== null);

  async function save(equal = false) {
    setBusy(true); setMsg(null);
    const shares = equal ? {} : Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, Math.round((parseFloat(v) || 0) * 100) / 100]));
    const { error } = await supabase.rpc('set_group_shares', { p_group: groupId, p_shares: shares });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: rpcError(error) });
    setEditing(false);
    setMsg({ ok: true, text: equal ? 'Payments are now split equally.' : 'Payment shares saved. They apply to future payments.' });
    load();
  }

  if (!rows) return null;
  return (
    <section className="mt-6 rounded-2xl border border-gray-200 bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-bone">Payments &amp; payouts</h2>
        {isOwner && !editing && <button onClick={() => setEditing(true)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:border-marigold">Edit shares</button>}
      </div>
      <p className="mt-1 text-xs text-muted">
        When an organizer pays a booking, each member gets their share sent to their own bank through Stripe. {custom ? 'Shares are set by the owner.' : 'Right now it\u2019s split equally.'} Shares are locked once a payment starts, so changes only affect future payments.
      </p>
      {notReady.length > 0 && (
        <p className="mt-3 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-900">
          {notReady.length === 1 ? '1 member hasn\u2019t' : `${notReady.length} members haven\u2019t`} connected payouts yet. Organizers can't pay the group until everyone with a share is connected.
        </p>
      )}
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`mt-3 rounded-lg px-3 py-2 text-sm ${msg.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{msg.text}</p>}
      <ul className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
        {rows.map((r) => {
          const me = r.user_email === user?.email;
          return (
            <li key={r.user_email} className="flex flex-wrap items-center gap-3 p-3">
              <span className="min-w-0 flex-1 truncate text-sm text-gray-900">{r.full_name || 'TapIN member'}{me && <span className="text-gray-400"> (you)</span>}</span>
              {Number(r.effective_pct) > 0 || editing ? (
                r.payouts_ready
                  ? <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">Payouts connected</span>
                  : me
                    ? <Link to="/profile#payouts" className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800 underline">Connect payouts</Link>
                    : <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">Needs to connect</span>
              ) : <span className="text-xs text-gray-400">No share</span>}
              {editing ? (
                <label className="flex items-center gap-1 text-sm text-gray-700">
                  <input type="number" min="0" max="100" step="0.01" inputMode="decimal" value={draft[r.user_email] ?? ''} aria-label={`Share for ${r.full_name || 'member'}`}
                    onChange={(e) => setDraft({ ...draft, [r.user_email]: e.target.value })}
                    className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-right text-base text-gray-900" />%
                </label>
              ) : (
                <span className="w-14 text-right text-sm font-semibold text-gray-900">{Number(r.effective_pct).toFixed(Number(r.effective_pct) % 1 ? 1 : 0)}%</span>
              )}
            </li>
          );
        })}
      </ul>
      {editing && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={`text-sm font-medium ${Math.abs(total - 100) < 0.01 ? 'text-green-700' : 'text-red-600'}`}>Total {Math.round(total * 100) / 100}%</span>
          <button disabled={busy || Math.abs(total - 100) >= 0.01} onClick={() => save(false)} className="rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save shares</button>
          <button disabled={busy} onClick={() => save(true)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700">Split equally</button>
          <button disabled={busy} onClick={() => { setEditing(false); load(); }} className="text-sm text-muted">Cancel</button>
          <p className="w-full text-xs text-muted">Give 0% to anyone who shouldn't be paid per booking (like a manager paid another way).</p>
        </div>
      )}
    </section>
  );
}
