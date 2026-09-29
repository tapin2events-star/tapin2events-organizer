import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { RESOURCE_CATEGORIES, type Resource } from '../lib/types';
import { EventCardGridSkeleton } from '../components/ui/Skeleton';

function pricingLabel(r: Resource) {
  if (r.pricing_type === 'contact_quote') return 'Contact for quote';
  if (r.pricing_type === 'hourly') return `$${r.base_rate}/hr`;
  return `$${r.base_rate}`;
}

type Sort = 'rating' | 'price' | 'distance' | 'newest';

// Straight-line distance in miles.
function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

const selectClass = 'rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-base text-gray-900 outline-none focus-visible:border-marigold';

export default function ResourceDiscovery() {
  const [searchParams] = useSearchParams();
  const forEvent = searchParams.get('for_event');
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<Sort>('rating');
  const [maxPrice, setMaxPrice] = useState('');
  const [radius, setRadius] = useState('');
  const [minRating, setMinRating] = useState('');
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  function requestLocation(then?: () => void) {
    if (here) { then?.(); return; }
    if (!navigator.geolocation) { setLocError("Your browser can't share your location."); return; }
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocating(false); then?.(); },
      () => { setLocating(false); setLocError('Location is off, so we can\u2019t sort by distance. You can still search by city.'); },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('resources')
        .select('*')
        .eq('status', 'active')
        .order('average_rating', { ascending: false });
      setResources((data ?? []) as Resource[]);
      setLoading(false);
    })();
  }, []);

  const distanceOf = (r: Resource) =>
    here && r.latitude != null && r.longitude != null ? milesBetween(here, { lat: Number(r.latitude), lng: Number(r.longitude) }) : null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cap = maxPrice ? Number(maxPrice) : null;
    const within = radius ? Number(radius) : null;
    const stars = minRating ? Number(minRating) : null;
    const list = resources
      .filter((r) => {
        if (!q) return true;
        const hay = [r.display_name, r.bio, r.city, r.state, ...(r.categories ?? [])].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(q);
      })
      .filter((r) => !category || (r.categories ?? []).includes(category))
      // "Contact for quote" has no listed price, so it's kept out only when a price cap is set.
      .filter((r) => cap == null || (r.pricing_type !== 'contact_quote' && Number(r.base_rate ?? 0) <= cap))
      .filter((r) => stars == null || (r.review_count > 0 && Number(r.average_rating ?? 0) >= stars))
      .filter((r) => {
        if (within == null || !here) return true;
        const d = distanceOf(r);
        return d != null && d <= within;
      });
    const priceOf = (r: Resource) => (r.pricing_type === 'contact_quote' ? Infinity : Number(r.base_rate ?? 0));
    return [...list].sort((a, b) => {
      if (sort === 'price') return priceOf(a) - priceOf(b);
      if (sort === 'distance') return (distanceOf(a) ?? Infinity) - (distanceOf(b) ?? Infinity);
      if (sort === 'newest') return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''));
      return Number(b.average_rating ?? 0) - Number(a.average_rating ?? 0) || (b.review_count ?? 0) - (a.review_count ?? 0);
    });
  }, [resources, search, category, maxPrice, radius, minRating, sort, here]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtersOn = !!(category || maxPrice || radius || minRating || search);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-4xl font-extrabold text-gray-900">Artists &amp; Resources</h1>
            <p className="mt-1 text-lg text-gray-500">Find vendors, artists, and service providers for your next event</p>
          </div>
          <Link
            to="/resources/new"
            className="rounded-lg bg-gradient-to-r from-marigold to-teal px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            Become a Resource
          </Link>
        </div>

        {forEvent && (
          <div className="mt-4 rounded-xl bg-marigold/10 px-4 py-2.5 text-sm text-marigold">
            Booking a resource for your event — pick one below to continue.
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, specialty, or city"
            type="search"
            aria-label="Search resources"
            className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-base text-gray-900 outline-none placeholder:text-gray-400 focus-visible:border-marigold"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Category"
            className={selectClass}
          >
            <option value="">All categories</option>
            {RESOURCE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
          <select value={sort} aria-label="Sort by" className={selectClass}
            onChange={(e) => { const v = e.target.value as Sort; if (v === 'distance') requestLocation(() => setSort('distance')); else setSort(v); }}>
            <option value="rating">Top rated</option>
            <option value="price">Lowest price</option>
            <option value="distance">Nearest to me</option>
            <option value="newest">Newest</option>
          </select>
          <select value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} aria-label="Price" className={selectClass}>
            <option value="">Any price</option>
            <option value="100">Up to $100</option>
            <option value="250">Up to $250</option>
            <option value="500">Up to $500</option>
            <option value="1000">Up to $1,000</option>
          </select>
          <select value={radius} aria-label="Distance" className={selectClass}
            onChange={(e) => { const v = e.target.value; if (v) requestLocation(() => setRadius(v)); else setRadius(''); }}>
            <option value="">Any distance</option>
            <option value="10">Within 10 miles</option>
            <option value="25">Within 25 miles</option>
            <option value="50">Within 50 miles</option>
            <option value="100">Within 100 miles</option>
          </select>
          <select value={minRating} onChange={(e) => setMinRating(e.target.value)} aria-label="Rating" className={selectClass}>
            <option value="">Any rating</option>
            <option value="4">4★ and up</option>
            <option value="4.5">4.5★ and up</option>
          </select>
        </div>
        {locating && <p className="mt-2 text-sm text-gray-500">Finding your location…</p>}
        {locError && <p className="mt-2 text-sm text-orange-700">{locError}</p>}

        <p className="mt-6 text-sm text-gray-500">
          {loading ? <span aria-hidden className="inline-block h-4 w-28 rounded-md bg-gray-200/80 align-middle motion-safe:animate-pulse" /> : <>
            {filtered.length} resource{filtered.length === 1 ? '' : 's'} found
            {filtersOn && (
              <button type="button" className="ml-2 font-medium text-marigold hover:underline"
                onClick={() => { setSearch(''); setCategory(''); setMaxPrice(''); setRadius(''); setMinRating(''); }}>
                Clear filters
              </button>
            )}
          </>}
        </p>

        {loading ? (
          <EventCardGridSkeleton count={6} className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3" />
        ) : filtered.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-white/60 py-16 text-center">
            <p className="text-lg font-semibold text-gray-500">No resources found</p>
            <p className="mt-1 text-gray-400">Try a different search or category</p>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((r) => (
              <Link
                key={r.id}
                to={`/resources/${r.id}${forEvent ? `?for_event=${forEvent}` : ''}`}
                className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-lg"
              >
                {r.profile_image ? (
                  <img src={r.profile_image} alt="" className="h-40 w-full object-cover" />
                ) : (
                  <div className="flex h-40 w-full items-center justify-center bg-gradient-to-br from-indigo-100 to-teal-100">
                    <span className="font-display text-3xl font-extrabold text-indigo-300">
                      {r.display_name.charAt(0)}
                    </span>
                  </div>
                )}
                <div className="p-5">
                  <p className="font-display text-lg font-bold text-gray-900">{r.display_name}</p>
                  {(r.city || r.state || distanceOf(r) != null) && (
                    <p className="mt-0.5 text-xs text-gray-400">
                      {[r.city, r.state].filter(Boolean).join(', ')}
                      {distanceOf(r) != null && `${r.city || r.state ? ' · ' : ''}${Math.round(distanceOf(r)!)} mi away`}
                    </p>
                  )}
                  <p className="mt-1 line-clamp-2 text-sm text-gray-500">{r.bio}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(r.categories ?? []).slice(0, 2).map((c) => (
                      <span key={c} className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">{c}</span>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 text-sm">
                    <span className="text-gray-500">
                      {r.review_count > 0 ? `\u2605 ${Number(r.average_rating ?? 0).toFixed(1)} (${r.review_count})` : 'No reviews yet'}
                    </span>
                    <span className="font-medium text-gray-900">{pricingLabel(r)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
