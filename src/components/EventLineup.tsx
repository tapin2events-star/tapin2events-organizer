import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

interface LineupResource {
  resource_id: string;
  display_name: string;
  profile_image: string | null;
  categories: string[] | null;
  average_rating: number | null;
  review_count: number | null;
}

// Artists and services confirmed for an event, shown on its public page. Only
// accepted bookings the organizer chose to list appear, and never anything
// about rates or who booked them.
export default function EventLineup({ eventId }: { eventId: string }) {
  const [items, setItems] = useState<LineupResource[]>([]);

  useEffect(() => {
    let cancelled = false;
    supabase.rpc('event_booked_resources', { p_event_id: eventId }).then(({ data, error }) => {
      if (!cancelled && !error) setItems((data ?? []) as LineupResource[]);
    });
    return () => { cancelled = true; };
  }, [eventId]);

  if (items.length === 0) return null;
  return (
    <div className="mt-10">
      <h2 className="font-display text-xl font-bold text-gray-900">Featured artists &amp; services</h2>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((r) => (
          <Link key={r.resource_id} to={`/resources/${r.resource_id}`} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition hover:border-marigold">
            {r.profile_image ? (
              <img src={r.profile_image} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-marigold to-teal text-lg font-bold text-white">{r.display_name.trim().charAt(0).toUpperCase()}</span>
            )}
            <span className="min-w-0">
              <span className="block truncate font-semibold text-gray-900">{r.display_name.trim()}</span>
              {r.categories && r.categories.length > 0 && <span className="block truncate text-xs text-gray-500">{[...new Set(r.categories.map((c) => c.trim()))].slice(0, 3).join(' · ')}</span>}
              {(r.review_count ?? 0) > 0 && <span className="block text-xs text-gray-500"><span className="text-orange-400">★</span> {Number(r.average_rating).toFixed(1)} ({r.review_count})</span>}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
