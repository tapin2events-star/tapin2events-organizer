import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import FollowListModal from '../components/profile/FollowListModal';
import CreatorEvents, { type CreatorEvent } from '../components/profile/CreatorEvents';
import CreatorProducts, { type CreatorProduct } from '../components/profile/CreatorProducts';

interface CreatorProfile {
  email: string;
  full_name: string | null;
  bio: string | null;
  profile_photo: string | null;
  is_organizer: boolean | null;
  is_resource: boolean | null;
  followers_count: number | null;
  following_count: number | null;
  is_profile_private: boolean | null;
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
  const [events, setEvents] = useState<CreatorEvent[]>([]);
  const [products, setProducts] = useState<CreatorProduct[]>([]);
  const [resourceId, setResourceId] = useState<string | null>(null);
  const [tab, setTab] = useState<'posts' | 'events' | 'shop'>('posts');
  const [isFollowing, setIsFollowing] = useState(false);
  const [openList, setOpenList] = useState<'followers' | 'following' | null>(null);
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
      const [{ data: profileData }, { data: postRows }, { data: followRow }, { data: eventRows }, { data: productRows }, { data: resourceRow }] = await Promise.all([
        supabase
          .from('public_profiles')
          .select('email, full_name, bio, profile_photo, is_organizer, is_resource, followers_count, following_count, is_profile_private')
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
        // Only public events and products -- the same things anyone can find
        // elsewhere in the app. Drafts and hidden products never show here,
        // even when the owner is the one looking.
        supabase
          .from('events')
          .select('id, title, start_date, end_date, poster_url, location_name, is_online, parent_event_id')
          .eq('organizer_email', decodedEmail)
          .in('status', ['published', 'completed']),
        supabase
          .from('products')
          .select('id, name, price, images')
          .eq('seller_email', decodedEmail)
          .eq('is_active', true)
          .eq('visibility', 'public')
          .order('created_at', { ascending: false }),
        supabase.from('resources').select('id').eq('email', decodedEmail).maybeSingle(),
      ]);
      setProfile(profileData);
      setPosts(postRows ?? []);
      setEvents((eventRows ?? []) as CreatorEvent[]);
      setProducts((productRows ?? []) as CreatorProduct[]);
      setResourceId(resourceRow?.id ?? null);
      // Open on whichever tab has something to show.
      setTab((postRows ?? []).length > 0 ? 'posts' : (eventRows ?? []).length > 0 ? 'events' : (productRows ?? []).length > 0 ? 'shop' : 'posts');
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

      {resourceId && (
        <Link
          to={`/resources/${resourceId}`}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-3 py-1.5 text-sm font-medium text-purple hover:border-purple-300"
        >
          ⭐ View resource profile &rarr;
        </Link>
      )}

      <div className="mt-4 flex items-center gap-6">
        <div>
          <p className="text-center font-display text-lg font-bold text-bone">{posts.length}</p>
          <p className="text-xs text-muted">Posts</p>
        </div>
        <button onClick={() => setOpenList('followers')} className="text-left">
          <p className="text-center font-display text-lg font-bold text-bone">{profile.followers_count ?? 0}</p>
          <p className="text-xs text-muted">Followers</p>
        </button>
        <button onClick={() => setOpenList('following')} className="text-left">
          <p className="text-center font-display text-lg font-bold text-bone">{profile.following_count ?? 0}</p>
          <p className="text-xs text-muted">Following</p>
        </button>

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
        <div className="flex gap-1 border-b border-gray-200">
          {([
            { id: 'posts', label: `Posts (${posts.length})` },
            { id: 'events', label: `Events (${new Set(events.map((e) => e.parent_event_id ?? e.id)).size})` },
            { id: 'shop', label: `Shop (${products.length})` },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium ${tab === t.id ? 'border-b-2 border-marigold text-marigold' : 'text-muted hover:text-bone'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'events' && <CreatorEvents events={events} />}
        {tab === 'shop' && <CreatorProducts products={products} />}
        {tab === 'posts' && (posts.length === 0 ? (
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
        ))}
      </div>

      {openList && (
        <FollowListModal
          email={profile.email}
          direction={openList}
          isPrivate={!!profile.is_profile_private}
          isOwnList={isOwnProfile}
          onClose={() => setOpenList(null)}
        />
      )}
    </div>
  );
}
