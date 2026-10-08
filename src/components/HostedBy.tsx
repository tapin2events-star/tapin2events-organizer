import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

// "Hosted by" card on event pages with a Follow button. Following here is the same
// follow as on profiles and the Feed; followers hear about the organizer's new events.
export default function HostedBy({ organizerEmail, fallbackName }: { organizerEmail: string; fallbackName?: string | null }) {
  const { user } = useAuth();
  const [org, setOrg] = useState<{ full_name: string | null; profile_photo: string | null } | null>(null);
  const [followers, setFollowers] = useState<number | null>(null);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const isMe = user?.email === organizerEmail;

  useEffect(() => {
    supabase.from('public_profiles').select('full_name, profile_photo').eq('email', organizerEmail).maybeSingle().then(({ data }) => setOrg(data ?? null));
    supabase.rpc('follower_count', { p_email: organizerEmail }).then(({ data }) => setFollowers(typeof data === 'number' ? data : 0));
  }, [organizerEmail]);
  useEffect(() => {
    if (!user?.email || isMe) { setFollowing(false); return; }
    supabase.from('follows').select('follower_email').eq('follower_email', user.email).eq('following_email', organizerEmail).maybeSingle().then(({ data }) => setFollowing(!!data));
  }, [user?.email, organizerEmail, isMe]);

  async function toggle() {
    if (!user?.email) { window.location.assign(import.meta.env.BASE_URL + 'login'); return; }
    setBusy(true);
    const { error } = following
      ? await supabase.from('follows').delete().eq('follower_email', user.email).eq('following_email', organizerEmail)
      : await supabase.from('follows').insert({ follower_email: user.email, following_email: organizerEmail });
    setBusy(false);
    if (error) return;
    setFollowing(!following);
    setFollowers((n) => Math.max((n ?? 0) + (following ? -1 : 1), 0));
  }

  const name = org?.full_name || fallbackName || 'The organizer';
  return (
    <div className="mt-5 flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3">
      <Link to={`/creator/${encodeURIComponent(organizerEmail)}`} className="flex min-w-0 flex-1 items-center gap-3">
        {org?.profile_photo
          ? <img src={org.profile_photo} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
          : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-marigold to-teal text-lg font-bold text-white">{name.charAt(0).toUpperCase()}</span>}
        <span className="min-w-0">
          <span className="block text-xs text-gray-400">Hosted by</span>
          <span className="block truncate font-semibold text-gray-900">{name}</span>
          {followers !== null && <span className="block text-xs text-gray-500">{followers.toLocaleString()} follower{followers === 1 ? '' : 's'}</span>}
        </span>
      </Link>
      {!isMe && (
        <button onClick={toggle} disabled={busy} aria-pressed={following}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${following ? 'border border-gray-300 bg-white text-gray-700' : 'bg-marigold text-white hover:bg-marigold/90'}`}>
          {following ? 'Following' : 'Follow'}
        </button>
      )}
    </div>
  );
}
