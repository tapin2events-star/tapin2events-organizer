import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import BackButton from '../components/BackButton';
import MusicPlayerCard from '../components/music/MusicPlayerCard';
import type { PlayerTrack } from '../lib/player';
import { useAuth } from '../context/AuthContext';
import { useOwnedTracks, saleFor, trackSalesFor, useBuyParam, useDonateParam } from '../lib/musicOwned';

// An album's own page (shareable): the spinning CD player with its songs, and the artist.
interface Album { id: string; title: string; description: string | null; cover_url: string | null; release_date: string | null; price?: number | null; preview_only?: boolean; sale_mode?: string; donation_amounts?: number[]; artist: { id: string; name: string; photo: string | null; can_sell?: boolean; mine?: boolean }; tracks: { id: string; title: string; url: string; duration_sec: number | null; price?: number | null; preview_only?: boolean; sale_mode?: string; donation_amounts?: number[] }[] }
export default function AlbumPage() {
  const { id } = useParams<{ id: string }>();
  const [a, setA] = useState<Album | null | undefined>(undefined);
  const { user } = useAuth();
  const owned = useOwnedTracks(a ? a.tracks.map((t) => t.id) : [], !!user);
  useBuyParam(`/albums/${id}`);
  const donateTarget = useDonateParam();
  useEffect(() => { if (id) supabase.rpc('album_page', { p_album_id: id }).then(({ data }) => setA((data ?? null) as Album | null)); }, [id]);
  if (a === undefined) return <div className="mx-auto max-w-2xl" />;
  if (!a) return <div className="mx-auto max-w-2xl"><BackButton fallback="/" /><p className="mt-4 text-gray-600">This album isn&apos;t available.</p></div>;
  const canSell = !!a.artist.can_sell && !a.artist.mine;
  const tracks: PlayerTrack[] = a.tracks.map((t) => ({ id: t.id, title: t.title, url: t.url, duration_sec: t.duration_sec, artist: a.artist.name, artistId: a.artist.id, cover: a.cover_url ?? a.artist.photo, albumId: a.id, albumTitle: a.title,
    preview: canSell && !owned.has(t.id) && (((a.sale_mode === 'paid' && a.preview_only && a.price) || (t.sale_mode === 'paid' && t.preview_only && t.price)) ? true : false) }));
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-3"><BackButton fallback={`/resources/${a.artist.id}`} fallbackLabel={`Back to ${a.artist.name}`} /></div>
      <MusicPlayerCard title={a.title} subtitle={[a.artist.name, a.release_date ? new Date(a.release_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null].filter(Boolean).join(' · ')} cover={a.cover_url ?? a.artist.photo} tracks={tracks} sale={saleFor('album', a.id, a.price, a.tracks.length > 0 && a.tracks.every((t) => owned.has(t.id)), a.sale_mode, a.donation_amounts)} trackSales={trackSalesFor(a.tracks, owned)} canSell={canSell} mine={!!a.artist.mine} pagePath={`/albums/${a.id}`} share={{ kind: 'album', id: a.id }} artist={a.artist.name} autoDonate={donateTarget} />
      {a.description && <p className="mt-4 whitespace-pre-wrap text-sm text-gray-700">{a.description}</p>}
      <p className="mt-4 text-sm text-gray-600">By <Link to={`/resources/${a.artist.id}`} className="font-medium text-marigold hover:underline">{a.artist.name}</Link></p>
      <p className="mt-6 text-xs text-gray-400"><Link to="/dmca" className="hover:underline">Report a copyright problem</Link></p>
    </div>
  );
}
