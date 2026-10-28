import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import BackButton from '../components/BackButton';
import MusicPlayerCard from '../components/music/MusicPlayerCard';
import type { PlayerTrack } from '../lib/player';
import { useAuth } from '../context/AuthContext';
import { useOwnedTracks, saleFor, useBuyParam, useDonateParam } from '../lib/musicOwned';

// A song's own page (shareable): the spinning CD player with the song, buy or donate (the song's own option, or its
// album's), the artist, and the album it's on.
interface Song { id: string; title: string; url: string; duration_sec: number | null; price: number | null; preview_only: boolean; sale_mode: string; donation_amounts: number[]; cover_url: string | null;
  album: { id: string; title: string; price: number | null; preview_only: boolean; sale_mode: string; donation_amounts: number[] } | null; artist: { id: string; name: string; photo: string | null; can_sell: boolean; mine: boolean } }
export default function SongPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [s, setS] = useState<Song | null | undefined>(undefined);
  useEffect(() => { if (id) supabase.rpc('song_page', { p_track_id: id }).then(({ data }) => setS((data ?? null) as Song | null)); }, [id]);
  const owned = useOwnedTracks(s ? [s.id] : [], !!user);
  useBuyParam(`/songs/${id}`);
  const donateTarget = useDonateParam();
  if (s === undefined) return <div className="mx-auto max-w-2xl" />;
  if (!s) return <div className="mx-auto max-w-2xl"><BackButton fallback="/" /><p className="mt-4 text-gray-600">This song isn&apos;t available.</p></div>;
  const canSell = s.artist.can_sell && !s.artist.mine;
  const own = owned.has(s.id);
  // The song's own option, or (for songs on an album) the album's.
  const sale = s.album ? saleFor('album', s.album.id, s.album.price, own, s.album.sale_mode, s.album.donation_amounts) : saleFor('track', s.id, s.price, own, s.sale_mode, s.donation_amounts);
  const preview = canSell && !own && !!((s.album ? (s.album.sale_mode === 'paid' && s.album.preview_only && s.album.price) : (s.sale_mode === 'paid' && s.preview_only && s.price)));
  const track: PlayerTrack = { id: s.id, title: s.title, url: s.url, duration_sec: s.duration_sec, artist: s.artist.name, artistId: s.artist.id, cover: s.cover_url, albumId: s.album?.id ?? null, albumTitle: s.album?.title ?? null, preview };
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-3"><BackButton fallback={`/resources/${s.artist.id}`} fallbackLabel={`Back to ${s.artist.name}`} /></div>
      <MusicPlayerCard title={s.title} subtitle={[s.artist.name, s.album ? `from ${s.album.title}` : 'Single'].join(' · ')} cover={s.cover_url} tracks={[track]} sale={sale} canSell={canSell} mine={s.artist.mine} pagePath={`/songs/${s.id}`} share={{ kind: 'track', id: s.id }} artist={s.artist.name} autoDonate={donateTarget} />
      <p className="mt-4 text-sm text-gray-600">By <Link to={`/resources/${s.artist.id}`} className="font-medium text-marigold hover:underline">{s.artist.name}</Link>{s.album && <> · from <Link to={`/albums/${s.album.id}`} className="font-medium text-marigold hover:underline">{s.album.title}</Link></>}</p>
      <p className="mt-6 text-xs text-gray-400"><Link to="/dmca" className="hover:underline">Report a copyright problem</Link></p>
    </div>
  );
}
