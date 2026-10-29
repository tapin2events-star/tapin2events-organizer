import { supabase } from './supabaseClient';
import { errorReason } from './musicBuy';

// Upload one song to an artist profile (Cloudflare R2 via music-upload): start -> the browser sends the file straight to
// storage -> confirm. Shared by the Music tab and the step-by-step Add a song sheet.
export const MAX_SONG_BYTES = 25 * 1024 * 1024;
export const songMime = (f: File) => f.type || (/\.mp3$/i.test(f.name) ? 'audio/mpeg' : /\.m4a$/i.test(f.name) ? 'audio/mp4' : /\.wav$/i.test(f.name) ? 'audio/wav' : '');
export const titleFromFile = (f: File) => f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().slice(0, 120);

export function songDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const a = document.createElement('audio');
    const url = URL.createObjectURL(file);
    a.preload = 'metadata';
    a.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(Number.isFinite(a.duration) ? Math.round(a.duration) : null); };
    a.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    a.src = url;
  });
}

export async function uploadSong(resourceId: string, file: File, title: string, onProgress: (pct: number) => void): Promise<{ trackId?: string; error?: string }> {
  const mime = songMime(file);
  if (!mime) return { error: 'Upload an MP3, M4A or WAV file.' };
  if (file.size > MAX_SONG_BYTES) return { error: 'Songs can be up to 25 MB.' };
  const { data, error } = await supabase.functions.invoke('music-upload', { body: { action: 'start', resource_id: resourceId, title: title.trim(), mime, size: file.size, rights: true } });
  const start = data as { track_id?: string; upload_url?: string; error?: string } | null;
  if (error || !start?.upload_url || !start.track_id) return { error: start?.error ?? (await errorReason(error)) ?? 'Couldn\u2019t start the upload. Please try again.' };
  const ok = await new Promise<boolean>((resolve) => {
    const x = new XMLHttpRequest();
    x.open('PUT', start.upload_url!);
    x.setRequestHeader('Content-Type', mime);
    x.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    x.onload = () => resolve(x.status >= 200 && x.status < 300);
    x.onerror = () => resolve(false);
    x.send(file);
  });
  if (!ok) { await supabase.functions.invoke('music-upload', { body: { action: 'delete', track_id: start.track_id } }); return { error: 'The upload didn\u2019t finish. Check your connection and try again.' }; }
  const duration = await songDuration(file);
  const { data: c, error: cErr } = await supabase.functions.invoke('music-upload', { body: { action: 'confirm', track_id: start.track_id, duration_sec: duration } });
  if (cErr || (c as { error?: string } | null)?.error) return { error: (c as { error?: string } | null)?.error ?? 'Couldn\u2019t finish the upload.' };
  return { trackId: start.track_id };
}
