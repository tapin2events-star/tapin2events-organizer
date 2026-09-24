import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

interface CreatorProfile {
  email: string;
  full_name: string | null;
  bio: string | null;
  profile_photo: string | null;
  is_organizer: boolean | null;
  is_resource: boolean | null;
  followers_count: number | null;
  following_count: number | null;
}

interface Post {
  id: string;
  thumbnail_url: string | null;
  caption: string | null;
}

export default function CreatorProfile() {
  const { email } = useParams<{ email: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  const decodedEmail = decodeURIComponent(email ?? '');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Same server-side delete the feed uses, so the post, its Gumlet video,
  // and any custom thumbnail are all removed together.
  async function deletePost(postId: string) {
    if (!window.confirm("Delete this post? This can't be undone.")) return;
    setDeletingId(postId);
    const { data, error } = await supabase.functions.invoke('delete-post', { body: { post_id: postId } });
    setDeletingId(null);
    if (error || !data?.success) {
      window.alert('Could not delete this post. Please try again.');
      return;
    }
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }

  useEffect(() => {
    if (!decodedEmail) return;
    (async () => {
      const [{ data: profileData }, { data: postRows }, { data: followRow }] = await Promise.all([
        supabase
          .from('public_profiles')
          .select('email, full_name, bio, profile_photo, is_organizer, is_resource, followers_count, following_count')
          .eq('email', decodedEmail)
          .single(),
        supabase
          .from('posts')
          .select('id, thumbnail_url, caption')
          .eq('author_email', decodedEmail)
          .eq('status', 'active')
          .order('created_at', { ascending: false }),
        user?.email
          ? supabase.from('follows').select('follower_email').eq('follower_email', user.email).eq('following_email', decodedEmail).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      setProfile(profileData);
      setPosts(postRows ?? []);
      setIsFollowing(!!followRow);
      setLoading(false);
    })();
  }, [decodedEmail, user?.email]);

  async function toggleFollow() {
    if (!user?.email || !profile) return;
    setFollowBusy(true);
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_email', user.email).eq('following_email', profile.email);
      setIsFollowing(false);
      setProfile((p) => (p ? { ...p, followers_count: Math.max((p.followers_count ?? 1) - 1, 0) } : p));
    } else {
      await supabase.from('follows').insert({ follower_email: user.email, following_email: profile.email });
      setIsFollowing(true);
      setProfile((p) => (p ? { ...p, followers_count: (p.followers_count ?? 0) + 1 } : p));
    }
    setFollowBusy(false);
  }

  if (loading) return <p className="p-6 text-muted">Loading…</p>;
  if (!profile) return <p className="p-6 text-muted">This profile could not be found.</p>;

  const isOwnProfile = user?.email === profile.email;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <button onClick={() => navigate(-1)} className="text-sm text-marigold">&larr; Back</button>

      <div className="mt-4 flex items-center gap-4">
        {profile.profile_photo ? (
          <img src={profile.profile_photo} alt="" className="h-20 w-20 rounded-full object-cover" />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-marigold to-teal font-display text-2xl font-bold text-white">
            {(profile.full_name || profile.email).charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <p className="font-display text-xl font-bold text-bone">{profile.full_name || profile.email}</p>
          <div className="mt-1 flex gap-2">
            {profile.is_organizer && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-marigold">💼 Organizer</span>}
            {profile.is_resource && <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple">⭐ Resource</span>}
          </div>
        </div>
      </div>

      {profile.bio && <p className="mt-3 text-sm text-muted">{profile.bio}</p>}

      <div className="mt-4 flex items-center gap-6">
        <div>
          <p className="text-center font-display text-lg font-bold text-bone">{posts.length}</p>
          <p className="text-xs text-muted">Posts</p>
        </div>
        <div>
          <p className="text-center font-display text-lg font-bold text-bone">{profile.followers_count ?? 0}</p>
          <p className="text-xs text-muted">Followers</p>
        </div>
        <div>
          <p className="text-center font-display text-lg font-bold text-bone">{profile.following_count ?? 0}</p>
          <p className="text-xs text-muted">Following</p>
        </div>

        {!isOwnProfile && user && (
          <button
            onClick={toggleFollow}
            disabled={followBusy}
            className={`ml-auto rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-50 ${
              isFollowing ? 'border border-gray-300 text-bone' : 'bg-marigold text-white'
            }`}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </button>
        )}
      </div>

      <div className="mt-8">
        <p className="font-display text-lg font-semibold text-bone">Posts</p>
        {posts.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No posts yet.</p>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-1">
            {posts.map((post) => (
              <div key={post.id} className="relative">
                <Link to={`/feed?post=${post.id}`} className="block aspect-[9/16] overflow-hidden rounded-lg bg-gray-100">
                  {post.thumbnail_url ? (
                    <img src={post.thumbnail_url} alt={post.caption ?? ''} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl">🎥</div>
                  )}
                </Link>
                {isOwnProfile && (
                  <button
                    onClick={() => deletePost(post.id)}
                    disabled={deletingId === post.id}
                    aria-label="Delete post"
                    className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-magenta disabled:opacity-50"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
