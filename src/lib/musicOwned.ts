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
type Sellable = { id: string; price?: number | null; sale_mode?: string | null; donation_amounts?: number[] | null };
export const saleFor = (kind: 'album' | 'track', id: string, price: number | null | undefined, owned: boolean, mode?: string | null, amounts?: number[] | null): Sale | null =>
  mode === 'donation' ? { kind, id, price: 0, owned, mode: 'donation', amounts: amounts?.length ? amounts : [5, 10, 20] }
  : price && price > 0 ? { kind, id, price: Number(price), owned, mode: 'paid' } : null;
export const trackSalesFor = (tracks: Sellable[], owned: Set<string>): Record<string, Sale> =>
  Object.fromEntries(tracks.map((t) => [t.id, saleFor('track', t.id, t.price, owned.has(t.id), t.sale_mode, t.donation_amounts)]).filter(([, v]) => v) as [string, Sale][]);
// Arriving with ?donate=<kind>:<id> (e.g. handed off from the phone app): which donate sheet to open.
export function useDonateParam(): string | null {
  const [target, setTarget] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const d = params.get('donate');
    if (!d) return;
    params.delete('donate');
    window.history.replaceState(null, '', `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`);
    setTarget(d);
  }, []);
  return target;
}
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
