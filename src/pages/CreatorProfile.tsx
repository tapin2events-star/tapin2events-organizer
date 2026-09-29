import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import FollowListModal from '../components/profile/FollowListModal';
import MyPostsManager from '../components/profile/MyPostsManager';
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

// A post someone else tagged this person in.
interface TaggedTile {
  post_id: string;
  thumbnail_url: string | null;
  caption: string | null;
  author_name: string;
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
  const [tab, setTab] = useState<'posts' | 'tagged' | 'events' | 'shop'>('posts');
  const [tagged, setTagged] = useState<TaggedTile[]>([]);
  const [removingTagId, setRemovingTagId] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [openList, setOpenList] = useState<'followers' | 'following' | null>(null);
  const [followBusy, setFollowBusy] = useState(false);

  const decodedEmail = decodeURIComponent(email ?? '');

  // A tagged person can take themselves off a post. The author can't tag
  // them in that post again.
  async function removeMyTag(postId: string) {
    if (!window.confirm("Remove yourself from this post? The creator won't be able to tag you in it again.")) return;
    setRemovingTagId(postId);
    const { error } = await supabase.from('post_tags').update({ status: 'removed' }).eq('post_id', postId).eq('tagged_email', decodedEmail);
    setRemovingTagId(null);
    if (error) {
      window.alert("Couldn't remove the tag. Please try again.");
      return;
    }
    setTagged((prev) => prev.filter((t) => t.post_id !== postId));
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

      // Posts other creators tagged this person in (active posts only).
      const { data: tagRows } = await supabase
        .from('post_tags')
        .select('post_id, created_at, posts!inner(id, thumbnail_url, caption, author_email, status)')
        .eq('tagged_email', decodedEmail)
        .eq('status', 'active')
        .eq('posts.status', 'active')
        .order('created_at', { ascending: false });
      type TagRow = { post_id: string; posts: { thumbnail_url: string | null; caption: string | null; author_email: string } | { thumbnail_url: string | null; caption: string | null; author_email: string }[] };
      const rows = ((tagRows ?? []) as unknown as TagRow[]).map((r) => ({ post_id: r.post_id, post: Array.isArray(r.posts) ? r.posts[0] : r.posts })).filter((r) => r.post);
      const authorEmails = [...new Set(rows.map((r) => r.post.author_email))];
      const { data: authors } = authorEmails.length ? await supabase.from('public_profiles').select('email, full_name').in('email', authorEmails) : { data: [] };
      const authorName = new Map((authors ?? []).map((a) => [a.email as string, (a.full_name as string | null)?.trim() || 'Creator']));
      setTagged(rows.map((r) => ({ post_id: r.post_id, thumbnail_url: r.post.thumbnail_url, caption: r.post.caption, author_name: authorName.get(r.post.author_email) ?? 'Creator' })));
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
      <button onClick={() => navigate(-1)} className="-my-2 py-2 text-sm text-marigold">&larr; Back</button>

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
            ...(tagged.length > 0 ? [{ id: 'tagged' as const, label: `Tagged (${tagged.length})` }] : []),
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

        {tab === 'tagged' && (
          <div className="mt-3 grid grid-cols-3 gap-1">
            {tagged.map((t) => (
              <div key={t.post_id} className="relative">
                <Link to={`/feed?post=${t.post_id}`} className="relative block aspect-[9/16] overflow-hidden rounded-lg bg-gray-100">
                  {t.thumbnail_url ? (
                    <img src={t.thumbnail_url} alt={t.caption ?? ''} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl">🎥</div>
                  )}
                  <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-6 text-xs font-medium text-white">
                    by {t.author_name}
                  </span>
                </Link>
                {isOwnProfile && (
                  <button
                    onClick={() => removeMyTag(t.post_id)}
                    disabled={removingTagId === t.post_id}
                    aria-label="Remove me from this post"
                    title="Remove me from this post"
                    className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-magenta disabled:opacity-50"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {tab === 'events' && <CreatorEvents events={events} />}
        {tab === 'shop' && <CreatorProducts products={products} />}
        {tab === 'posts' && (posts.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No posts yet.</p>
        ) : isOwnProfile ? (
          <MyPostsManager posts={posts} onPostsChange={setPosts} />
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-1">
            {posts.map((post) => (
              <Link key={post.id} to={`/feed?post=${post.id}`} className="block aspect-[9/16] overflow-hidden rounded-lg bg-gray-100">
                {post.thumbnail_url ? (
                  <img src={post.thumbnail_url} alt={post.caption ?? ''} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl">🎥</div>
                )}
              </Link>
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
