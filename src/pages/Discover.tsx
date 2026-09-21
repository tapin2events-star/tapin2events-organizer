import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import type { TapEvent } from '../lib/types';
import DiscoverEventCard from '../components/discover/DiscoverEventCard';
import DiscoverMap from '../components/discover/DiscoverMap';

type DiscoverTab = 'all' | 'map' | 'today' | 'saved';

export default function Discover() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [events, setEvents] = useState<TapEvent[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [priceFilter, setPriceFilter] = useState<'' | 'free' | 'paid'>('');
  const [showFilters, setShowFilters] = useState(false);
  const [tab, setTab] = useState<DiscoverTab>('all');

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
      const { data } = await supabase.from('profiles').select('interests').eq('email', user.email).single();
      setSavedIds((data?.interests as string[]) ?? []);
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
    const seriesMap = new Map<string, TapEvent[]>();
    for (const e of events) {
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
  }, [events, search, category, priceFilter]);

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
    await supabase.from('profiles').update({ interests: next }).eq('email', user.email);
  }

  return (
    <div className="min-h-screen bg-ink">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="font-display text-4xl font-extrabold text-gray-900">Discover Events</h1>
        <p className="mt-1 text-lg text-gray-500">Find amazing events happening near you</p>

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
              showFilters || category || priceFilter ? 'border-marigold bg-marigold/10 text-marigold' : 'border-gray-300 bg-white text-gray-500'
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 5h16M7 12h10M10 19h4" strokeLinecap="round" /></svg>
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
          </div>
        )}

        <p className="mt-6 text-sm text-gray-500">
          {loading ? 'Loading…' : `${filtered.length} event${filtered.length === 1 ? '' : 's'} found`}
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
              className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition ${
                tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'map' ? (
          <DiscoverMap events={filtered} />
        ) : !loading && tabFiltered.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-white/60 py-16 text-center">
            <p className="text-lg font-semibold text-gray-500">
              {tab === 'saved' ? 'No saved events yet' : tab === 'today' ? 'Nothing happening today' : 'No events found'}
            </p>
            <p className="mt-1 text-gray-400">
              {tab === 'saved' ? 'Tap the bookmark icon on any event to save it here.' : 'Try adjusting your search or filters'}
            </p>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {tabFiltered.map((event) => (
              <DiscoverEventCard
                key={event.id}
                event={event}
                isSaved={savedIds.includes(event.id)}
                onToggleSave={toggleSave}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
