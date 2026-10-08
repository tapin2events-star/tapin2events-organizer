import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

interface Appearance { event_id: string; title: string; start_date: string | null; location_name: string | null; is_online: boolean | null; poster_url: string | null; role: string | null }

// Public events this resource or group is on the lineup for.
export default function UpcomingAppearances({ resourceId, name }: { resourceId: string; name: string }) {
  const [items, setItems] = useState<Appearance[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    supabase.rpc('resource_appearances', { p_resource_id: resourceId }).then(({ data }) => {
      setItems(((data ?? []) as Appearance[]).sort((a, b) => String(a.start_date).localeCompare(String(b.start_date))));
    });
  }, [resourceId]);
  if (!items || items.length === 0) return null;
  const visible = showAll ? items : items.slice(0, 4);
  return (
    <div className="mt-6 border-t border-gray-200 pt-6">
      <h2 className="font-display text-lg font-semibold text-gray-900">Upcoming appearances</h2>
      <p className="text-sm text-gray-500">Where to catch {name} next.</p>
      <div className="mt-3 flex flex-col gap-2">
        {visible.map((a) => {
          const d = a.start_date ? new Date(a.start_date) : null;
          return (
            <Link key={a.event_id} to={`/events/${a.event_id}`} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 hover:border-marigold">
              {d ? (
                <span className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-marigold/10 text-marigold">
                  <span className="text-[11px] font-bold uppercase">{d.toLocaleDateString('en-US', { month: 'short' })}</span>
                  <span className="text-xl font-extrabold leading-none">{d.getDate()}</span>
                </span>
              ) : <span className="h-14 w-14 shrink-0 rounded-xl bg-gray-100" />}
              <span className="min-w-0 flex-1">
                {a.role && <span className="block truncate text-xs font-semibold uppercase tracking-wide text-marigold">{a.role}</span>}
                <span className="block truncate font-medium text-gray-900">{a.title}</span>
                <span className="block truncate text-xs text-gray-500">
                  {d ? d.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }).replace(':00 ', ' ') : 'Date TBA'}
                  {a.is_online ? ' · Online' : a.location_name ? ` · ${a.location_name}` : ''}
                </span>
              </span>
              {a.poster_url && <img src={a.poster_url} alt="" className="hidden h-14 w-14 shrink-0 rounded-lg object-cover sm:block" />}
            </Link>
          );
        })}
      </div>
      {items.length > 4 && (
        <button onClick={() => setShowAll((v) => !v)} className="mt-2 text-sm font-medium text-marigold hover:underline">
          {showAll ? 'Show fewer' : `See all ${items.length}`}
        </button>
      )}
    </div>
  );
}
