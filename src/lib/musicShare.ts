import { supabase } from './supabaseClient';
import { toast } from './toast';

// Share an album or a song: the phone's share sheet where available, otherwise copy the link. Links always point to
// app.tapin2events.com (with rich previews: cover art, title, artist), and each share is counted for the artist.
export function musicLink(kind: 'album' | 'track', id: string) {
  return `https://app.tapin2events.com/${kind === 'album' ? 'albums' : 'songs'}/${id}`;
}
export async function shareMusic(kind: 'album' | 'track', id: string, title: string, artist: string) {
  const url = musicLink(kind, id);
  supabase.rpc('record_music_share', { p_kind: kind, p_id: id }).then(() => undefined);
  const text = `${title} by ${artist} on TapIN`;
  try {
    if (navigator.share) { await navigator.share({ title: text, text, url }); return; }
  } catch (e) { if ((e as Error)?.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch { window.prompt('Copy this link', url); }
}
