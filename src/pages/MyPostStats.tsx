import { useEffect, useState } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

// Feed post stats: views, likes, comments and tips, with this week vs last week. For you (/me/stats), an organization
// (/business/:slug/stats; Owners, Admins and Editors) or an artist/vendor profile (/resources/:id/stats; its owner).
interface Stats {
  totals: { posts: number; views: number; likes: number; comments: number; tips: number };
  views_this_week: number; views_last_week: number;
  posts: { id: string; caption: string | null; thumbnail: string | null; is_video: boolean; created_at: string; views: number; likes: number; comments: number; tips: number }[];
}
const money = (n: number) => `$${Number(n).toFixed(Number(n) % 1 ? 2 : 0)}`;

export default function MyPostStats() {
  const { user } = useAuth();
  const { slug, id } = useParams<{ slug?: string; id?: string }>();
  const { pathname } = useLocation();
  const scope: 'me' | 'org' | 'resource' = slug ? 'org' : pathname.startsWith('/resources/') ? 'resource' : 'me';
  const [d, setD] = useState<Stats | null | undefined>(undefined);
  const [who, setWho] = useState<{ name: string; back: string } | null>(null);
  const [sort, setSort] = useState<'recent' | 'views' | 'likes'>('recent');
  // Who liked / commented on a post (opens from its ❤️ and 💬 counts).
  const [engage, setEngage] = useState<{ postId: string; tab: 'likes' | 'comments' } | null>(null);
  useEffect(() => {
    if (!user) return;
    (async () => {
      let targetId: string | null = null;
      if (scope === 'org') {
        const { data: o } = await supabase.from('organizations').select('id, name').eq('slug', slug).maybeSingle();
        if (!o) { setD(null); return; }
        targetId = o.id; setWho({ name: o.name, back: `/business/${slug}/manage` });
      } else if (scope === 'resource') {
        const { data: r } = await supabase.from('resources').select('id, display_name').eq('id', id).maybeSingle();
        if (!r) { setD(null); return; }
        targetId = r.id; setWho({ name: r.display_name || 'Your profile', back: '/resources/dashboard' });
      }
      const { data } = await supabase.rpc('post_stats', { p_scope: scope, p_id: targetId });
      setD((data ?? null) as Stats | null);
    })();
  }, [user, scope, slug, id]);
  if (!user) return <div className="mx-auto max-w-2xl px-4 py-10 text-sm text-muted">Sign in to see stats.</div>;
  if (d === undefined) return <div className="mx-auto max-w-2xl px-4 py-10 text-sm text-muted">Loading…</div>;
  if (d === null) return <div className="mx-auto max-w-2xl px-4 py-10 text-sm text-muted">These stats aren&apos;t available to you.</div>;
  const change = d.views_last_week ? Math.round(((d.views_this_week - d.views_last_week) / d.views_last_week) * 100) : null;
  const posts = [...d.posts].sort((a, b) => (sort === 'views' ? b.views - a.views : sort === 'likes' ? b.likes - a.likes : +new Date(b.created_at) - +new Date(a.created_at)));
  const tile = (label: string, value: string) => (
    <div className="rounded-2xl border border-gray-200 bg-surface p-3 text-center">
      <p className="font-display text-2xl font-bold text-bone">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <Link to={who?.back ?? '/profile'} className="text-sm text-marigold">‹ Back</Link>
      <h1 className="mt-2 font-display text-2xl font-bold text-bone">📊 {who ? `${who.name}'s posts` : 'Your posts'}</h1>
      <p className="mt-1 text-sm text-muted">{scope === 'org' ? 'Posts made as this organization.' : scope === 'resource' ? 'Posts made as this profile.' : 'Your Feed posts.'} Views count when someone watches for a couple of seconds (once per person per day); the poster&apos;s own views don&apos;t count. Everyone sees a video&apos;s views once it passes 100.</p>
      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tile('Views', d.totals.views.toLocaleString())}
        {tile('Likes', d.totals.likes.toLocaleString())}
        {tile('Comments', d.totals.comments.toLocaleString())}
        {tile('Tips', money(d.totals.tips))}
      </div>
      <p className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-700">
        <strong>{d.views_this_week.toLocaleString()}</strong> views in the last 7 days
        {change !== null && <span className={change >= 0 ? 'text-green-700' : 'text-red-600'}> ({change >= 0 ? '+' : ''}{change}% vs the week before)</span>}
      </p>
      <div className="mt-6 flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-bone">{d.totals.posts} post{d.totals.posts === 1 ? '' : 's'}</h2>
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1 text-xs" role="radiogroup" aria-label="Sort posts">
          {(['recent', 'views', 'likes'] as const).map((k) => (
            <button key={k} role="radio" aria-checked={sort === k} onClick={() => setSort(k)} className={`rounded-lg px-2.5 py-1 font-semibold ${sort === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>{k === 'recent' ? 'Newest' : k === 'views' ? 'Most viewed' : 'Most liked'}</button>
          ))}
        </div>
      </div>
      {posts.length === 0 ? <p className="mt-3 text-sm text-muted">No posts yet. Share a video on the Feed to start seeing stats.</p> : (
        <ul className="mt-3 flex flex-col gap-2">
          {posts.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-surface p-2">
              <Link to={`/feed?post=${p.id}`} className="shrink-0" aria-label="Open in the Feed">
                {p.thumbnail ? <img src={p.thumbnail} alt="" className="h-16 w-12 rounded-lg object-cover" /> : <span className="flex h-16 w-12 items-center justify-center rounded-lg bg-gray-100 text-lg" aria-hidden="true">{p.is_video ? '🎬' : '📝'}</span>}
              </Link>
              <span className="min-w-0 flex-1">
                <Link to={`/feed?post=${p.id}`} className="block truncate text-sm font-medium text-bone hover:text-marigold">{p.caption || (p.is_video ? 'Video' : 'Post')}</Link>
                <span className="block text-xs text-muted">{new Date(p.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                <span className="mt-1 flex flex-wrap items-center gap-x-1 text-xs text-gray-600">
                  <span className="px-1.5 py-1">👁 {p.views.toLocaleString()}</span>
                  <button onClick={() => setEngage({ postId: p.id, tab: 'likes' })} className="rounded-md px-1.5 py-1 hover:bg-gray-100" aria-label={`${p.likes} likes. See who liked it`}>❤️ {p.likes}</button>
                  <button onClick={() => setEngage({ postId: p.id, tab: 'comments' })} className="rounded-md px-1.5 py-1 hover:bg-gray-100" aria-label={`${p.comments} comments. See who commented`}>💬 {p.comments}</button>
                  {Number(p.tips) > 0 && <span className="px-1.5 py-1">💵 {money(p.tips)}</span>}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {engage && <EngagementSheet postId={engage.postId} initialTab={engage.tab} onClose={() => setEngage(null)} />}
    </div>
  );
}

// Who liked and who commented on a post (names and photos; emails stay private).
function EngagementSheet({ postId, initialTab, onClose }: { postId: string; initialTab: 'likes' | 'comments'; onClose: () => void }) {
  const [tab, setTab] = useState(initialTab);
  const [d, setD] = useState<{ likes: { name: string; photo: string | null; at: string }[]; comments: { name: string; photo: string | null; text: string; at: string }[] } | null | undefined>(undefined);
  useEffect(() => { supabase.rpc('post_engagement', { p_post_id: postId }).then(({ data }) => setD((data ?? null) as typeof d)); }, [postId]); // eslint-disable-line react-hooks/exhaustive-deps
  const avatar = (name: string, photo: string | null) => photo
    ? <img src={photo} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
    : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-bold text-gray-600">{name.charAt(0).toUpperCase()}</span>;
  const when = (at: string) => new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Likes and comments" onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:rounded-3xl">
        <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 pb-2 pt-4">
          <div className="flex gap-1 rounded-xl bg-gray-100 p-1 text-sm" role="tablist">
            <button role="tab" aria-selected={tab === 'likes'} onClick={() => setTab('likes')} className={`rounded-lg px-3 py-1.5 font-semibold ${tab === 'likes' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>❤️ Likes{d ? ` (${d.likes.length})` : ''}</button>
            <button role="tab" aria-selected={tab === 'comments'} onClick={() => setTab('comments')} className={`rounded-lg px-3 py-1.5 font-semibold ${tab === 'comments' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>💬 Comments{d ? ` (${d.comments.length})` : ''}</button>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-2xl leading-none text-gray-400">×</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
          {d === undefined ? <p className="text-sm text-gray-500">Loading…</p> : d === null ? <p className="text-sm text-gray-500">This isn&apos;t available.</p>
            : tab === 'likes' ? (
              d.likes.length === 0 ? <p className="text-sm text-gray-500">No likes yet.</p> : (
                <ul className="flex flex-col gap-3">{d.likes.map((l, i) => (
                  <li key={i} className="flex items-center gap-3">{avatar(l.name, l.photo)}<span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">{l.name}</span><span className="text-xs text-gray-400">{when(l.at)}</span></li>
                ))}</ul>)
            ) : (
              d.comments.length === 0 ? <p className="text-sm text-gray-500">No comments yet.</p> : (
                <ul className="flex flex-col gap-4">{d.comments.map((c, i) => (
                  <li key={i} className="flex gap-3">{avatar(c.name, c.photo)}<span className="min-w-0 flex-1"><span className="flex items-baseline justify-between gap-2"><span className="truncate text-sm font-semibold text-gray-900">{c.name}</span><span className="shrink-0 text-xs text-gray-400">{when(c.at)}</span></span><span className="block whitespace-pre-wrap break-words text-sm text-gray-700">{c.text}</span></span></li>
                ))}</ul>)
            )}
        </div>
      </div>
    </div>
  );
}
