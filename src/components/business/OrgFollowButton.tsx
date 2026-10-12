import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';

// Follow / Following for an organization, with its follower count.
export default function OrgFollowButton({ orgId, color, compact = false }: { orgId: string; color?: string; compact?: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [following, setFollowing] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    supabase.rpc('org_follower_count', { p_org_id: orgId }).then(({ data }) => setCount(typeof data === 'number' ? data : 0));
    if (user?.email) supabase.from('organization_follows').select('org_id').eq('org_id', orgId).ilike('user_email', user.email).maybeSingle().then(({ data }) => setFollowing(!!data));
  }, [orgId, user?.email]);

  async function toggle() {
    if (!user?.email) { navigate('/login', { state: { from: location.pathname } }); return; }
    setBusy(true);
    if (following) {
      const { error } = await supabase.from('organization_follows').delete().eq('org_id', orgId).ilike('user_email', user.email);
      if (!error) { setFollowing(false); setCount((c) => Math.max(0, (c ?? 1) - 1)); }
    } else {
      const { error } = await supabase.from('organization_follows').insert({ org_id: orgId, user_email: user.email.toLowerCase() });
      if (!error) { setFollowing(true); setCount((c) => (c ?? 0) + 1); }
    }
    setBusy(false);
  }
  const c = color || '#0F1B3D';
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" onClick={toggle} disabled={busy} aria-pressed={following}
        className={`rounded-full px-4 ${compact ? 'py-1.5 text-xs' : 'py-2 text-sm'} font-semibold transition disabled:opacity-60 ${following ? 'border border-gray-300 bg-white text-gray-700' : 'text-white'}`}
        style={following ? undefined : { background: c }}>
        {following ? 'Following' : 'Follow'}
      </button>
      {count !== null && count > 0 && <span className="text-xs text-gray-500">{count} follower{count === 1 ? '' : 's'}</span>}
    </span>
  );
}
