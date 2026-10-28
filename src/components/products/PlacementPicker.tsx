import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

// Sell anywhere (preview): where else a product appears. Stock is shared: one count across every place.
export interface Place { kind: 'event' | 'resource'; id: string; title: string; subtitle: string }
export const placeKey = (p: { kind: string; id: string }) => `${p.kind}:${p.id}`;
export default function PlacementPicker({ homeKind, homeId, value, onChange }: { homeKind: 'event' | 'resource'; homeId: string; value: Set<string>; onChange: (v: Set<string>) => void }) {
  const [places, setPlaces] = useState<Place[] | null>(null);
  useEffect(() => { supabase.rpc('my_sell_places').then(({ data }) => setPlaces(((data ?? []) as Place[]).filter((p) => !(p.kind === homeKind && p.id === homeId)))); }, [homeKind, homeId]);
  if (!places || places.length === 0) return null;
  return (
    <fieldset className="rounded-xl border border-gray-200 p-3">
      <legend className="px-1 text-sm font-semibold text-gray-900">Also show this product on</legend>
      <p className="text-xs text-gray-500">One stock count for every place: a sale anywhere lowers what&apos;s left everywhere.</p>
      <div className="mt-2 flex flex-col gap-1.5">
        {places.map((p) => {
          const k = placeKey(p);
          return (
            <label key={k} className="flex items-center gap-2.5 rounded-lg px-1 py-1 text-sm text-gray-800">
              <input type="checkbox" checked={value.has(k)} onChange={(e) => { const n = new Set(value); if (e.target.checked) n.add(k); else n.delete(k); onChange(n); }} className="h-4 w-4 accent-marigold" />
              <span aria-hidden="true">{p.kind === 'event' ? '🎟️' : '🎤'}</span>
              <span className="min-w-0"><span className="block truncate font-medium">{p.title}</span><span className="block truncate text-xs text-gray-500">{p.subtitle}</span></span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
