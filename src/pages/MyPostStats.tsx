import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

// "Your posts": views, likes, comments and tips for the signed-in creator's Feed posts, with this week vs last week.
interface Stats {
  totals: { posts: number; views: number; likes: number; comments: number; tips: number };
  views_this_week: number; views_last_week: number;
  posts: { id: string; caption: string | null; thumbnail: string | null; is_video: boolean; created_at: string; views: number; likes: number; comments: number; tips: number }[];
}
const money = (n: number) => `$${Number(n).toFixed(Number(n) % 1 ? 2 : 0)}`;

export default function MyPostStats() {
  const { user } = useAuth();
  const [d, setD] = useState<Stats | null>(null);
  const [sort, setSort] = useState<'recent' | 'views' | 'likes'>('recent');
  useEffect(() => { if (user) supabase.rpc('my_post_stats').then(({ data }) => setD((data ?? null) as Stats | null)); }, [user]);
  if (!user) return <div className="mx-auto max-w-2xl px-4 py-10 text-sm text-muted">Sign in to see your stats.</div>;
  if (!d) return <div className="mx-auto max-w-2xl px-4 py-10 text-sm text-muted">Loading…</div>;
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
      <Link to="/feed" className="text-sm text-marigold">‹ Feed</Link>
      <h1 className="mt-2 font-display text-2xl font-bold text-bone">📊 Your posts</h1>
      <p className="mt-1 text-sm text-muted">Views count when someone watches for a couple of seconds (once per person per day). Your own views don&apos;t count. Everyone else sees a video&apos;s views once it passes 100.</p>
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
            <li key={p.id}>
              <Link to={`/feed?post=${p.id}`} className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-surface p-2 hover:border-marigold">
                {p.thumbnail ? <img src={p.thumbnail} alt="" className="h-16 w-12 shrink-0 rounded-lg object-cover" /> : <span className="flex h-16 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-lg" aria-hidden="true">{p.is_video ? '🎬' : '📝'}</span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-bone">{p.caption || (p.is_video ? 'Video' : 'Post')}</span>
                  <span className="block text-xs text-muted">{new Date(p.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  <span className="mt-1 flex flex-wrap gap-x-3 text-xs text-gray-600">
                    <span>👁 {p.views.toLocaleString()}</span><span>❤️ {p.likes}</span><span>💬 {p.comments}</span>{Number(p.tips) > 0 && <span>💵 {money(p.tips)}</span>}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
