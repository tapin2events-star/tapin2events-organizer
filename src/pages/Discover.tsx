import { useEffect, useMemo, useState } from 'react';
import GettingStarted from '../components/GettingStarted';
import { useFeature } from '../lib/preview';
import PromotedRow, { loadPromoted, type Promoted } from '../components/discover/PromotedRow';
import FeaturedOrgs from '../components/business/FeaturedOrgs';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import type { TapEvent } from '../lib/types';
import DiscoverEventCard from '../components/discover/DiscoverEventCard';
import PickedForYou from '../components/discover/PickedForYou';
import { useMyTickets } from '../lib/useMyTickets';
import DiscoverMap from '../components/discover/DiscoverMap';
import { EventCardGridSkeleton } from '../components/ui/Skeleton';

type DiscoverTab = 'all' | 'map' | 'today' | 'saved';

export default function Discover() {
  // Boost (Preview): promoted events row + promoted first in search results.
  const promoteOn = useFeature('promote');
  const [promoted, setPromoted] = useState<Promoted[]>([]);
  useEffect(() => { if (promoteOn) loadPromoted().then(setPromoted); }, [promoteOn]);
  const promotedCode = (id: string) => promoted.find((p) => p.event_id === id)?.link_code ?? null;
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [events, setEvents] = useState<TapEvent[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  // 'waiting' until Picked for you is ready; 'skipped' if it took too long,
  // so it never appears late and pushes the list down.
  const [picksState, setPicksState] = useState<'waiting' | 'ready' | 'skipped'>('waiting');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [priceFilter, setPriceFilter] = useState<'' | 'free' | 'paid'>('');
  const [dateFilter, setDateFilter] = useState<'' | 'today' | 'tomorrow' | 'weekend' | 'week' | 'month' | 'pick'>('');
  const [pickedDate, setPickedDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [tab, setTab] = useState<DiscoverTab>('all');
  const myTickets = useMyTickets(user?.email);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'published')
        .order('start_date', { ascending: true });
      setEvents((data ?? []) as TapEvent[]);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!user?.email) {
      setSavedIds([]);
      return;
    }
    (async () => {
      const { data } = await supabase.from('profiles').select('saved_event_ids').eq('email', user.email).single();
      setSavedIds((data?.saved_event_ids as string[]) ?? []);
    })();
  }, [user?.email]);

  const categories = useMemo(
    () => Array.from(new Set(events.map((e) => e.category).filter(Boolean))).sort(),
    [events]
  );

  const filtered = useMemo(() => {
    const now = new Date();

    // Group occurrences of the same recurring series together (parent_event_id,
    // or the event's own id if it's the parent) so the list shows one card
    // per series instead of every occurrence.
    // Date filter: keep events (or dates of a series) that overlap the chosen range.
    const range = (() => {
      const day = (offset: number) => { const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + offset); return d; };
      const endOf = (d: Date) => { const e = new Date(d); e.setHours(23, 59, 59, 999); return e; };
      switch (dateFilter) {
        case 'today': return [now, endOf(day(0))];
        case 'tomorrow': return [day(1), endOf(day(1))];
        case 'weekend': {
          const dow = now.getDay(); // 0 Sun … 6 Sat
          const friOffset = dow === 0 ? -2 : 5 - dow;
          const start = dow === 5 || dow === 6 || dow === 0 ? now : day(friOffset);
          return [start, endOf(day(dow === 0 ? 0 : 7 - dow))];
        }
        case 'week': return [now, endOf(day(6))];
        case 'month': return [now, endOf(day(29))];
        case 'pick': {
          if (!pickedDate) return null;
          const [y, m, d] = pickedDate.split('-').map(Number);
          const start = new Date(y, m - 1, d, 0, 0, 0, 0);
          return [start, endOf(start)];
        }
        default: return null;
      }
    })();
    const inRange = (e: TapEvent) => {
      if (!range) return true;
      if (!e.start_date) return false;
      const st = new Date(e.start_date).getTime();
      const en = new Date(e.end_date ?? e.start_date).getTime();
      return st <= range[1].getTime() && en >= range[0].getTime();
    };

    const seriesMap = new Map<string, TapEvent[]>();
    for (const e of events.filter(inRange)) {
      const seriesKey = e.parent_event_id || e.id;
      if (!seriesMap.has(seriesKey)) seriesMap.set(seriesKey, []);
      seriesMap.get(seriesKey)!.push(e);
    }

    const representatives: TapEvent[] = [];
    for (const group of seriesMap.values()) {
      if (group.length === 1) {
        representatives.push(group[0]);
        continue;
      }
      const upcoming = group
        .filter((e) => e.start_date && new Date(e.start_date) >= now)
        .sort((a, b) => new Date(a.start_date!).getTime() - new Date(b.start_date!).getTime());
      if (upcoming.length > 0) {
        representatives.push(upcoming[0]);
      } else {
        const mostRecent = [...group].sort((a, b) => new Date(b.start_date!).getTime() - new Date(a.start_date!).getTime());
        representatives.push(mostRecent[0]);
      }
    }

    return representatives
      .filter((e) => {
        if (e.is_recurring) return true;
        if (!e.start_date) return true;
        return new Date(e.start_date) >= now;
      })
      .filter((e) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          e.title.toLowerCase().includes(q) ||
          (e.location_name ?? '').toLowerCase().includes(q) ||
          (e.description ?? '').toLowerCase().includes(q)
        );
      })
      .filter((e) => !category || e.category === category)
      .filter((e) => !priceFilter || e.event_type === priceFilter);
  }, [events, search, category, priceFilter, dateFilter, pickedDate]);

  const tabFiltered = useMemo(() => {
    if (tab === 'saved') return filtered.filter((e) => savedIds.includes(e.id));
    if (tab === 'today') {
      const now = new Date();
      return filtered.filter((e) => e.start_date && new Date(e.start_date).toDateString() === now.toDateString());
    }
    return filtered;
  }, [filtered, tab, savedIds]);

  async function toggleSave(eventId: string) {
    if (!user?.email) {
      navigate('/login', { state: { from: location.pathname + location.search } });
      return;
    }
    const next = savedIds.includes(eventId)
      ? savedIds.filter((id) => id !== eventId)
      : [...savedIds, eventId];
    setSavedIds(next);
    await supabase.from('profiles').update({ saved_event_ids: next }).eq('email', user.email);
  }

  // "Picked for you" sits above the list; keep the list's placeholders up
  // until it's ready so it doesn't push the list down after it appears.
  const showPicks = tab === 'all' && !loading && !!user?.id && !!user?.email && !search.trim() && !category && !priceFilter;
  // Never let a slow or failed "Picked for you" hold the list back for long.
  useEffect(() => {
    if (!showPicks || picksState !== 'waiting') return;
    const timer = setTimeout(() => setPicksState('skipped'), 2500);
    return () => clearTimeout(timer);
  }, [showPicks, picksState]);

  return (
    <div className="min-h-screen bg-ink">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-extrabold text-gray-900">Discover Events</h1>
            <p className="mt-1 text-lg text-gray-500">Find amazing events happening near you</p>
          </div>
          {/* Desktop only: phones already have the + button in the tab bar.
              Signed-out visitors are sent to sign in first, then to the form. */}
          <Link to="/organizer/new"
            className="mt-1 hidden shrink-0 items-center gap-2 rounded-xl bg-marigold px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-marigold/90 md:inline-flex">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            Create event
          </Link>
        </div>

        <Link
          to="/resources"
          className="mt-8 flex items-center justify-center gap-2 rounded-xl border border-purple-200 bg-white px-4 py-3 font-semibold text-purple hover:border-purple-300"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="8" r="3" /><path d="M2 20c0-3 3-5 7-5s7 2 7 5" strokeLinecap="round" /><circle cx="17" cy="8" r="2.5" /><path d="M15 15.5c2.7.3 5 1.9 5 4.5" strokeLinecap="round" /></svg>
          Artists &amp; Resources
        </Link>

        <div className="mt-4 flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events, venues, or descriptions"
            className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none placeholder:text-gray-400 focus-visible:border-marigold"
          />
          <button
            onClick={() => setShowFilters((v) => !v)}
            aria-label="Toggle filters"
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
              showFilters || category || priceFilter || dateFilter ? 'border-marigold bg-marigold/10 text-marigold' : 'border-gray-300 bg-white text-gray-500'
            } relative`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 5h16M7 12h10M10 19h4" strokeLinecap="round" /></svg>
            {!showFilters && (category || priceFilter || dateFilter) && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-marigold ring-2 ring-white" aria-label="Filters are on" />}
          </button>
        </div>

        {showFilters && (
          <div className="mt-3 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none focus-visible:border-marigold"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              value={priceFilter}
              onChange={(e) => setPriceFilter(e.target.value as '' | 'free' | 'paid')}
              className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none focus-visible:border-marigold"
            >
              <option value="">Free &amp; paid</option>
              <option value="free">Free only</option>
              <option value="paid">Paid only</option>
            </select>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as typeof dateFilter)}
              aria-label="Date"
              className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none focus-visible:border-marigold"
            >
              <option value="">Any date</option>
              <option value="today">Today</option>
              <option value="tomorrow">Tomorrow</option>
              <option value="weekend">This weekend</option>
              <option value="week">Next 7 days</option>
              <option value="month">Next 30 days</option>
              <option value="pick">Pick a date…</option>
            </select>
            {dateFilter === 'pick' && (
              <input type="date" value={pickedDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setPickedDate(e.target.value)} aria-label="Pick a date"
                className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-base text-gray-900 outline-none focus-visible:border-marigold" />
            )}
            {(category || priceFilter || dateFilter) && (
              <button type="button" onClick={() => { setCategory(''); setPriceFilter(''); setDateFilter(''); setPickedDate(''); }}
                className="self-start text-sm font-medium text-marigold sm:self-center">Clear filters</button>
            )}
          </div>
        )}

        <p className="mt-6 text-sm text-gray-500">
          {loading ? <span aria-hidden className="inline-block h-4 w-28 rounded-md bg-gray-200/80 align-middle motion-safe:animate-pulse" /> : `${filtered.length} event${filtered.length === 1 ? '' : 's'} found`}
        </p>

        <div className="mt-3 flex gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1">
          {([
            { id: 'all', label: 'All Events' },
            { id: 'map', label: 'Map' },
            { id: 'today', label: 'Today' },
            { id: 'saved', label: 'Saved' },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 whitespace-nowrap rounded-lg px-2 py-2 text-sm font-medium transition sm:flex-none sm:px-4 ${
                tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab !== 'map' && !search.trim() && <GettingStarted />}
        {tab !== 'map' && (search.trim().length >= 2 || (!category && !priceFilter && !dateFilter)) && <FeaturedOrgs query={search} />}

        {promoteOn && tab !== 'map' && !search.trim() && !category && !priceFilter && !dateFilter && <PromotedRow promoted={promoted} events={events} savedIds={savedIds} onToggleSave={toggleSave} />}

        {showPicks && picksState !== 'skipped' && user?.id && user.email && (
          <PickedForYou events={events} savedIds={savedIds} userId={user.id} userEmail={user.email} onToggleSave={toggleSave} onReady={() => setPicksState((st) => (st === 'waiting' ? 'ready' : st))} />
        )}

        {tab === 'map' ? (
          <DiscoverMap events={filtered} />
        ) : loading || (showPicks && picksState === 'waiting') ? (
          <EventCardGridSkeleton />
        ) : tabFiltered.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-white/60 py-16 text-center">
            <p className="text-lg font-semibold text-gray-500">
              {tab === 'saved' ? 'No saved events yet' : tab === 'today' ? 'Nothing happening today' : 'No events found'}
            </p>
            <p className="mt-1 text-gray-400">
              {tab === 'saved' ? 'Tap the bookmark icon on any event to save it here.' : 'Try adjusting your search or filters'}
            </p>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
            {(search.trim() && promoted.length ? [...tabFiltered].sort((a, b) => Number(!!promotedCode(b.id)) - Number(!!promotedCode(a.id))) : tabFiltered).map((event) => (
              <DiscoverEventCard
                key={event.id}
                event={event}
                promoted={!!search.trim() && !!promotedCode(event.id)}
                linkSuffix={promotedCode(event.id) ? `?src=${promotedCode(event.id)}` : ''}
                isSaved={savedIds.includes(event.id)}
                onToggleSave={toggleSave}
                myTicket={myTickets.get(event.id) ?? null}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
