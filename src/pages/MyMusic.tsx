import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import MusicPlayerCard from '../components/music/MusicPlayerCard';
import type { PlayerTrack } from '../lib/player';
import { toast, toastError } from '../lib/toast';

// My music: albums and songs the person bought, with players and downloads (time-limited links from music-download).
interface Item { id: string; title: string; amount: number; paid_at: string; album_id: string | null; track_id: string | null; artist: { id: string; name: string; photo: string | null }; cover: string | null; tracks: { id: string; title: string; url: string; duration_sec: number | null }[] }
export default function MyMusic() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const purchased = new URLSearchParams(window.location.search).get('purchased') === '1';
  useEffect(() => { if (user) supabase.rpc('my_music_library').then(({ data }) => setItems((data ?? []) as Item[])); }, [user]);
  async function download(it: Item) {
    setBusy(it.id);
    const { data, error } = await supabase.functions.invoke('music-download', { body: it.album_id ? { album_id: it.album_id } : { track_id: it.track_id } });
    setBusy(null);
    const files = (data as { files?: { url: string; filename: string }[]; error?: string } | null)?.files;
    if (error || !files?.length) return toastError((data as { error?: string } | null)?.error ?? 'Couldn\u2019t prepare the download.');
    for (const f of files) { const a = document.createElement('a'); a.href = f.url; a.download = f.filename; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); await new Promise((r) => setTimeout(r, 400)); }
    toast(files.length === 1 ? 'Downloading your song' : `Downloading ${files.length} songs`);
  }
  if (!user) return <div className="mx-auto max-w-2xl"><h1 className="font-display text-3xl font-extrabold text-bone">My music</h1><p className="mt-2 text-gray-600"><Link to="/login" className="text-marigold underline">Sign in</Link> to see the music you&apos;ve bought.</p></div>;
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl font-extrabold text-bone">🎵 My music</h1>
      <p className="mt-1 text-sm text-muted">Albums and songs you bought on TapIN. Artists receive 100% of the price.</p>
      {purchased && <p className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">Thank you! Your purchase shows up here within a few minutes of payment.</p>}
      {items && items.length === 0 && <p className="mt-6 text-sm text-gray-600">Nothing here yet. Buy albums and songs from artists&apos; profiles, and they&apos;ll live here with downloads.</p>}
      <div className="mt-4 flex flex-col gap-4">
        {(items ?? []).map((it) => {
          const tracks: PlayerTrack[] = it.tracks.map((t) => ({ id: t.id, title: t.title, url: t.url, duration_sec: t.duration_sec, artist: it.artist.name, artistId: it.artist.id, cover: it.cover, albumId: it.album_id, albumTitle: it.album_id ? it.title : null }));
          return (
            <div key={it.id}>
              <MusicPlayerCard title={it.title} subtitle={`${it.artist.name} · bought ${new Date(it.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`} cover={it.cover} tracks={tracks} link={it.album_id ? `/albums/${it.album_id}` : `/resources/${it.artist.id}`} compact />
              <button onClick={() => download(it)} disabled={busy === it.id} className="mt-2 inline-flex min-h-[40px] items-center rounded-full border border-gray-300 px-4 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50">{busy === it.id ? 'Preparing…' : `⬇ Download ${it.album_id ? 'album' : 'song'}`}</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
