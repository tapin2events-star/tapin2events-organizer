import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useEscapeKey } from '../../lib/useEscapeKey';

interface FollowListEntry {
  email: string;
  full_name: string | null;
  profile_photo: string | null;
  is_organizer: boolean | null;
  is_resource: boolean | null;
  i_follow: boolean;
}

interface FollowListModalProps {
  email: string;
  direction: 'followers' | 'following';
  isPrivate: boolean;
  isOwnList: boolean;
  onClose: () => void;
}

const PAGE = 30;

// Followers / following, loaded 30 at a time as you scroll, with name search and
// follow/unfollow on each row. Private lists are enforced by the database too.
export default function FollowListModal({ email, direction, isPrivate, isOwnList, onClose }: FollowListModalProps) {
  const { user } = useAuth();
  useEscapeKey(onClose);
  const [entries, setEntries] = useState<FollowListEntry[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [hidden, setHidden] = useState(isPrivate && !isOwnList);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  // Wait until typing pauses before searching.
  useEffect(() => {
    const t = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const fetchPage = useCallback(async (offset: number) => {
    const id = ++requestId.current;
    const { data, error: e } = await supabase.rpc('get_follow_page', { p_email: email, p_direction: direction, p_search: query, p_limit: PAGE, p_offset: offset });
    if (id !== requestId.current) return; // a newer search replaced this one
    if (e || !data) { setError(true); return; }
    setError(false);
    setHidden(!!data.hidden);
    setTotal(Number(data.total ?? 0));
    const rows = (data.rows ?? []) as FollowListEntry[];
    setEntries((prev) => (offset === 0 ? rows : [...prev, ...rows.filter((r) => !prev.some((p) => p.email === r.email))]));
  }, [email, direction, query]);

  // First page (and again whenever the search changes).
  useEffect(() => {
    if (isPrivate && !isOwnList) { setLoading(false); return; }
    setLoading(true);
    scrollRef.current?.scrollTo({ top: 0 });
    fetchPage(0).finally(() => setLoading(false));
  }, [fetchPage, isPrivate, isOwnList]);

  const hasMore = total != null && entries.length < total;

  // Load the next page when the bottom of the list scrolls into view.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loading) return;
    const obs = new IntersectionObserver((items) => {
      if (items[0]?.isIntersecting && !loadingMore) {
        setLoadingMore(true);
        fetchPage(entries.length).finally(() => setLoadingMore(false));
      }
    }, { root: scrollRef.current, rootMargin: '200px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loading, loadingMore, entries.length, fetchPage]);

  async function toggleFollow(entry: FollowListEntry) {
    if (!user?.email || busyEmail) return;
    setBusyEmail(entry.email);
    const { error: e } = entry.i_follow
      ? await supabase.from('follows').delete().eq('follower_email', user.email).eq('following_email', entry.email)
      : await supabase.from('follows').insert({ follower_email: user.email, following_email: entry.email });
    setBusyEmail(null);
    if (!e) setEntries((prev) => prev.map((x) => (x.email === entry.email ? { ...x, i_follow: !x.i_follow } : x)));
  }

  const title = direction === 'followers' ? 'Followers' : 'Following';

  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex h-[85dvh] w-full max-w-md flex-col rounded-t-2xl bg-surface pb-[env(safe-area-inset-bottom)] sm:h-auto sm:max-h-[80vh] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <p className="font-semibold text-bone">
            {title}{total != null && !hidden && <span className="font-normal text-muted"> · {total.toLocaleString()}{query ? ' found' : ''}</span>}
          </p>
          <button onClick={onClose} aria-label="Close" className="-mr-2 rounded-lg p-2 text-muted hover:bg-gray-100">✕</button>
        </div>

        {!hidden && (
          <div className="border-b border-gray-100 px-3 py-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name"
              aria-label={`Search ${title.toLowerCase()}`}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 placeholder:text-gray-400"
            />
          </div>
        )}

        <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain p-2">
          {hidden ? (
            <p className="p-6 text-center text-sm text-muted">This person's {direction} list is private.</p>
          ) : loading ? (
            <p className="p-6 text-center text-sm text-muted">Loading…</p>
          ) : error && entries.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted">Couldn't load this list. Please try again.</p>
          ) : entries.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted">
              {query ? `No one named "${query}".` : direction === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
            </p>
          ) : (
            <>
              {entries.map((entry) => {
                const isMe = entry.email === user?.email;
                return (
                  <div key={entry.email} className="flex items-center gap-3 rounded-xl p-2 hover:bg-surface2">
                    <Link to={`/creator/${encodeURIComponent(entry.email)}`} onClick={onClose} className="flex min-w-0 flex-1 items-center gap-3">
                      {entry.profile_photo ? (
                        <img src={entry.profile_photo} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-marigold to-teal text-sm font-bold text-white">
                          {(entry.full_name || '?').charAt(0).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-bone">{entry.full_name || 'TapIN member'}{isMe && <span className="text-muted"> (you)</span>}</p>
                        <div className="flex gap-1.5">
                          {entry.is_organizer && <span className="text-xs text-marigold">Organizer</span>}
                          {entry.is_organizer && entry.is_resource && <span className="text-xs text-muted">·</span>}
                          {entry.is_resource && <span className="text-xs text-purple">Resource</span>}
                        </div>
                      </div>
                    </Link>
                    {user && !isMe && (
                      <button
                        onClick={() => toggleFollow(entry)}
                        disabled={busyEmail === entry.email}
                        aria-pressed={entry.i_follow}
                        aria-label={`${entry.i_follow ? 'Unfollow' : 'Follow'} ${entry.full_name || 'this person'}`}
                        className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                          entry.i_follow ? 'border border-gray-300 bg-white text-gray-700 hover:border-red-300 hover:text-red-600' : 'bg-marigold text-white hover:bg-marigold/90'
                        }`}
                      >
                        {entry.i_follow ? 'Following' : 'Follow'}
                      </button>
                    )}
                  </div>
                );
              })}
              {hasMore && <div ref={sentinelRef} className="p-4 text-center text-xs text-muted">{loadingMore ? 'Loading more…' : ''}</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
