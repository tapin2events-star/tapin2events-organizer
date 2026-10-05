import { useEffect, useMemo, useRef, useState } from 'react';
import BackButton from '../components/BackButton';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import type { TapEvent } from '../lib/types';
import DiscoverEventCard from '../components/discover/DiscoverEventCard';
import { useMyTickets } from '../lib/useMyTickets';
import { EventCardGridSkeleton } from '../components/ui/Skeleton';

type When = 'upcoming' | 'past' | 'all';
type Price = 'any' | 'free' | 'paid';
type Sort = 'date' | 'recent';

// Events count as over once their end (or start, if no end) has passed.
function isPast(e: TapEvent, now: number) {
  const end = e.end_date ?? e.start_date;
  return !!end && new Date(end).getTime() < now;
}

// Saved events live in profiles.saved_event_ids (a list of event IDs, newest
// last) -- the same list Discover and event pages update, so this page and
// every save button stay in sync.
export default function SavedEvents() {
  const { user } = useAuth();
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [events, setEvents] = useState<TapEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [when, setWhen] = useState<When>('upcoming');
  const [price, setPrice] = useState<Price>('any');
  const [category, setCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>('date');
  const [undo, setUndo] = useState<{ id: string; index: number } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const myTickets = useMyTickets(user?.email);

  useEffect(() => {
    if (!user?.email) return;
    (async () => {
      const { data: profile } = await supabase.from('profiles').select('saved_event_ids').eq('email', user.email!).single();
      const ids = (profile?.saved_event_ids as string[]) ?? [];
      setSavedIds(ids);
      if (ids.length) {
        const { data } = await supabase.from('events').select('*').in('id', ids);
        setEvents((data ?? []) as TapEvent[]);
      }
      setLoading(false);
    })();
  }, [user?.email]);

  async function persist(next: string[]) {
    setSavedIds(next);
    if (user?.email) await supabase.from('profiles').update({ saved_event_ids: next }).eq('email', user.email);
  }

  function unsave(id: string) {
    const index = savedIds.indexOf(id);
    if (index < 0) return;
    persist(savedIds.filter((x) => x !== id));
    setUndo({ id, index });
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 6000);
  }

  function undoUnsave() {
    if (!undo) return;
    const next = [...savedIds];
    next.splice(Math.min(undo.index, next.length), 0, undo.id);
    persist(next);
    setUndo(null);
  }

  const now = Date.now();
  // Only events still in the saved list (unsaving hides a card immediately).
  const saved = useMemo(() => events.filter((e) => savedIds.includes(e.id)), [events, savedIds]);
  const counts = useMemo(
    () => ({
      upcoming: saved.filter((e) => !isPast(e, now)).length,
      past: saved.filter((e) => isPast(e, now)).length,
      all: saved.length,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [saved]
  );
  const categories = useMemo(() => [...new Set(saved.map((e) => e.category).filter(Boolean) as string[])].sort(), [saved]);

  const visible = useMemo(() => {
    const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const list = saved.filter((e) => {
      if (when === 'upcoming' && isPast(e, now)) return false;
      if (when === 'past' && !isPast(e, now)) return false;
      if (price === 'free' && e.event_type !== 'free') return false;
      if (price === 'paid' && e.event_type !== 'paid') return false;
      if (category && e.category !== category) return false;
      if (words.length) {
        const hay = [e.title, e.location_name, e.category, e.is_online ? 'online virtual' : ''].filter(Boolean).join(' ').toLowerCase();
        if (!words.every((w) => hay.includes(w))) return false;
      }
      return true;
    });
    if (sort === 'recent') return list.sort((a, b) => savedIds.indexOf(b.id) - savedIds.indexOf(a.id));
    const time = (e: TapEvent) => (e.start_date ? new Date(e.start_date).getTime() : Infinity);
    // Upcoming: soonest first. Past: most recent first.
    return list.sort((a, b) => (when === 'past' ? time(b) - time(a) : time(a) - time(b)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved, search, when, price, category, sort, savedIds]);

  const filtersActive = !!search.trim() || price !== 'any' || !!category;
  const pill = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-sm font-medium ${active ? 'bg-marigold text-white' : 'bg-gray-100 text-muted hover:bg-gray-200'}`;

  if (!user) {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="font-display text-3xl font-extrabold text-bone">Saved Events</h1>
        <p className="mt-2 text-muted"><Link to="/login" className="font-medium text-marigold">Sign in</Link> to see the events you've saved.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <BackButton fallback="/profile" fallbackLabel="Profile" />
      <h1 className="mt-2 font-display text-3xl font-extrabold text-bone">Saved Events</h1>
      <p className="mt-1 text-muted">Events you've bookmarked. Tap the bookmark on any card to remove it.</p>

      {loading ? (
        <EventCardGridSkeleton count={3} />
      ) : saved.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-14 text-center">
          <p className="font-display text-lg font-semibold text-bone">No saved events yet</p>
          <p className="mt-1 text-sm text-muted">Tap the bookmark icon on any event to keep track of it here.</p>
          <Link to="/" className="mt-4 inline-block rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-white">Discover events</Link>
        </div>
      ) : (
        <>
          <div className="relative mt-6">
            <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your saved events"
              aria-label="Search saved events"
              className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-base text-gray-900 outline-none placeholder:text-gray-400 focus-visible:border-marigold"
            />
          </div>

          <div className="mt-3 flex flex-col gap-3 rounded-xl border border-gray-200 bg-surface2 p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 w-14 text-xs font-semibold uppercase tracking-wide text-muted">When</span>
              {(['upcoming', 'past', 'all'] as When[]).map((w) => (
                <button key={w} type="button" onClick={() => setWhen(w)} className={pill(when === w)}>
                  {w === 'upcoming' ? 'Upcoming' : w === 'past' ? 'Past' : 'All'} ({counts[w]})
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 w-14 text-xs font-semibold uppercase tracking-wide text-muted">Price</span>
              {(['any', 'free', 'paid'] as Price[]).map((p) => (
                <button key={p} type="button" onClick={() => setPrice(p)} className={pill(price === p)}>
                  {p === 'any' ? 'Any' : p === 'free' ? 'Free' : 'Paid'}
                </button>
              ))}
            </div>
            {categories.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 w-14 text-xs font-semibold uppercase tracking-wide text-muted">Type</span>
                <button type="button" onClick={() => setCategory(null)} className={pill(category === null)}>All</button>
                {categories.map((c) => (
                  <button key={c} type="button" onClick={() => setCategory(c)} className={pill(category === c)}>{c}</button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 w-14 text-xs font-semibold uppercase tracking-wide text-muted">Sort</span>
              <button type="button" onClick={() => setSort('date')} className={pill(sort === 'date')}>By date</button>
              <button type="button" onClick={() => setSort('recent')} className={pill(sort === 'recent')}>Recently saved</button>
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center">
              <p className="text-muted">
                {filtersActive
                  ? 'No saved events match these filters.'
                  : when === 'upcoming'
                    ? "None of your saved events are coming up. Check Past, or discover something new."
                    : 'No past saved events.'}
              </p>
              {filtersActive && (
                <button type="button" onClick={() => { setSearch(''); setPrice('any'); setCategory(null); }} className="mt-2 text-sm font-medium text-marigold hover:underline">
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
              {visible.map((e) => (
                <div key={e.id} className="relative">
                  {e.status === 'cancelled' && (
                    <span className="absolute left-3 top-12 z-10 rounded-full bg-red-600 px-2.5 py-1 text-xs font-semibold text-white shadow">Cancelled</span>
                  )}
                  {/* Faded so a cancelled event's buttons don't read as available. */}
                  <div className={e.status === 'cancelled' ? 'opacity-60 grayscale' : ''}>
                    <DiscoverEventCard event={e} isSaved onToggleSave={unsave} myTicket={myTickets.get(e.id) ?? null} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {undo && (
        <div className="fixed inset-x-0 bottom-[calc(6.5rem+env(safe-area-inset-bottom,0px))] z-[1200] mx-auto flex w-fit max-w-[90vw] items-center gap-4 rounded-full bg-gray-900 px-5 py-2.5 text-sm text-white shadow-xl md:bottom-8">
          <span>Removed from saved</span>
          <button type="button" onClick={undoUnsave} className="font-semibold text-teal-300 hover:underline">Undo</button>
        </div>
      )}
    </div>
  );
}
