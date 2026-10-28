import { useEffect, useState } from 'react';
import MyTips from '../components/tips/MyTips';
import { Link, useParams, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

// Feed post stats (mobile-first): views, likes, comments and tips, a 14-day views chart, the top post, and every post
// with large "who liked / who commented" buttons. For you (/me/stats), an organization (/business/:slug/stats; Owners,
// Admins and Editors) or an artist/vendor profile (/resources/:id/stats; its owner).
interface Post { id: string; caption: string | null; thumbnail: string | null; is_video: boolean; created_at: string; views: number; likes: number; comments: number; tips: number }
interface Stats {
  totals: { posts: number; views: number; likes: number; comments: number; tips: number };
  views_this_week: number; views_last_week: number;
  daily: { day: string; views: number }[];
  posts: Post[];
}
const money = (n: number) => `$${Number(n).toFixed(Number(n) % 1 ? 2 : 0)}`;
const compact = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M` : n >= 10_000 ? `${Math.round(n / 1000)}K` : n >= 1_000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K` : String(n));
const shortDate = (d: string) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export default function MyPostStats() {
  const { user } = useAuth();
  const { slug, id } = useParams<{ slug?: string; id?: string }>();
  const { pathname } = useLocation();
  const scope: 'me' | 'org' | 'resource' = slug ? 'org' : pathname.startsWith('/resources/') ? 'resource' : 'me';
  const [d, setD] = useState<Stats | null | undefined>(undefined);
  const [who, setWho] = useState<{ name: string; back: string } | null>(null);
  const [sort, setSort] = useState<'recent' | 'views' | 'likes'>('recent');
  const [info, setInfo] = useState(false);
  const [engage, setEngage] = useState<{ post: Post; tab: 'likes' | 'comments' } | null>(null);
  // Your commissions from promoting events (creator program and promotion links), on your own stats only.
  const [earnings, setEarnings] = useState<{ event_title: string; sent_cents: number; waiting_cents: number }[]>([]);
  useEffect(() => {
    if (!user || scope !== 'me') return;
    supabase.rpc('my_promoter_payouts').then(({ data }) => setEarnings(((data ?? []) as { event_title: string; sent_cents: number; waiting_cents: number }[]).filter((r) => Number(r.sent_cents) + Number(r.waiting_cents) > 0)));
  }, [user, scope]);
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

  const shell = (body: React.ReactNode) => <div className="mx-auto max-w-2xl px-4 pb-28 pt-4 sm:pt-6">{body}</div>;
  if (!user) return shell(<p className="py-10 text-sm text-muted">Sign in to see stats.</p>);
  if (d === undefined) return shell(
    <div className="animate-pulse">
      <div className="h-7 w-40 rounded bg-gray-200" />
      <div className="mt-5 grid grid-cols-2 gap-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-gray-100" />)}</div>
      <div className="mt-4 h-36 rounded-2xl bg-gray-100" />
    </div>
  );
  if (d === null) return shell(<p className="py-10 text-sm text-muted">These stats aren&apos;t available to you.</p>);

  const title = who ? who.name : 'Your posts';
  const change = d.views_last_week ? Math.round(((d.views_this_week - d.views_last_week) / d.views_last_week) * 100) : null;
  const maxDay = Math.max(1, ...d.daily.map((x) => x.views));
  const top = [...d.posts].sort((a, b) => b.views - a.views || b.likes - a.likes)[0];
  const posts = [...d.posts].sort((a, b) => (sort === 'views' ? b.views - a.views : sort === 'likes' ? b.likes - a.likes : +new Date(b.created_at) - +new Date(a.created_at)));
  const thumb = (p: Post, size: string) => p.thumbnail
    ? <img src={p.thumbnail} alt="" className={`${size} shrink-0 rounded-xl object-cover`} />
    : <span className={`${size} flex shrink-0 items-center justify-center rounded-xl bg-gray-100 text-2xl`} aria-hidden="true">{p.is_video ? '🎬' : '📝'}</span>;

  return shell(
    <>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link to={who?.back ?? '/profile'} aria-label="Back" className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-bone hover:bg-gray-100">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl font-bold text-bone sm:text-2xl">📊 {title}</h1>
          <p className="text-xs text-muted">{scope === 'org' ? 'Posts made as this organization' : scope === 'resource' ? 'Posts made as this profile' : 'How your Feed posts are doing'}</p>
        </div>
        <button onClick={() => setInfo((v) => !v)} aria-expanded={info} aria-label="How views are counted" className="flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-gray-100">ⓘ</button>
      </div>
      {info && (
        <p className="mt-2 rounded-xl bg-gray-50 p-3 text-xs leading-relaxed text-gray-600">
          A view counts when someone watches for a couple of seconds, once per person per day. The poster&apos;s own views don&apos;t count. Everyone can see a video&apos;s views once it passes 100; until then, only you can.
        </p>
      )}

      {d.totals.posts === 0 ? (
        <div className="mt-10 rounded-3xl border border-dashed border-gray-300 p-8 text-center">
          <p className="text-4xl" aria-hidden="true">🎬</p>
          <p className="mt-2 font-display text-lg font-bold text-bone">No posts yet</p>
          <p className="mt-1 text-sm text-muted">Share a video on the Feed, and its views, likes and comments will show up here.</p>
          <Link to="/feed" className="mt-4 inline-block rounded-full bg-marigold px-5 py-3 text-sm font-semibold text-white">Go to the Feed</Link>
        </div>
      ) : (
        <>
          {/* Totals */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: '👁', label: 'Views', value: compact(d.totals.views) },
              { icon: '❤️', label: 'Likes', value: compact(d.totals.likes) },
              { icon: '💬', label: 'Comments', value: compact(d.totals.comments) },
              { icon: '💵', label: 'Tips', value: money(d.totals.tips) },
            ].map((t) => (
              <div key={t.label} className="rounded-2xl border border-gray-200 bg-surface p-4">
                <p className="text-lg" aria-hidden="true">{t.icon}</p>
                <p className="mt-1 font-display text-2xl font-bold leading-none text-bone">{t.value}</p>
                <p className="mt-1 text-xs text-muted">{t.label}</p>
              </div>
            ))}
          </div>

          {/* 14-day views */}
          <section className="mt-4 rounded-2xl border border-gray-200 bg-surface p-4" aria-label="Views over the last 14 days">
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
              <p className="text-sm font-semibold text-bone">Views · last 14 days</p>
              {change !== null && <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${change >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}`}>{change >= 0 ? '▲' : '▼'} {Math.abs(change)}% vs last week</span>}
            </div>
            <p className="mt-0.5 text-xs text-muted"><strong className="text-bone">{d.views_this_week.toLocaleString()}</strong> in the last 7 days</p>
            <div className="mt-3 flex h-24 items-end gap-1">
              {d.daily.map((x) => (
                <div key={x.day} className="flex h-full flex-1 flex-col justify-end" title={`${shortDate(x.day)}: ${x.views} views`}>
                  <div className={`w-full rounded-t ${x.views ? 'bg-marigold' : 'bg-gray-200'}`} style={{ height: `${Math.max(4, (x.views / maxDay) * 100)}%` }} />
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-muted"><span>{shortDate(d.daily[0]?.day ?? '')}</span><span>Today</span></div>
          </section>

          {scope === 'me' && <MyTips />}
          {/* Commissions from promoting events */}
          {earnings.length > 0 && (
            <section className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-4">
              <p className="text-sm font-semibold text-green-900">💸 Your earnings from promoting events</p>
              <p className="mt-0.5 font-display text-2xl font-bold text-green-900">${(earnings.reduce((n, r) => n + Number(r.sent_cents) + Number(r.waiting_cents), 0) / 100).toFixed(2)}</p>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-green-900">
                {earnings.map((r, i) => (
                  <li key={i} className="flex justify-between gap-2"><span className="truncate">{r.event_title}</span><span className="shrink-0">${((Number(r.sent_cents) + Number(r.waiting_cents)) / 100).toFixed(2)}{Number(r.waiting_cents) > 0 ? ` (${(Number(r.waiting_cents) / 100).toFixed(2)} waiting)` : ''}</span></li>
                ))}
              </ul>
              {earnings.some((r) => Number(r.waiting_cents) > 0) && <p className="mt-2 text-xs text-green-800">Waiting amounts are paid once you connect payouts in your Profile.</p>}
            </section>
          )}

          {/* Top post */}
          {top && top.views + top.likes > 0 && (
            <Link to={`/feed?post=${top.id}`} className="mt-4 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3">
              {thumb(top, 'h-14 w-11')}
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-bold uppercase tracking-wide text-amber-800">⭐ Top post</span>
                <span className="block truncate text-sm font-semibold text-gray-900">{top.caption || 'Video'}</span>
                <span className="block text-xs text-gray-600">👁 {compact(top.views)} · ❤️ {compact(top.likes)} · 💬 {compact(top.comments)}</span>
              </span>
              <span className="text-amber-700" aria-hidden="true">›</span>
            </Link>
          )}

          {/* Posts */}
          <div className="mt-6">
            <h2 className="font-display text-lg font-bold text-bone">{d.totals.posts} post{d.totals.posts === 1 ? '' : 's'}</h2>
            <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1 text-xs sm:text-sm" role="radiogroup" aria-label="Sort posts">
              {(['recent', 'views', 'likes'] as const).map((k) => (
                <button key={k} role="radio" aria-checked={sort === k} onClick={() => setSort(k)} className={`rounded-lg px-2 py-2 font-semibold ${sort === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>{k === 'recent' ? 'Newest' : k === 'views' ? 'Most viewed' : 'Most liked'}</button>
              ))}
            </div>
          </div>
          <ul className="mt-3 flex flex-col gap-3">
            {posts.map((p) => (
              <li key={p.id} className="rounded-2xl border border-gray-200 bg-surface p-3">
                <Link to={`/feed?post=${p.id}`} className="flex gap-3">
                  {thumb(p, 'h-20 w-16')}
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-sm font-semibold text-bone">{p.caption || (p.is_video ? 'Video' : 'Post')}</span>
                    <span className="mt-1 block text-xs text-muted">{shortDate(p.created_at)}{Number(p.tips) > 0 ? ` · 💵 ${money(p.tips)} in tips` : ''}</span>
                    <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">👁 {compact(p.views)} views</span>
                  </span>
                </Link>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={() => setEngage({ post: p, tab: 'likes' })} className="flex min-h-[44px] items-center justify-between rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 active:bg-gray-50">
                    <span>❤️ <strong>{compact(p.likes)}</strong> {p.likes === 1 ? 'Like' : 'Likes'}</span><span className="text-gray-400" aria-hidden="true">›</span>
                  </button>
                  <button onClick={() => setEngage({ post: p, tab: 'comments' })} className="flex min-h-[44px] items-center justify-between rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 active:bg-gray-50">
                    <span>💬 <strong>{compact(p.comments)}</strong> {p.comments === 1 ? 'Comment' : 'Comments'}</span><span className="text-gray-400" aria-hidden="true">›</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      {engage && <EngagementSheet post={engage.post} initialTab={engage.tab} onClose={() => setEngage(null)} />}
    </>
  );
}

// Who liked and who commented on a post (names and photos; emails stay private).
function EngagementSheet({ post, initialTab, onClose }: { post: Post; initialTab: 'likes' | 'comments'; onClose: () => void }) {
  const [tab, setTab] = useState(initialTab);
  const [d, setD] = useState<{ likes: { name: string; photo: string | null; at: string }[]; comments: { name: string; photo: string | null; text: string; at: string }[] } | null | undefined>(undefined);
  useEffect(() => { supabase.rpc('post_engagement', { p_post_id: post.id }).then(({ data }) => setD((data ?? null) as typeof d)); }, [post.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  const avatar = (name: string, photo: string | null) => photo
    ? <img src={photo} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
    : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-bold text-gray-600">{name.charAt(0).toUpperCase()}</span>;
  const likes = d?.likes ?? []; const comments = d?.comments ?? [];
  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Likes and comments" onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:rounded-3xl">
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-gray-300 sm:hidden" aria-hidden="true" />
        <div className="flex items-start gap-3 px-4 pt-3">
          <p className="min-w-0 flex-1 truncate pt-2 text-sm font-semibold text-gray-900">{post.caption || 'Your post'}</p>
          <button onClick={onClose} aria-label="Close" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-2xl leading-none text-gray-400 hover:bg-gray-100">×</button>
        </div>
        <div className="grid grid-cols-2 gap-1 border-b border-gray-100 px-4 pb-3 pt-1" role="tablist">
          {(['likes', 'comments'] as const).map((k) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={`min-h-[44px] rounded-xl text-sm font-semibold ${tab === k ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {k === 'likes' ? `❤️ Likes · ${d ? likes.length : post.likes}` : `💬 Comments · ${d ? comments.length : post.comments}`}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
          {d === undefined ? (
            <ul className="flex animate-pulse flex-col gap-3">{[0, 1, 2].map((i) => <li key={i} className="flex items-center gap-3"><span className="h-10 w-10 rounded-full bg-gray-200" /><span className="h-3 w-32 rounded bg-gray-200" /></li>)}</ul>
          ) : d === null ? <p className="py-6 text-center text-sm text-gray-500">This isn&apos;t available.</p>
            : tab === 'likes' ? (
              likes.length === 0 ? <p className="py-8 text-center text-sm text-gray-500">No likes yet. They&apos;ll show up here.</p> : (
                <ul className="flex flex-col divide-y divide-gray-100">{likes.map((l, i) => (
                  <li key={i} className="flex min-h-[56px] items-center gap-3 py-2">{avatar(l.name, l.photo)}<span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">{l.name}</span><span className="text-xs text-gray-400">{shortDate(l.at)}</span></li>
                ))}</ul>)
            ) : (
              comments.length === 0 ? <p className="py-8 text-center text-sm text-gray-500">No comments yet. They&apos;ll show up here.</p> : (
                <ul className="flex flex-col divide-y divide-gray-100">{comments.map((c, i) => (
                  <li key={i} className="flex gap-3 py-3">{avatar(c.name, c.photo)}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2"><span className="truncate text-sm font-semibold text-gray-900">{c.name}</span><span className="shrink-0 text-xs text-gray-400">{shortDate(c.at)}</span></span>
                      <span className="mt-0.5 block whitespace-pre-wrap break-words text-sm text-gray-700">{c.text}</span>
                    </span>
                  </li>
                ))}</ul>)
            )}
        </div>
        {d && tab === 'comments' && (
          <div className="border-t border-gray-100 px-4 pt-2" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
            <Link to={`/feed?post=${post.id}`} className="flex min-h-[44px] items-center justify-center rounded-xl bg-marigold text-sm font-semibold text-white">Reply on the Feed</Link>
          </div>
        )}
      </div>
    </div>
  );
}
