import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { buyMusic } from './musicBuy';
import type { Sale } from '../components/music/MusicPlayerCard';

// Which songs the signed-in person owns (bought directly, or via the album).
export function useOwnedTracks(ids: string[], signedIn: boolean) {
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const key = ids.join(',');
  useEffect(() => {
    if (!signedIn || !ids.length) { setOwned(new Set()); return; }
    supabase.rpc('music_owned', { p_track_ids: ids }).then(({ data }) => setOwned(new Set((data ?? []) as string[])));
  }, [key, signedIn]); // eslint-disable-line react-hooks/exhaustive-deps
  return owned;
}
export const saleFor = (kind: 'album' | 'track', id: string, price: number | null | undefined, owned: boolean): Sale | null => (price && price > 0 ? { kind, id, price: Number(price), owned } : null);
export const trackSalesFor = (tracks: { id: string; price?: number | null }[], owned: Set<string>): Record<string, Sale> =>
  Object.fromEntries(tracks.filter((t) => t.price && t.price > 0).map((t) => [t.id, { kind: 'track' as const, id: t.id, price: Number(t.price), owned: owned.has(t.id) }]));
// Arriving from the phone app with ?buy=<kind>:<id> (signed in by the handoff, or as a guest): start checkout on the
// web. The parameter is removed first, so going back from checkout doesn't start it again.
export function useBuyParam(pagePath: string) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const b = params.get('buy');
    if (!b) return;
    params.delete('buy');
    window.history.replaceState(null, '', `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`);
    const [kind, id] = b.split(':');
    if ((kind === 'album' || kind === 'track') && id) buyMusic(kind, id, pagePath);
  }, [pagePath]);
}
