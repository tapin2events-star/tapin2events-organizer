import { useEffect, useState } from 'react';
import { isNativeApp } from '../lib/displayMode';
import { downloadMusic } from '../lib/musicDownload';
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
  const load = () => supabase.rpc('my_music_library').then(({ data }) => setItems((data ?? []) as Item[]));
  useEffect(() => { if (user) load(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps
  // Just paid: confirm the purchase right away (the confirmation service also runs every 10 minutes), then refresh.
  useEffect(() => {
    if (!user || !purchased) return;
    supabase.functions.invoke('music-sales', { body: {} }).then(() => load()).then(() => { setTimeout(load, 4000); });
  }, [user, purchased]); // eslint-disable-line react-hooks/exhaustive-deps
  const [progress, setProgress] = useState<string | null>(null);
  async function download(target: { album_id: string } | { track_id: string }, key: string, albumTitle: string | null) {
    setBusy(key); setProgress(null);
    const err = await downloadMusic(target, albumTitle, setProgress);
    setBusy(null); setProgress(null);
    if (err) toastError(err); else if (!isNativeApp()) toast('Download started');
  }
  // Handed off from the phone app with ?download=<album|track>:<id>: start that download here.
  useEffect(() => {
    if (!user || !items) return;
    const params = new URLSearchParams(window.location.search);
    const d = params.get('download');
    if (!d) return;
    params.delete('download');
    window.history.replaceState(null, '', `${window.location.pathname}${params.toString() ? `?${params}` : ''}`);
    const [kind, id] = d.split(':');
    if (kind === 'album' && id) download({ album_id: id }, `album:${id}`, items.find((x) => x.album_id === id)?.title ?? null);
    if (kind === 'track' && id) download({ track_id: id }, `track:${id}`, null);
  }, [user, items]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!user) return <div className="mx-auto max-w-2xl"><h1 className="font-display text-3xl font-extrabold text-bone">My music</h1><p className="mt-2 text-gray-600"><Link to="/login" className="text-marigold underline">Sign in</Link> to see the music you&apos;ve bought.</p></div>;
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl font-extrabold text-bone">🎵 My music</h1>
      <p className="mt-1 text-sm text-muted">Albums and songs you bought on TapIN. Artists receive 100% of the price.</p>
      {purchased && <p className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">Thank you! Your purchase is being confirmed and will appear here in a moment.</p>}
      {items && items.length === 0 && <p className="mt-6 text-sm text-gray-600">Nothing here yet. Buy albums and songs from artists&apos; profiles, and they&apos;ll live here with downloads.</p>}
      <div className="mt-4 flex flex-col gap-4">
        {(items ?? []).map((it) => {
          const tracks: PlayerTrack[] = it.tracks.map((t) => ({ id: t.id, title: t.title, url: t.url, duration_sec: t.duration_sec, artist: it.artist.name, artistId: it.artist.id, cover: it.cover, albumId: it.album_id, albumTitle: it.album_id ? it.title : null }));
          return (
            <div key={it.id}>
              <MusicPlayerCard title={it.title} subtitle={`${it.artist.name} · bought ${new Date(it.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`} cover={it.cover} tracks={tracks} link={it.album_id ? `/albums/${it.album_id}` : `/resources/${it.artist.id}`} compact />
              <div className="mt-2 flex flex-col gap-2">
                {it.album_id && it.tracks.length > 1 && (
                  <button onClick={() => download({ album_id: it.album_id! }, `album:${it.album_id}`, it.title)} disabled={!!busy}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-[#0F1B3D] px-4 text-sm font-semibold text-white disabled:opacity-50">
                    {busy === `album:${it.album_id}` ? (progress ?? 'Preparing…') : `⬇ Download album (.zip, ${it.tracks.length} songs)`}
                  </button>
                )}
                <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
                  {it.tracks.map((t) => (
                    <li key={t.id} className="flex items-center gap-2 px-3 py-2">
                      <span className="min-w-0 flex-1 truncate text-sm text-gray-900">{t.title}</span>
                      <button onClick={() => download({ track_id: t.id }, `track:${t.id}`, null)} disabled={!!busy} aria-label={`Download ${t.title}`}
                        className="inline-flex min-h-[36px] shrink-0 items-center rounded-full border border-gray-300 px-3 text-xs font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50">{busy === `track:${t.id}` ? 'Preparing…' : '⬇ Download'}</button>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-muted">Download as many times as you like{isNativeApp() ? ' (opens in your browser to save the file)' : ''}. On iPhone, files are saved to the Files app.</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
