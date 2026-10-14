import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { TapEvent } from '../../lib/types';
import DiscoverEventCard from './DiscoverEventCard';

export interface Promoted { boost_id: string; event_id: string; link_code: string | null }

// Viewer location only if they've already allowed it (never prompts).
async function quietLocation(): Promise<{ lat: number; lng: number } | null> {
  try {
    const perm = await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
    if (perm?.state !== 'granted') return null;
    return await new Promise((res) => navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res(null), { maximumAge: 600000, timeout: 4000 }));
  } catch { return null; }
}
export async function loadPromoted(): Promise<Promoted[]> {
  const loc = await quietLocation();
  const { data } = await supabase.rpc('promoted_events', { p_lat: loc?.lat ?? null, p_lng: loc?.lng ?? null });
  return (data ?? []) as Promoted[];
}

// Discover: "Promoted" row of boosted events (up to 6 nearby), always labeled.
export default function PromotedRow({ promoted, events, savedIds, onToggleSave }: { promoted: Promoted[]; events: TapEvent[]; savedIds: string[]; onToggleSave: (id: string) => void }) {
  const [extra, setExtra] = useState<TapEvent[]>([]);
  const missing = promoted.filter((p) => !events.some((e) => e.id === p.event_id)).map((p) => p.event_id);
  useEffect(() => {
    if (!missing.length) return;
    supabase.from('events').select('*').in('id', missing).then(({ data }) => setExtra((data ?? []) as TapEvent[]));
  }, [missing.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  // Count each boost once per visit.
  useEffect(() => {
    if (!promoted.length) return;
    let seen: string[] = [];
    try { seen = JSON.parse(sessionStorage.getItem('tapin_boost_seen') ?? '[]'); } catch { /* storage unavailable */ }
    const fresh = promoted.map((p) => p.boost_id).filter((id) => !seen.includes(id));
    if (!fresh.length) return;
    supabase.rpc('record_boost_impressions', { p_boost_ids: fresh });
    try { sessionStorage.setItem('tapin_boost_seen', JSON.stringify([...seen, ...fresh])); } catch { /* storage unavailable */ }
  }, [promoted.map((p) => p.boost_id).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = promoted.map((p) => ({ p, event: events.find((e) => e.id === p.event_id) ?? extra.find((e) => e.id === p.event_id) })).filter((r) => r.event);
  if (!rows.length) return null;
  return (
    <div className="mt-6">
      <h2 className="font-display text-xl font-bold text-gray-900">🚀 Promoted</h2>
      <div className="-mx-1 mt-3 flex snap-x gap-4 overflow-x-auto px-1 pb-3">
        {rows.map(({ p, event }) => (
          <div key={p.boost_id} className="w-[280px] shrink-0 snap-start">
            <DiscoverEventCard event={event!} isSaved={savedIds.includes(event!.id)} onToggleSave={onToggleSave} promoted linkSuffix={p.link_code ? `?src=${p.link_code}` : ''} />
          </div>
        ))}
      </div>
    </div>
  );
}
