import { supabase } from './supabaseClient';

// Upload a video file to TapIN's video host (same steps as Feed uploads): a signed upload link from our backend,
// the screen kept awake, and automatic retries if the upload is interrupted. Returns the video's asset id.
type WakeLock = { release: () => Promise<void> };
export async function uploadVideoFile(file: File, opts: { onProgress?: (pct: number) => void; onNote?: (note: string | null) => void } = {}): Promise<string> {
  let lock: WakeLock | null = null;
  try { lock = await (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLock> } }).wakeLock?.request('screen') ?? null; } catch { /* not supported */ }
  const getLink = async () => {
    const { data, error } = await supabase.functions.invoke('create-gumlet-upload', { body: {} });
    return error || !data?.upload_url ? null : (data as { upload_url: string; asset_id: string });
  };
  const put = (url: string) => new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) opts.onProgress?.(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(Object.assign(new Error('Upload failed'), { status: xhr.status })));
    xhr.onerror = () => reject(Object.assign(new Error('Upload failed'), { status: 0 }));
    xhr.send(file);
  });
  const visible = () => new Promise<void>((res) => {
    if (!document.hidden) return res();
    const on = () => { if (!document.hidden) { document.removeEventListener('visibilitychange', on); res(); } };
    document.addEventListener('visibilitychange', on);
  });
  try {
    let link = await getLink();
    if (!link) throw new Error('Could not start the upload. Please try again.');
    for (let attempt = 1; attempt <= 4; attempt++) {
      try { await put(link.upload_url); opts.onNote?.(null); return link.asset_id; }
      catch (e) {
        if (attempt === 4) throw new Error('The upload kept getting interrupted. Check your connection and try again.');
        const status = (e as { status?: number }).status ?? 0;
        opts.onNote?.(document.hidden ? 'Paused while TapIN was in the background. It will continue when you come back.' : 'Connection interrupted. Retrying…');
        await visible();
        await new Promise((r) => setTimeout(r, 1500));
        if (status === 403 || status === 400) { const fresh = await getLink(); if (fresh) link = fresh; }
        opts.onProgress?.(0);
      }
    }
    throw new Error('Upload failed');
  } finally {
    try { await lock?.release(); } catch { /* ignore */ }
  }
}
