import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useFeature } from '../../lib/preview';
import { usePlayer, type PlayerTrack } from '../../lib/player';
import CdDisc from './CdDisc';

// Personal profile: "Music by <artist>", a row of albums (and singles) from the person's artist profile. Tap a disc to
// play it (opens Now playing); the name links to the album or the artist profile.
interface T { id: string; title: string; url: string; duration_sec: number | null; price?: number | null; preview_only?: boolean }
interface Album { id: string; title: string; cover_url: string | null; price?: number | null; preview_only?: boolean; tracks: T[] }
interface Music { artist: { id: string; name: string; photo: string | null; can_sell?: boolean; mine?: boolean } | null; albums: Album[]; singles: (T & { cover_url?: string | null })[] }

export default function PersonMusicStrip({ resourceId }: { resourceId: string }) {
  const on = useFeature('music_uploads');
  const p = usePlayer();
  const [m, setM] = useState<Music | null>(null);
  useEffect(() => { if (on) supabase.rpc('artist_music', { p_resource_id: resourceId }).then(({ data }) => setM((data ?? null) as Music | null)); }, [on, resourceId]);
  if (!on || !m?.artist || (m.albums.length === 0 && m.singles.length === 0)) return null;
  const artist = m.artist;
  const canSell = !!artist.can_sell && !artist.mine;
  const toTracks = (ts: T[], album?: Album): PlayerTrack[] => ts.map((t) => ({ id: t.id, title: t.title, url: t.url, duration_sec: t.duration_sec, artist: artist.name, artistId: artist.id,
    cover: album?.cover_url ?? artist.photo, albumId: album?.id ?? null, albumTitle: album?.title ?? null, preview: canSell && (((album?.preview_only && album?.price) || (t.preview_only && t.price)) ? true : false) }));
  const items = [
    ...m.albums.map((a) => ({ key: a.id, title: a.title, cover: a.cover_url ?? artist.photo, link: `/albums/${a.id}`, tracks: toTracks(a.tracks, a) })),
    ...(m.singles.length ? [{ key: 'singles', title: m.albums.length ? 'Singles' : `${m.singles.length} song${m.singles.length === 1 ? '' : 's'}`, cover: artist.photo, link: `/resources/${artist.id}`, tracks: toTracks(m.singles) }] : []),
  ];
  return (
    <section className="mt-6" aria-label={`Music by ${artist.name}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-bone">🎵 Music by {artist.name}</h2>
        <Link to={`/resources/${artist.id}`} className="shrink-0 text-sm font-medium text-marigold hover:underline">See all</Link>
      </div>
      <div className="-mx-4 mt-3 flex gap-4 overflow-x-auto px-4 pb-2">
        {items.map((it) => {
          const active = p.current && it.tracks.some((t) => t.id === p.current!.id);
          return (
            <div key={it.key} className="w-28 shrink-0">
              <button onClick={() => (active ? p.expand() : p.play(it.tracks, 0))} aria-label={`Play ${it.title}`} className="block">
                <CdDisc cover={it.cover} spinning={!!active && p.playing} size={112} />
              </button>
              <Link to={it.link} className="mt-2 block truncate text-center text-sm font-medium text-gray-900 hover:underline">{it.title}</Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
