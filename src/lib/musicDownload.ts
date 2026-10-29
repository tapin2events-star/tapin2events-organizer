import { zip } from 'fflate';
import { supabase } from './supabaseClient';
import { isNativeApp } from './displayMode';
import { openInBrowser } from './externalLink';
import { errorReason } from './musicBuy';

// Downloading music you bought (or donated for), as many times as you like: every download asks music-download for
// fresh links (valid for an hour).
//  - One song: a direct download (saved to Files on iPhone, Downloads on Android and computers).
//  - A whole album: one .zip file, built in the browser, so it works everywhere (browsers block several downloads at once).
//  - In the TapIN phone app (in-app web views can't save files): it continues in Safari or Chrome, already signed in
//    (a one-time handoff pass), and starts the download there.
type Target = { album_id: string } | { track_id: string };
interface File { id: string; title: string; url: string; filename: string }

function save(blobOrUrl: Blob | string, filename: string) {
  const a = document.createElement('a');
  a.href = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl);
  a.download = filename; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  if (typeof blobOrUrl !== 'string') setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
}
const safe = (s: string) => s.replace(/[^\w\s.-]/g, '').trim().slice(0, 80) || 'album';

export async function downloadMusic(target: Target, albumTitle: string | null, onProgress?: (msg: string) => void): Promise<string | null> {
  const key = 'album_id' in target ? `album:${target.album_id}` : `track:${target.track_id}`;
  if (isNativeApp()) {
    const next = `/my-music?download=${key}`;
    const { data } = await supabase.functions.invoke('app-handoff', { body: { action: 'create', next } });
    openInBrowser((data as { url?: string } | null)?.url ?? `https://app.tapin2events.com${next}`);
    return null;
  }
  const { data, error } = await supabase.functions.invoke('music-download', { body: target });
  const files = (data as { files?: File[] } | null)?.files;
  if (error || !files?.length) return (await errorReason(error)) ?? 'Couldn\u2019t prepare the download.';
  if (files.length === 1) { save(files[0].url, files[0].filename); return null; }
  // A whole album: fetch each song and zip them into one file.
  const parts: Record<string, Uint8Array> = {};
  for (let i = 0; i < files.length; i++) {
    onProgress?.(`Preparing ${i + 1} of ${files.length}…`);
    const res = await fetch(files[i].url);
    if (!res.ok) return 'One of the songs couldn\u2019t be downloaded. Please try again.';
    parts[`${String(i + 1).padStart(2, '0')} ${files[i].filename}`] = new Uint8Array(await res.arrayBuffer());
  }
  onProgress?.('Zipping…');
  const zipped = await new Promise<Uint8Array>((resolve, reject) => zip(parts, { level: 0 }, (err, out) => (err ? reject(err) : resolve(out))));
  save(new Blob([zipped as Uint8Array<ArrayBuffer>], { type: 'application/zip' }), `${safe(albumTitle ?? 'album')}.zip`);
  return null;
}
