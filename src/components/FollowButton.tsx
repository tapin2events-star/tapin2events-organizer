import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { hasBlocked, unblockUser } from '../lib/blocks';

// Follow + follower count for any profile (person, resource, or group address).
// It's the same follow used on profiles, the Feed, and event pages.
export default function FollowButton({ email, className = '' }: { email: string; className?: string }) {
  const { user } = useAuth();
  const [count, setCount] = useState<number | null>(null);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMe = user?.email === email;

  useEffect(() => {
    supabase.rpc('follower_count', { p_email: email }).then(({ data }) => setCount(typeof data === 'number' ? data : 0));
  }, [email]);
  useEffect(() => {
    if (!user?.email || isMe) { setFollowing(false); return; }
    supabase.from('follows').select('follower_email').eq('follower_email', user.email).eq('following_email', email).maybeSingle().then(({ data }) => setFollowing(!!data));
    hasBlocked(user.email, email).then(setBlocked).catch(() => setBlocked(false));
  }, [user?.email, email, isMe]);

  async function toggle() {
    if (!user?.email) { window.location.assign(import.meta.env.BASE_URL + 'login'); return; }
    setBusy(true); setError(null);
    const { error } = following
      ? await supabase.from('follows').delete().eq('follower_email', user.email).eq('following_email', email)
      : await supabase.from('follows').insert({ follower_email: user.email, following_email: email });
    setBusy(false);
    if (error) {
      setError(/blocked/i.test(error.message) ? "You can't follow this account right now." : "Couldn't update. Please try again.");
      return;
    }
    setFollowing(!following);
    setCount((n) => Math.max((n ?? 0) + (following ? -1 : 1), 0));
  }

  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      {count !== null && <span className="text-sm text-gray-500"><strong className="text-gray-900">{count.toLocaleString()}</strong> follower{count === 1 ? '' : 's'}</span>}
      {!isMe && blocked && (
        <span className="inline-flex items-center gap-2 text-sm text-gray-500">
          You blocked this account
          <button disabled={busy} onClick={async () => { setBusy(true); if (user?.email) await unblockUser(user.email, email); setBlocked(false); setBusy(false); }}
            className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-semibold text-gray-700 hover:border-marigold disabled:opacity-50">Unblock</button>
        </span>
      )}
      {!isMe && !blocked && (
        <button onClick={toggle} disabled={busy} aria-pressed={following}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition disabled:opacity-50 ${following ? 'border border-gray-300 bg-white text-gray-700' : 'bg-marigold text-white hover:bg-marigold/90'}`}>
          {following ? 'Following' : 'Follow'}
        </button>
      )}
      {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
