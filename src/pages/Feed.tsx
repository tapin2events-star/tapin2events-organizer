import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import BottomTabBar from '../components/BottomTabBar';
import HlsVideo from '../components/feed/HlsVideo';
import CreatePostModal from '../components/feed/CreatePostModal';

interface Post {
  id: string;
  author_email: string;
  poster_type: 'organizer' | 'resource' | null;
  caption: string | null;
  video_url: string;
  thumbnail_url: string | null;
  created_at: string;
  author_name: string;
  author_photo: string | null;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
  event_id: string | null;
}

interface Comment {
  id: string;
  author_email: string;
  author_name: string;
  author_photo: string | null;
  content: string;
  created_at: string;
  like_count: number;
  liked_by_me: boolean;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

type FeedMode = 'for_you' | 'following';

export default function Feed() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const eventFilterId = searchParams.get('event');
  // Share links and profile-grid taps open /feed?post=<id>; that post is
  // placed first so it's the one that opens and plays.
  const sharedPostId = searchParams.get('post');
  const loadIdRef = useRef(0);
  const [eventFilterTitle, setEventFilterTitle] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedMode, setFeedMode] = useState<FeedMode>('for_you');
  const [followingEmails, setFollowingEmails] = useState<Set<string>>(new Set());
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [postingComment, setPostingComment] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const [shareCopiedId, setShareCopiedId] = useState<string | null>(null);
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportingCommentId, setReportingCommentId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [activatedPostIds, setActivatedPostIds] = useState<Set<string>>(new Set());
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [burstingHeartId, setBurstingHeartId] = useState<string | null>(null);
  const lastTapRef = useRef<Record<string, number>>({});
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  // The database query itself scopes posts to the event or to the people
  // you follow, so what's loaded is exactly what should be shown.
  const visiblePosts = posts;

  async function loadPosts() {
    // Ignore responses from an older load (e.g. after quickly switching
    // between For You and Following) so they can't overwrite newer results.
    const loadId = ++loadIdRef.current;

    // Who the viewer follows is needed up front, so the Following tab asks the
    // database for those creators' posts directly instead of filtering down
    // only the 30 newest posts overall (which dropped anyone older than that).
    const { data: myFollows } = user?.email
      ? await supabase.from('follows').select('following_email').eq('follower_email', user.email)
      : { data: [] as { following_email: string }[] };
    if (loadId !== loadIdRef.current) return;
    const followed = (myFollows ?? []).map((f) => f.following_email);
    setFollowingEmails(new Set(followed));

    let query = supabase.from('posts').select('*').eq('status', 'active').order('created_at', { ascending: false });
    if (eventFilterId) {
      query = query.eq('event_id', eventFilterId);
    } else if (feedMode === 'following') {
      if (followed.length === 0) {
        setPosts([]);
        setLoading(false);
        return;
      }
      query = query.in('author_email', followed).limit(30);
    } else {
      query = query.limit(30);
    }
    const { data: postRows, error } = await query;
    if (loadId !== loadIdRef.current) return;
    if (error) {
      console.error('Failed to load feed:', error);
      setLoading(false);
      return;
    }
    let rows = postRows ?? [];
    if (sharedPostId && !eventFilterId && feedMode === 'for_you') {
      const alreadyLoaded = rows.find((p) => p.id === sharedPostId);
      if (alreadyLoaded) {
        rows = [alreadyLoaded, ...rows.filter((p) => p.id !== sharedPostId)];
      } else {
        const { data: shared } = await supabase.from('posts').select('*').eq('id', sharedPostId).eq('status', 'active').maybeSingle();
        if (loadId !== loadIdRef.current) return;
        if (shared) rows = [shared, ...rows];
      }
    }
    const postIds = rows.map((p) => p.id);
    const authorEmails = [...new Set(rows.map((p) => p.author_email))];

    // Counts are fetched only for the posts on screen -- fetching every like
    // and comment in the database would silently undercount once the site
    // passes Supabase's 1,000-rows-per-request cap.
    const [{ data: profiles }, { data: likes }, { data: commentCounts }, { data: myLikes }] = await Promise.all([
      authorEmails.length ? supabase.from('public_profiles').select('email, full_name, profile_photo').in('email', authorEmails) : Promise.resolve({ data: [] }),
      postIds.length ? supabase.from('post_likes').select('post_id').in('post_id', postIds) : Promise.resolve({ data: [] }),
      postIds.length ? supabase.from('post_comments').select('post_id').eq('status', 'active').in('post_id', postIds) : Promise.resolve({ data: [] }),
      user?.email && postIds.length ? supabase.from('post_likes').select('post_id').eq('user_email', user.email).in('post_id', postIds) : Promise.resolve({ data: [] }),
    ]);
    if (loadId !== loadIdRef.current) return;

    const namesByEmail = new Map((profiles ?? []).map((p) => [p.email, p.full_name]));
    const photosByEmail = new Map((profiles ?? []).map((p) => [p.email, p.profile_photo]));
    const likeCountByPost = new Map<string, number>();
    (likes ?? []).forEach((l) => likeCountByPost.set(l.post_id, (likeCountByPost.get(l.post_id) ?? 0) + 1));
    const commentCountByPost = new Map<string, number>();
    (commentCounts ?? []).forEach((c) => commentCountByPost.set(c.post_id, (commentCountByPost.get(c.post_id) ?? 0) + 1));
    const myLikedSet = new Set((myLikes ?? []).map((l) => l.post_id));

    setPosts(
      rows.map((p) => ({
        ...p,
        author_name: namesByEmail.get(p.author_email) || p.author_email,
        author_photo: photosByEmail.get(p.author_email) ?? null,
        like_count: likeCountByPost.get(p.id) ?? 0,
        comment_count: commentCountByPost.get(p.id) ?? 0,
        liked_by_me: myLikedSet.has(p.id),
      }))
    );
    setLoading(false);
  }

  useEffect(() => {
    loadPosts();
  }, [user?.email, eventFilterId, feedMode, sharedPostId]);

  useEffect(() => {
    if (!eventFilterId) {
      setEventFilterTitle(null);
      return;
    }
    supabase
      .from('events')
      .select('title')
      .eq('id', eventFilterId)
      .single()
      .then(({ data }) => setEventFilterTitle(data?.title ?? null));
  }, [eventFilterId]);

  // TikTok-style feeds only autoplay whichever video is actually on
  // screen -- watch scroll position via IntersectionObserver and
  // play/pause videos accordingly, rather than relying on a single
  // `autoPlay` prop that never updates as the user scrolls.
  useEffect(() => {
    if (visiblePosts.length === 0) return;
    // Guarantee the very first post loads AND plays immediately, without
    // waiting on the observer's async callback. Previously only
    // activatedPostIds (shouldLoad) was safeguarded here, not activePostId
    // (shouldPlay) -- on a fresh page load, if the observer's initial
    // callback was delayed or inconsistent, the first video would load but
    // never actually be told to play until the user scrolled or tapped.
    setActivatedPostIds((prev) => new Set(prev).add(visiblePosts[0].id));
    setActivePostId(visiblePosts[0].id);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const postId = entry.target.getAttribute('data-post-id');
          if (!postId) return;
          if (entry.isIntersecting) {
            setActivatedPostIds((prev) => (prev.has(postId) ? prev : new Set(prev).add(postId)));
          }
          if (entry.isIntersecting && entry.intersectionRatio > 0.4) {
            setActivePostId(postId);
            setIsPaused(false);
          }
        });
      },
      { threshold: [0, 0.4, 1] }
    );
    const slides = containerRef.current?.querySelectorAll('[data-post-id]') ?? [];
    slides.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [visiblePosts]);

  async function toggleLike(post: Post) {
    if (!user?.email) return;
    const wasLiked = post.liked_by_me;
    setPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, liked_by_me: !wasLiked, like_count: p.like_count + (wasLiked ? -1 : 1) } : p))
    );
    if (wasLiked) {
      await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_email', user.email);
    } else {
      await supabase.from('post_likes').insert({ post_id: post.id, user_email: user.email });
    }
  }

  async function openCommentPanel(postId: string) {
    setOpenComments(postId);
    setComments([]);
    setCommentsLoading(true);
    const { data: commentRows } = await supabase
      .from('post_comments')
      .select('id, author_email, content, created_at')
      .eq('post_id', postId)
      .eq('status', 'active')
      .order('created_at', { ascending: true });
    const rows = commentRows ?? [];
    const commentIds = rows.map((c) => c.id);
    const authorEmails = [...new Set(rows.map((c) => c.author_email))];

    const [{ data: profiles }, { data: likes }, { data: myLikes }] = await Promise.all([
      authorEmails.length ? supabase.from('public_profiles').select('email, full_name, profile_photo').in('email', authorEmails) : Promise.resolve({ data: [] }),
      commentIds.length ? supabase.from('comment_likes').select('comment_id').in('comment_id', commentIds) : Promise.resolve({ data: [] }),
      user?.email && commentIds.length ? supabase.from('comment_likes').select('comment_id').eq('user_email', user.email).in('comment_id', commentIds) : Promise.resolve({ data: [] }),
    ]);
    const namesByEmail = new Map((profiles ?? []).map((p) => [p.email, p.full_name]));
    const photosByEmail = new Map((profiles ?? []).map((p) => [p.email, p.profile_photo]));
    const likeCountByComment = new Map<string, number>();
    (likes ?? []).forEach((l) => likeCountByComment.set(l.comment_id, (likeCountByComment.get(l.comment_id) ?? 0) + 1));
    const myLikedSet = new Set((myLikes ?? []).map((l) => l.comment_id));

    setComments(
      rows.map((c) => ({
        ...c,
        author_name: namesByEmail.get(c.author_email) || c.author_email,
        author_photo: photosByEmail.get(c.author_email) ?? null,
        like_count: likeCountByComment.get(c.id) ?? 0,
        liked_by_me: myLikedSet.has(c.id),
      }))
    );
    setCommentsLoading(false);
  }

  async function submitComment() {
    if (!user?.email || !openComments || !newComment.trim() || postingComment) return;
    const content = newComment.trim();
    setNewComment('');
    setPostingComment(true);
    const { data: profile } = await supabase.from('profiles').select('full_name, profile_photo').eq('email', user.email).single();
    const { data } = await supabase
      .from('post_comments')
      .insert({ post_id: openComments, author_email: user.email, content })
      .select()
      .single();
    if (data) {
      setComments((prev) => [
        ...prev,
        { ...data, author_name: profile?.full_name || user.email, author_photo: profile?.profile_photo ?? null, like_count: 0, liked_by_me: false },
      ]);
      setPosts((prev) => prev.map((p) => (p.id === openComments ? { ...p, comment_count: p.comment_count + 1 } : p)));
      setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
    setPostingComment(false);
  }

  async function toggleCommentLike(comment: Comment) {
    if (!user?.email) return;
    const wasLiked = comment.liked_by_me;
    setComments((prev) =>
      prev.map((c) => (c.id === comment.id ? { ...c, liked_by_me: !wasLiked, like_count: c.like_count + (wasLiked ? -1 : 1) } : c))
    );
    if (wasLiked) {
      await supabase.from('comment_likes').delete().eq('comment_id', comment.id).eq('user_email', user.email);
    } else {
      await supabase.from('comment_likes').insert({ comment_id: comment.id, user_email: user.email });
    }
  }

  async function deleteComment(commentId: string) {
    await supabase.from('post_comments').delete().eq('id', commentId);
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    setPosts((prev) => prev.map((p) => (p.id === openComments ? { ...p, comment_count: Math.max(p.comment_count - 1, 0) } : p)));
  }

  async function reportComment(commentId: string, reason: string) {
    if (!user?.email) return;
    await supabase.from('post_reports').insert({ comment_id: commentId, reporter_email: user.email, reason });
    setReportingCommentId(null);
  }

  function handleShare(postId: string) {
    const base = window.location.origin + import.meta.env.BASE_URL;
    navigator.clipboard.writeText(`${base}feed?post=${postId}`);
    setShareCopiedId(postId);
    setTimeout(() => setShareCopiedId(null), 1500);
  }

  async function submitReport(postId: string, reason: string) {
    if (!user?.email) return;
    await supabase.from('post_reports').insert({ post_id: postId, reporter_email: user.email, reason });
    setReportingId(null);
  }

  async function deletePost(postId: string) {
    if (!window.confirm('Delete this post? This can\'t be undone.')) return;
    // Runs server-side so the post, its video in Gumlet, and any custom
    // thumbnail are all removed together (the Gumlet key stays off the browser).
    const { data, error } = await supabase.functions.invoke('delete-post', { body: { post_id: postId } });
    if (error || !data?.success) {
      window.alert('Could not delete this post. Please try again.');
      return;
    }
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }

  if (loading) return <div className="flex h-[100dvh] items-center justify-center text-muted">Loading…</div>;

  if (posts.length === 0 && feedMode === 'for_you' && !eventFilterId) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center text-center">
        <p className="font-display text-xl font-semibold text-bone">No posts yet</p>
        <p className="mt-1 text-sm text-muted">Be the first to share something with the community.</p>
        {user && (
          <button onClick={() => setShowCreateModal(true)} className="mt-4 rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-white">
            + New Post
          </button>
        )}
        {showCreateModal && (
          <CreatePostModal onClose={() => setShowCreateModal(false)} onPosted={() => { setShowCreateModal(false); loadPosts(); }} />
        )}
        <BottomTabBar />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-30 bg-black">
      <div className="absolute inset-x-0 top-4 z-40 flex items-center justify-between gap-2 px-4">
        {eventFilterId ? (
          <div className="flex min-w-0 items-center gap-2">
            <Link to={`/events/${eventFilterId}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/40 text-white">
              &larr;
            </Link>
            <p className="truncate text-sm font-semibold text-white">{eventFilterTitle ?? 'Event posts'}</p>
          </div>
        ) : user ? (
          <div className="flex gap-1 rounded-full bg-black/40 p-1 backdrop-blur-sm">
            {([
              { id: 'for_you', label: 'For You' },
              { id: 'following', label: 'Following' },
            ] as const).map((m) => (
              <button
                key={m.id}
                onClick={() => setFeedMode(m.id)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium ${feedMode === m.id ? 'bg-white text-ink' : 'text-white/70'}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}

        <div className="flex shrink-0 items-center gap-2">
          {user && !eventFilterId && (
            <button
              onClick={() => setShowCreateModal(true)}
              aria-label="New post"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
            </button>
          )}
          <button
            onClick={() => setIsMuted((m) => !m)}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white"
          >
            {isMuted ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5 6 9H2v6h4l5 4V5z" strokeLinejoin="round" /><path d="M23 9l-6 6M17 9l6 6" strokeLinecap="round" /></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5 6 9H2v6h4l5 4V5z" strokeLinejoin="round" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" strokeLinecap="round" /></svg>
            )}
          </button>
        </div>
      </div>

      {visiblePosts.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center text-center text-white">
          {eventFilterId ? (
            <>
              <p className="font-display text-xl font-semibold">No posts for this event yet</p>
              <p className="mt-1 text-sm text-white/60">Check back later, or be the first to share something.</p>
            </>
          ) : (
            <>
              <p className="font-display text-xl font-semibold">
                {followingEmails.size === 0 ? "You're not following anyone yet" : 'No posts from people you follow yet'}
              </p>
              <p className="mt-1 text-sm text-white/60">Follow creators from "For You" to see their posts here.</p>
              <button onClick={() => setFeedMode('for_you')} className="mt-4 rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-white">
                Browse For You
              </button>
            </>
          )}
        </div>
      ) : (
      <div ref={containerRef} className="h-full snap-y snap-mandatory overflow-y-scroll">
        {visiblePosts.map((post) => (
          <div key={post.id} data-post-id={post.id} className="relative flex h-[100dvh] w-full snap-start items-center justify-center bg-black">
            <HlsVideo
              videoRef={(el) => { videoRefs.current[post.id] = el; }}
              src={post.video_url}
              shouldLoad={activatedPostIds.has(post.id)}
              shouldPlay={activePostId === post.id}
              poster={post.thumbnail_url ?? undefined}
              className="h-full w-full object-contain"
              loop
              playsInline
              muted={isMuted}
              preload="auto"
              onClick={(e) => {
                const now = Date.now();
                const lastTap = lastTapRef.current[post.id] ?? 0;
                lastTapRef.current[post.id] = now;

                if (now - lastTap < 300) {
                  // Double tap: like (if not already liked) and show the heart burst --
                  // never unlike from a double tap, matching how TikTok/Instagram behave.
                  if (!post.liked_by_me) toggleLike(post);
                  setBurstingHeartId(post.id);
                  setTimeout(() => setBurstingHeartId((current) => (current === post.id ? null : current)), 800);
                  return;
                }

                const v = e.currentTarget;
                if (v.paused) {
                  v.play();
                  setIsPaused(false);
                } else {
                  v.pause();
                  setIsPaused(true);
                }
              }}
            />

            {burstingHeartId === post.id && (
              <svg
                className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-heart-burst"
                width="100" height="100" viewBox="0 0 24 24" fill="#EC4899" stroke="#EC4899" strokeWidth="1"
              >
                <path d="M20.8 8.6c0 4.5-8.8 10.4-8.8 10.4S3.2 13.1 3.2 8.6a4.8 4.8 0 0 1 8.8-2.7 4.8 4.8 0 0 1 8.8 2.7z" strokeLinejoin="round" />
              </svg>
            )}

            <div className="absolute right-3 bottom-28 flex flex-col items-center gap-5">
              <button onClick={() => toggleLike(post)} className="flex flex-col items-center gap-1 text-white">
                <svg width="30" height="30" viewBox="0 0 24 24" fill={post.liked_by_me ? '#EC4899' : 'none'} stroke={post.liked_by_me ? '#EC4899' : 'white'} strokeWidth="2">
                  <path d="M20.8 8.6c0 4.5-8.8 10.4-8.8 10.4S3.2 13.1 3.2 8.6a4.8 4.8 0 0 1 8.8-2.7 4.8 4.8 0 0 1 8.8 2.7z" strokeLinejoin="round" />
                </svg>
                <span className="text-xs font-medium">{post.like_count}</span>
              </button>
              <button onClick={() => openCommentPanel(post.id)} className="flex flex-col items-center gap-1 text-white">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5A8.5 8.5 0 1 1 21 11.5z" strokeLinejoin="round" />
                </svg>
                <span className="text-xs font-medium">{post.comment_count}</span>
              </button>
              <button onClick={() => handleShare(post.id)} className="flex flex-col items-center gap-1 text-white">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                  <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
                </svg>
                <span className="text-xs font-medium">{shareCopiedId === post.id ? 'Copied!' : 'Share'}</span>
              </button>
              {user?.email === post.author_email ? (
                <button onClick={() => deletePost(post.id)} aria-label="Delete post" className="text-white/70">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              ) : (
                <button onClick={() => setReportingId(post.id)} aria-label="Report post" className="text-white/70">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v5M12 16h.01" strokeLinecap="round" /></svg>
                </button>
              )}
            </div>

            <div className="absolute inset-x-0 bottom-0 p-4 pb-6 text-white" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' }}>
              <Link to={`/creator/${encodeURIComponent(post.author_email)}`} className="flex items-center gap-2">
                {post.author_photo ? (
                  <img src={post.author_photo} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-marigold to-teal text-xs font-bold">
                    {post.author_name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="font-semibold">{post.author_name}</span>
              </Link>
              {post.poster_type && (
                <span className="mt-1 inline-block rounded-full bg-white/15 px-2 py-0.5 text-xs">{post.poster_type}</span>
              )}
              {post.caption && <p className="mt-1 text-sm">{post.caption}</p>}
            </div>
          </div>
        ))}
      </div>
      )}

      {openComments && (
        <>
          <div className="fixed inset-0 z-[1040] bg-black/40" onClick={() => setOpenComments(null)} />
          <div
            className="fixed inset-x-0 bottom-0 z-[1050] mx-auto flex max-h-[70dvh] max-w-lg flex-col rounded-t-2xl bg-surface shadow-2xl"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-gray-300" />
            <div className="flex items-center justify-between px-4 pb-2 pt-2">
              <span className="w-6" />
              <p className="text-sm font-semibold text-bone">
                {commentsLoading ? 'Comments' : `${comments.length} comment${comments.length === 1 ? '' : 's'}`}
              </p>
              <button onClick={() => setOpenComments(null)} aria-label="Close comments" className="flex h-6 w-6 items-center justify-center text-muted">
                ✕
              </button>
            </div>

            <div className="min-h-[30dvh] flex-1 overflow-y-auto border-t border-gray-100 px-4 py-3">
              {commentsLoading ? (
                <p className="py-8 text-center text-sm text-muted">Loading comments…</p>
              ) : comments.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm font-medium text-bone">No comments yet</p>
                  <p className="text-xs text-muted">Be the first to say something.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {comments.map((c) => (
                    <div key={c.id} className="flex gap-2.5">
                      <Link to={`/creator/${encodeURIComponent(c.author_email)}`} className="shrink-0">
                        {c.author_photo ? (
                          <img src={c.author_photo} alt="" className="h-9 w-9 rounded-full object-cover" />
                        ) : (
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-marigold to-teal text-xs font-bold text-white">
                            {c.author_name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </Link>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <Link to={`/creator/${encodeURIComponent(c.author_email)}`} className="truncate text-sm font-semibold text-bone">
                            {c.author_name}
                          </Link>
                          <p className="shrink-0 text-xs text-muted">{timeAgo(c.created_at)}</p>
                        </div>
                        <p className="whitespace-pre-wrap break-words text-sm text-bone">{c.content}</p>
                        <div className="mt-1 flex items-center gap-4">
                          {user?.email === c.author_email ? (
                            <button onClick={() => deleteComment(c.id)} className="text-xs text-muted">Delete</button>
                          ) : user ? (
                            <button onClick={() => setReportingCommentId(c.id)} className="text-xs text-muted">Report</button>
                          ) : null}
                        </div>
                      </div>
                      <button onClick={() => toggleCommentLike(c)} aria-label="Like comment" className="flex shrink-0 flex-col items-center gap-0.5 self-start pt-1 text-xs text-muted">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill={c.liked_by_me ? '#EC4899' : 'none'} stroke={c.liked_by_me ? '#EC4899' : 'currentColor'} strokeWidth="2">
                          <path d="M20.8 8.6c0 4.5-8.8 10.4-8.8 10.4S3.2 13.1 3.2 8.6a4.8 4.8 0 0 1 8.8-2.7 4.8 4.8 0 0 1 8.8 2.7z" strokeLinejoin="round" />
                        </svg>
                        {c.like_count > 0 && c.like_count}
                      </button>
                    </div>
                  ))}
                  <div ref={commentsEndRef} />
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 px-3 py-2.5">
              {user ? (
                <div className="flex items-center gap-2">
                  <input
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        submitComment();
                      }
                    }}
                    enterKeyHint="send"
                    maxLength={500}
                    placeholder="Add a comment…"
                    className="min-w-0 flex-1 rounded-full border border-gray-300 bg-surface2 px-4 py-2.5 text-base text-bone outline-none focus-visible:border-marigold"
                  />
                  <button
                    onClick={submitComment}
                    disabled={!newComment.trim() || postingComment}
                    className="shrink-0 rounded-full bg-marigold px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    Post
                  </button>
                </div>
              ) : (
                <p className="py-1 text-center text-sm text-muted">
                  <Link to="/login" className="font-medium text-marigold">Sign in</Link> to join the conversation.
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {reportingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-surface p-5">
            <p className="font-semibold text-bone">Report this post</p>
            <div className="mt-3 flex flex-col gap-2">
              {['Spam', 'Inappropriate content', 'Harassment', 'Other'].map((reason) => (
                <button
                  key={reason}
                  onClick={() => submitReport(reportingId, reason)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-left text-sm text-bone hover:border-marigold"
                >
                  {reason}
                </button>
              ))}
            </div>
            <button onClick={() => setReportingId(null)} className="mt-3 text-sm text-muted">Cancel</button>
          </div>
        </div>
      )}
      {reportingCommentId && (
        <div className="fixed inset-0 z-[1060] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-surface p-5">
            <p className="font-semibold text-bone">Report this comment</p>
            <div className="mt-3 flex flex-col gap-2">
              {['Spam', 'Inappropriate content', 'Harassment', 'Other'].map((reason) => (
                <button
                  key={reason}
                  onClick={() => reportComment(reportingCommentId, reason)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-left text-sm text-bone hover:border-marigold"
                >
                  {reason}
                </button>
              ))}
            </div>
            <button onClick={() => setReportingCommentId(null)} className="mt-3 text-sm text-muted">Cancel</button>
          </div>
        </div>
      )}
      {showCreateModal && (
        <CreatePostModal onClose={() => setShowCreateModal(false)} onPosted={() => { setShowCreateModal(false); loadPosts(); }} />
      )}
      {isPaused && !openComments && !reportingId && !reportingCommentId && !showCreateModal && <BottomTabBar />}
    </div>
  );
}
