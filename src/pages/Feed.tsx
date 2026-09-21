import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import BottomTabBar from '../components/BottomTabBar';
import HlsVideo from '../components/feed/HlsVideo';
import CreatePostModal from '../components/feed/CreatePostModal';

interface Post {
  id: string;
  author_email: string;
  poster_type: 'organizer' | 'resource';
  caption: string | null;
  video_url: string;
  thumbnail_url: string | null;
  created_at: string;
  author_name: string;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
}

interface Comment {
  id: string;
  author_email: string;
  content: string;
  created_at: string;
}

export default function Feed() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [shareCopiedId, setShareCopiedId] = useState<string | null>(null);
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  async function loadPosts() {
    const { data: postRows, error } = await supabase
      .from('posts')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) {
      console.error('Failed to load feed:', error);
      setLoading(false);
      return;
    }
    const rows = postRows ?? [];
    const postIds = rows.map((p) => p.id);
    const authorEmails = [...new Set(rows.map((p) => p.author_email))];

    const [{ data: profiles }, { data: likes }, { data: commentCounts }, { data: myLikes }] = await Promise.all([
      authorEmails.length ? supabase.from('profiles').select('email, full_name').in('email', authorEmails) : Promise.resolve({ data: [] }),
      postIds.length ? supabase.from('post_likes').select('post_id') : Promise.resolve({ data: [] }),
      postIds.length ? supabase.from('post_comments').select('post_id').eq('status', 'active') : Promise.resolve({ data: [] }),
      user?.email && postIds.length ? supabase.from('post_likes').select('post_id').eq('user_email', user.email) : Promise.resolve({ data: [] }),
    ]);

    const namesByEmail = new Map((profiles ?? []).map((p) => [p.email, p.full_name]));
    const likeCountByPost = new Map<string, number>();
    (likes ?? []).forEach((l) => likeCountByPost.set(l.post_id, (likeCountByPost.get(l.post_id) ?? 0) + 1));
    const commentCountByPost = new Map<string, number>();
    (commentCounts ?? []).forEach((c) => commentCountByPost.set(c.post_id, (commentCountByPost.get(c.post_id) ?? 0) + 1));
    const myLikedSet = new Set((myLikes ?? []).map((l) => l.post_id));

    setPosts(
      rows.map((p) => ({
        ...p,
        author_name: namesByEmail.get(p.author_email) || p.author_email,
        like_count: likeCountByPost.get(p.id) ?? 0,
        comment_count: commentCountByPost.get(p.id) ?? 0,
        liked_by_me: myLikedSet.has(p.id),
      }))
    );
    setLoading(false);
  }

  useEffect(() => {
    loadPosts();
  }, [user?.email]);

  // TikTok-style feeds only autoplay whichever video is actually on
  // screen -- watch scroll position via IntersectionObserver and
  // play/pause videos accordingly, rather than relying on a single
  // `autoPlay` prop that never updates as the user scrolls.
  useEffect(() => {
    if (posts.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const postId = entry.target.getAttribute('data-post-id');
          const video = postId ? videoRefs.current[postId] : null;
          if (!video) return;
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        });
      },
      { threshold: [0, 0.6, 1] }
    );
    const slides = containerRef.current?.querySelectorAll('[data-post-id]') ?? [];
    slides.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [posts]);

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
    const { data } = await supabase
      .from('post_comments')
      .select('id, author_email, content, created_at')
      .eq('post_id', postId)
      .eq('status', 'active')
      .order('created_at', { ascending: true });
    setComments(data ?? []);
  }

  async function submitComment() {
    if (!user?.email || !openComments || !newComment.trim()) return;
    const content = newComment.trim();
    setNewComment('');
    const { data } = await supabase
      .from('post_comments')
      .insert({ post_id: openComments, author_email: user.email, content })
      .select()
      .single();
    if (data) {
      setComments((prev) => [...prev, data]);
      setPosts((prev) => prev.map((p) => (p.id === openComments ? { ...p, comment_count: p.comment_count + 1 } : p)));
    }
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

  if (loading) return <div className="flex h-screen items-center justify-center text-muted">Loading…</div>;

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
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-30 bg-black">
      <div ref={containerRef} className="h-full snap-y snap-mandatory overflow-y-scroll">
        {posts.map((post) => (
          <div key={post.id} data-post-id={post.id} className="relative flex h-screen w-full snap-start items-center justify-center bg-black">
            <HlsVideo
              videoRef={(el) => { videoRefs.current[post.id] = el; }}
              src={post.video_url}
              poster={post.thumbnail_url ?? undefined}
              className="h-full w-full object-contain"
              loop
              playsInline
              muted
              onClick={(e) => {
                const v = e.currentTarget;
                v.paused ? v.play() : v.pause();
              }}
            />

            <Link to="/" className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white">
              &larr;
            </Link>
            {user && (
              <button
                onClick={() => setShowCreateModal(true)}
                aria-label="New post"
                className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
              </button>
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
              <p className="font-semibold">{post.author_name}</p>
              <span className="inline-block rounded-full bg-white/15 px-2 py-0.5 text-xs">{post.poster_type}</span>
              {post.caption && <p className="mt-1 text-sm">{post.caption}</p>}
            </div>
          </div>
        ))}
      </div>

      {openComments && (
        <div className="fixed inset-x-0 bottom-0 z-50 max-h-[70vh] rounded-t-2xl bg-surface p-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-bone">Comments</p>
            <button onClick={() => setOpenComments(null)} className="text-muted">✕</button>
          </div>
          <div className="mt-3 flex max-h-[45vh] flex-col gap-3 overflow-y-auto">
            {comments.length === 0 && <p className="text-sm text-muted">No comments yet.</p>}
            {comments.map((c) => (
              <div key={c.id}>
                <p className="text-sm font-medium text-bone">{c.author_email}</p>
                <p className="text-sm text-muted">{c.content}</p>
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
      {showCreateModal && (
        <CreatePostModal onClose={() => setShowCreateModal(false)} onPosted={() => { setShowCreateModal(false); loadPosts(); }} />
      )}
      <BottomTabBar />
    </div>
  );
}
