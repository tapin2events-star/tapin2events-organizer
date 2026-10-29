import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useFeature } from '../../lib/preview';
import MusicPlayerCard from './MusicPlayerCard';
import type { PlayerTrack } from '../../lib/player';
import { useAuth } from '../../context/AuthContext';
import { useOwnedTracks, saleFor, trackSalesFor, useBuyParam, useDonateParam } from '../../lib/musicOwned';

// Artist profile: albums (each a spinning CD player) and singles. Everything plays through the app-wide player.
interface T { id: string; title: string; url: string; duration_sec: number | null; cover_url?: string | null; price?: number | null; preview_only?: boolean; sale_mode?: string; donation_amounts?: number[]; credits?: { id: string; name: string }[] }
interface Album { id: string; title: string; description: string | null; cover_url: string | null; release_date: string | null; price?: number | null; preview_only?: boolean; sale_mode?: string; donation_amounts?: number[]; tracks: T[] }
interface Music { artist: { id: string; name: string; photo: string | null; can_sell?: boolean; mine?: boolean } | null; albums: Album[]; singles: T[] }

export default function ArtistMusic({ resourceId, artistName }: { resourceId: string; artistName: string }) {
  const on = useFeature('music_uploads');
  const [m, setM] = useState<Music | null>(null);
  const { user } = useAuth();
  const allIds = m ? [...m.albums.flatMap((a) => a.tracks.map((t) => t.id)), ...m.singles.map((t) => t.id)] : [];
  const owned = useOwnedTracks(allIds, !!user);
  useBuyParam(`/resources/${resourceId}`);
  const donateTarget = useDonateParam();
  useEffect(() => { if (on) supabase.rpc('artist_music', { p_resource_id: resourceId }).then(({ data }) => setM((data ?? null) as Music | null)); }, [on, resourceId]);
  if (!on || !m || (m.albums.length === 0 && m.singles.length === 0)) return null;
  const canSell = !!m.artist?.can_sell && !m.artist?.mine;
  const toTrack = (t: T, album?: Album): PlayerTrack => ({ id: t.id, title: t.title, url: t.url, duration_sec: t.duration_sec, artist: artistName, artistId: resourceId, cover: album?.cover_url ?? t.cover_url ?? m.artist?.photo ?? null, albumId: album?.id ?? null, albumTitle: album?.title ?? null, credits: t.credits ?? [],
    preview: canSell && !owned.has(t.id) && (((album?.sale_mode === 'paid' && album?.preview_only && album?.price) || (t.sale_mode === 'paid' && t.preview_only && t.price)) ? true : false) });
  return (
    <section className="mt-6 border-t border-gray-200 pt-6" aria-label={`Music by ${artistName}`}>
      <h2 className="font-display text-lg font-semibold text-gray-900">🎵 Music</h2>
      <div className="mt-3 flex flex-col gap-4">
        {m.albums.map((a) => (
          <MusicPlayerCard key={a.id} title={a.title} subtitle={[artistName, a.release_date ? new Date(a.release_date + 'T00:00:00').getFullYear() : null, `${a.tracks.length} song${a.tracks.length === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
            cover={a.cover_url ?? m.artist?.photo} tracks={a.tracks.map((t) => toTrack(t, a))} link={`/albums/${a.id}`} sale={saleFor('album', a.id, a.price, a.tracks.length > 0 && a.tracks.every((t) => owned.has(t.id)), a.sale_mode, a.donation_amounts)} trackSales={trackSalesFor(a.tracks, owned)} canSell={canSell} mine={!!m.artist?.mine} pagePath={`/resources/${resourceId}`} share={{ kind: 'album', id: a.id }} artist={artistName} autoDonate={donateTarget} />
        ))}
        {m.singles.length > 0 && (
          <MusicPlayerCard title={m.albums.length ? 'Singles' : artistName} subtitle={m.albums.length ? artistName : `${m.singles.length} song${m.singles.length === 1 ? '' : 's'}`} cover={m.singles[0].cover_url ?? m.artist?.photo} tracks={m.singles.map((t) => toTrack(t))} compact={m.albums.length > 0} trackSales={trackSalesFor(m.singles, owned)} canSell={canSell} mine={!!m.artist?.mine} pagePath={`/resources/${resourceId}`} artist={artistName} autoDonate={donateTarget} share={m.singles.length === 1 ? { kind: 'track', id: m.singles[0].id } : null} />
        )}
      </div>
      <p className="mt-2 text-xs text-gray-400"><Link to="/dmca" className="hover:underline">Report a copyright problem</Link></p>
    </section>
  );
}
