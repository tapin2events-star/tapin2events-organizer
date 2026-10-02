import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { unblockUser } from '../lib/blocks';
import { useAuth } from '../context/AuthContext';

interface Blocked { email: string; full_name: string | null; profile_photo: string | null }

// Profile > Blocked accounts: everyone you've blocked, with Unblock.
export default function BlockedAccounts() {
  const { user } = useAuth();
  const [list, setList] = useState<Blocked[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc('my_blocked_users').then(({ data }) => setList((data ?? []) as Blocked[]));
  }, []);

  async function unblock(b: Blocked) {
    if (!user?.email) return;
    setBusy(b.email);
    if (await unblockUser(user.email, b.email)) setList((prev) => (prev ?? []).filter((x) => x.email !== b.email));
    setBusy(null);
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-surface px-4 py-4">
      {list === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted">You haven't blocked anyone. To block someone, use <strong>Report or block</strong> on their post or comment, or the Block button on their profile.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {list.map((b) => (
            <li key={b.email} className="flex items-center gap-3 py-2">
              {b.profile_photo
                ? <img src={b.profile_photo} alt="" className="h-9 w-9 rounded-full object-cover" />
                : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-200 text-sm font-bold text-gray-600">{(b.full_name || '?').charAt(0).toUpperCase()}</span>}
              <span className="min-w-0 flex-1 truncate text-sm text-bone">{b.full_name || 'TapIN member'}</span>
              <button onClick={() => unblock(b)} disabled={busy === b.email} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-marigold disabled:opacity-50">
                {busy === b.email ? 'Unblocking…' : 'Unblock'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
