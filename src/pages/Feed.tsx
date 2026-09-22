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
  const [eventFilterTitle, setEventFilterTitle] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedMode, setFeedMode] = useState<FeedMode>('for_you');
  const [followingEmails, setFollowingEmails] = useState<Set<string>>(new Set());
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
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

  const visiblePosts = eventFilterId
    ? posts.filter((p) => p.event_id === eventFilterId)
    : feedMode === 'following'
    ? posts.filter((p) => followingEmails.has(p.author_email))
    : posts;

  async function loadPosts() {
    let query = supabase.from('posts').select('*').eq('status', 'active').order('created_at', { ascending: false });
    query = eventFilterId ? query.eq('event_id', eventFilterId) : query.limit(30);
    const { data: postRows, error } = await query;
    if (error) {
      console.error('Failed to load feed:', error);
      setLoading(false);
      return;
    }
    const rows = postRows ?? [];
    const postIds = rows.map((p) => p.id);
    const authorEmails = [...new Set(rows.map((p) => p.author_email))];

    const [{ data: profiles }, { data: likes }, { data: commentCounts }, { data: myLikes }, { data: myFollows }] = await Promise.all([
      authorEmails.length ? supabase.from('public_profiles').select('email, full_name, profile_photo').in('email', authorEmails) : Promise.resolve({ data: [] }),
      postIds.length ? supabase.from('post_likes').select('post_id') : Promise.resolve({ data: [] }),
      postIds.length ? supabase.from('post_comments').select('post_id').eq('status', 'active') : Promise.resolve({ data: [] }),
      user?.email && postIds.length ? supabase.from('post_likes').select('post_id').eq('user_email', user.email) : Promise.resolve({ data: [] }),
      user?.email ? supabase.from('follows').select('following_email').eq('follower_email', user.email) : Promise.resolve({ data: [] }),
    ]);

    const namesByEmail = new Map((profiles ?? []).map((p) => [p.email, p.full_name]));
    const photosByEmail = new Map((profiles ?? []).map((p) => [p.email, p.profile_photo]));
    const likeCountByPost = new Map<string, number>();
    (likes ?? []).forEach((l) => likeCountByPost.set(l.post_id, (likeCountByPost.get(l.post_id) ?? 0) + 1));
    const commentCountByPost = new Map<string, number>();
    (commentCounts ?? []).forEach((c) => commentCountByPost.set(c.post_id, (commentCountByPost.get(c.post_id) ?? 0) + 1));
    const myLikedSet = new Set((myLikes ?? []).map((l) => l.post_id));
    setFollowingEmails(new Set((myFollows ?? []).map((f) => f.following_email)));

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
  }, [user?.email, eventFilterId]);

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
          } else {
            setActivePostId((current) => (current === postId ? null : current));
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
      commentIds.length ? supabase.from('comment_likes').select('comment_id') : Promise.resolve({ data: [] }),
      user?.email && commentIds.length ? supabase.from('comment_likes').select('comment_id').eq('user_email', user.email) : Promise.resolve({ data: [] }),
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
  }

  async function submitComment() {
    if (!user?.email || !openComments || !newComment.trim()) return;
    const content = newComment.trim();
    setNewComment('');
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
    }
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

  if (loading) return <div className="flex h-[100dvh] items-center justify-center text-muted">Loading…</div>;

  if (posts.length === 0) {
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
              <p className="font-display text-xl font-semibold">You're not following anyone yet</p>
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
              <button onClick={() => setReportingId(post.id)} className="text-white/70">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v5M12 16h.01" strokeLinecap="round" /></svg>
              </button>
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
        <div className="fixed inset-x-0 bottom-0 z-50 max-h-[70vh] rounded-t-2xl bg-surface p-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-bone">Comments</p>
            <button onClick={() => setOpenComments(null)} className="text-muted">✕</button>
          </div>
          <div className="mt-3 flex max-h-[45vh] flex-col gap-4 overflow-y-auto">
            {comments.length === 0 && <p className="text-sm text-muted">No comments yet. Be the first to say something.</p>}
            {comments.map((c) => (
              <div key={c.id} className="flex gap-2">
                {c.author_photo ? (
                  <img src={c.author_photo} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-marigold to-teal text-xs font-bold text-white">
                    {c.author_name.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <p className="text-sm font-medium text-bone">{c.author_name}</p>
                    <p className="text-xs text-muted">{timeAgo(c.created_at)}</p>
                  </div>
                  <p className="text-sm text-bone">{c.content}</p>
                  <div className="mt-1 flex items-center gap-3">
                    <button onClick={() => toggleCommentLike(c)} className="flex items-center gap-1 text-xs text-muted">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill={c.liked_by_me ? '#EC4899' : 'none'} stroke={c.liked_by_me ? '#EC4899' : 'currentColor'} strokeWidth="2">
                        <path d="M20.8 8.6c0 4.5-8.8 10.4-8.8 10.4S3.2 13.1 3.2 8.6a4.8 4.8 0 0 1 8.8-2.7 4.8 4.8 0 0 1 8.8 2.7z" strokeLinejoin="round" />
                      </svg>
                      {c.like_count > 0 && c.like_count}
                    </button>
                    {user?.email === c.author_email ? (
                      <button onClick={() => deleteComment(c.id)} className="text-xs text-muted">Delete</button>
                    ) : user ? (
                      <button onClick={() => setReportingCommentId(c.id)} className="text-xs text-muted">Report</button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {user ? (
            <div className="mt-3 flex gap-2">
              <input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment…"
                className="flex-1 rounded-full border border-gray-300 bg-surface2 px-4 py-2 text-sm text-bone outline-none focus-visible:border-marigold"
              />
              <button onClick={submitComment} className="rounded-full bg-marigold px-4 py-2 text-sm font-semibold text-white">
                Post
              </button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">
              <Link to="/login" className="text-marigold underline">Sign in</Link> to comment.
            </p>
          )}
        </div>
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
        <div className="fixed inset-0 z-[1050] flex items-center justify-center bg-black/50 p-4">
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
      {(isPaused || openComments || reportingId || showCreateModal) && <BottomTabBar />}
    </div>
  );
}
