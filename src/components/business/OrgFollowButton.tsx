import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { cachedCount, knownFollows, loadCount, loadFollows, setFollowing as rememberFollow } from '../../lib/orgFollows';

// Follow / Following for an organization, with its follower count. Uses remembered follow state, and shows
// a neutral placeholder (never a wrong "Follow") until it's known.
export default function OrgFollowButton({ orgId, color, compact = false }: { orgId: string; color?: string; compact?: boolean }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const known = knownFollows(user?.email);
  const [following, setFollowing] = useState<boolean | null>(() => (user?.email ? (known ? known.has(orgId) : null) : loading ? null : false));
  const [count, setCount] = useState<number | null>(() => cachedCount(orgId) ?? null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (cachedCount(orgId) === undefined) loadCount(orgId).then(setCount); else setCount(cachedCount(orgId) ?? null);
    if (user?.email) loadFollows(user.email).then((set) => setFollowing(set.has(orgId)));
    else if (!loading) setFollowing(false);
  }, [orgId, user?.email, loading]);

  async function toggle() {
    if (!user?.email) { navigate('/login', { state: { from: location.pathname } }); return; }
    setBusy(true);
    if (following) {
      const { error } = await supabase.from('organization_follows').delete().eq('org_id', orgId).ilike('user_email', user.email);
      if (!error) { setFollowing(false); rememberFollow(orgId, false); setCount((c) => Math.max(0, (c ?? 1) - 1)); }
    } else {
      const { error } = await supabase.from('organization_follows').insert({ org_id: orgId, user_email: user.email.toLowerCase() });
      if (!error) { setFollowing(true); rememberFollow(orgId, true); setCount((c) => (c ?? 0) + 1); }
    }
    setBusy(false);
  }
  const c = color || '#0F1B3D';
  const size = compact ? 'py-1.5 text-xs' : 'py-2 text-sm';
  return (
    <span className="inline-flex items-center gap-2">
      {following === null ? (
        <span className={`inline-block rounded-full bg-gray-200/80 px-4 ${size} font-semibold text-transparent`} aria-hidden="true">Following</span>
      ) : (
        <button type="button" onClick={toggle} disabled={busy} aria-pressed={following}
          className={`rounded-full px-4 ${size} font-semibold transition disabled:opacity-60 ${following ? 'border border-gray-300 bg-white text-gray-700' : 'text-white'}`}
          style={following ? undefined : { background: c }}>
          {following ? 'Following' : 'Follow'}
        </button>
      )}
      {count !== null && count > 0 && <span className="text-xs text-gray-500">{count} follower{count === 1 ? '' : 's'}</span>}
    </span>
  );
}
