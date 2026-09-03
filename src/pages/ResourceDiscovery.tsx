import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { RESOURCE_CATEGORIES, type Resource } from '../lib/types';

function pricingLabel(r: Resource) {
  if (r.pricing_type === 'contact_quote') return 'Contact for quote';
  if (r.pricing_type === 'hourly') return `$${r.base_rate}/hr`;
  return `$${r.base_rate}`;
}

export default function ResourceDiscovery() {
  const [searchParams] = useSearchParams();
  const forEvent = searchParams.get('for_event');
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('resources')
        .select('*')
        .order('average_rating', { ascending: false });
      setResources((data ?? []) as Resource[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    return resources
      .filter((r) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return r.display_name.toLowerCase().includes(q) || r.bio.toLowerCase().includes(q);
      })
      .filter((r) => !category || r.categories.includes(category));
  }, [resources, search, category]);

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
            className="rounded-lg bg-gradient-to-r from-marigold to-mint px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
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
            placeholder="Search by name or specialty"
            className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none placeholder:text-gray-400 focus-visible:border-marigold"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none focus-visible:border-marigold"
          >
            <option value="">All categories</option>
            {RESOURCE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <p className="mt-6 text-sm text-gray-500">
          {loading ? 'Loading…' : `${filtered.length} resource${filtered.length === 1 ? '' : 's'} found`}
        </p>

        {!loading && filtered.length === 0 ? (
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
                  {(r.city || r.state) && (
                    <p className="mt-0.5 text-xs text-gray-400">{[r.city, r.state].filter(Boolean).join(', ')}</p>
                  )}
                  <p className="mt-1 line-clamp-2 text-sm text-gray-500">{r.bio}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {r.categories.slice(0, 2).map((c) => (
                      <span key={c} className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">{c}</span>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 text-sm">
                    <span className="text-gray-500">
                      {r.review_count > 0 ? `\u2605 ${r.average_rating.toFixed(1)} (${r.review_count})` : 'No reviews yet'}
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
