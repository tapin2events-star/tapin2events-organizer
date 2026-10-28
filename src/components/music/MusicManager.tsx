import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { toast, toastError } from '../../lib/toast';

// Artist dashboard: upload and manage songs (Cloudflare R2 via the music-upload function). The file goes straight from
// the browser to storage with a one-time address. MP3, M4A or WAV, up to 25 MB each, 30 songs per profile; each upload
// confirms the artist owns the rights.
interface Track { id: string; title: string; url: string | null; size_bytes: number; duration_sec: number | null; plays: number; status: string; sort_order: number }
const MAX = 25 * 1024 * 1024;
const fmt = (s: number | null) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '');
const mimeOf = (f: File) => f.type || (/\.mp3$/i.test(f.name) ? 'audio/mpeg' : /\.m4a$/i.test(f.name) ? 'audio/mp4' : /\.wav$/i.test(f.name) ? 'audio/wav' : '');

function durationOf(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const a = document.createElement('audio');
    const url = URL.createObjectURL(file);
    a.preload = 'metadata';
    a.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(Number.isFinite(a.duration) ? Math.round(a.duration) : null); };
    a.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    a.src = url;
  });
}

export default function MusicManager({ resourceId }: { resourceId: string }) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [rights, setRights] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const load = useCallback(() => { supabase.rpc('manage_tracks', { p_resource_id: resourceId }).then(({ data }) => setTracks(((data ?? []) as Track[]).filter((t) => t.status === 'active'))); }, [resourceId]);
  useEffect(() => { load(); }, [load]);

  function pick(f: File | null) {
    setErr(null);
    if (!f) return setFile(null);
    if (!mimeOf(f)) return setErr('Upload an MP3, M4A or WAV file.');
    if (f.size > MAX) return setErr('Songs can be up to 25 MB.');
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().slice(0, 120));
  }

  async function upload() {
    if (!file || !title.trim() || !rights) return;
    setErr(null); setProgress(0);
    const mime = mimeOf(file);
    const { data, error } = await supabase.functions.invoke('music-upload', { body: { action: 'start', resource_id: resourceId, title: title.trim(), mime, size: file.size, rights: true } });
    const start = data as { track_id?: string; upload_url?: string; error?: string } | null;
    if (error || !start?.upload_url || !start.track_id) { setProgress(null); return setErr(start?.error ?? 'Couldn\u2019t start the upload. Please try again.'); }
    const ok = await new Promise<boolean>((resolve) => {
      const x = new XMLHttpRequest();
      x.open('PUT', start.upload_url!);
      x.setRequestHeader('Content-Type', mime);
      x.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100)); };
      x.onload = () => resolve(x.status >= 200 && x.status < 300);
      x.onerror = () => resolve(false);
      x.send(file);
    });
    if (!ok) { setProgress(null); await supabase.functions.invoke('music-upload', { body: { action: 'delete', track_id: start.track_id } }); return setErr('The upload didn\u2019t finish. Check your connection and try again.'); }
    const duration = await durationOf(file);
    const { data: c, error: cErr } = await supabase.functions.invoke('music-upload', { body: { action: 'confirm', track_id: start.track_id, duration_sec: duration } });
    setProgress(null);
    if (cErr || (c as { error?: string } | null)?.error) return setErr((c as { error?: string } | null)?.error ?? 'Couldn\u2019t finish the upload.');
    toast('🎵 Song added to your profile');
    setFile(null); setTitle(''); setRights(false); if (input.current) input.current.value = '';
    load();
  }

  async function remove(t: Track) {
    if (!window.confirm(`Remove \u201c${t.title}\u201d from your profile?`)) return;
    const { data, error } = await supabase.functions.invoke('music-upload', { body: { action: 'delete', track_id: t.id } });
    if (error || (data as { error?: string } | null)?.error) return toastError('Couldn\u2019t remove it. Please try again.');
    toast('Removed'); load();
  }
  async function move(i: number, dir: -1 | 1) {
    const j = i + dir; if (j < 0 || j >= tracks.length) return;
    const a = tracks[i], b = tracks[j];
    await Promise.all([supabase.rpc('update_track', { p_track_id: a.id, p_sort_order: j }), supabase.rpc('update_track', { p_track_id: b.id, p_sort_order: i })]);
    load();
  }
  async function rename(t: Track) {
    const n = window.prompt('Song title', t.title);
    if (!n || !n.trim() || n.trim() === t.title) return;
    const { error } = await supabase.rpc('update_track', { p_track_id: t.id, p_title: n.trim() });
    if (error) return toastError(error.message);
    load();
  }

  const full = tracks.length >= 30;
  return (
    <div className="mt-4 flex flex-col gap-4">
      <section className="rounded-2xl border border-gray-200 bg-surface p-4">
        <p className="font-display text-lg font-bold text-bone">🎵 Add a song</p>
        <p className="mt-0.5 text-sm text-muted">MP3, M4A or WAV, up to 25 MB. Songs play right on your profile. {tracks.length}/30 used.</p>
        {full ? <p className="mt-3 text-sm text-amber-800">You&apos;ve reached 30 songs. Remove one to add another.</p> : (
          <div className="mt-3 flex flex-col gap-3">
            <input ref={input} type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,audio/wav,.mp3,.m4a,.wav" onChange={(e) => pick(e.target.files?.[0] ?? null)} className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-full file:border-0 file:bg-[#0F1B3D] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white" />
            {file && (
              <>
                <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 120))} placeholder="Song title" aria-label="Song title" className="min-h-[44px] rounded-xl border border-gray-300 bg-white px-3 text-base text-gray-900 sm:text-sm" />
                <label className="flex items-start gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-marigold" />
                  <span>I wrote and own this music, or I have permission to share it, and it doesn&apos;t infringe anyone&apos;s copyright. (<Link to="/dmca" className="text-marigold underline">Copyright policy</Link>)</span>
                </label>
                {progress !== null ? (
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-marigold transition-all" style={{ width: `${progress}%` }} /></div>
                ) : (
                  <button onClick={upload} disabled={!title.trim() || !rights} className="min-h-[44px] self-start rounded-full bg-marigold px-5 text-sm font-semibold text-white disabled:opacity-50">Upload song</button>
                )}
                {progress !== null && <p className="text-xs text-muted">Uploading… {progress}%</p>}
              </>
            )}
            {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
          </div>
        )}
      </section>
      {tracks.length > 0 && (
        <section className="rounded-2xl border border-gray-200 bg-surface p-4">
          <p className="font-display text-lg font-bold text-bone">Your songs</p>
          <ul className="mt-2 flex flex-col gap-2">
            {tracks.map((t, i) => (
              <li key={t.id} className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0"><span className="block truncate text-sm font-semibold text-gray-900">{t.title}</span><span className="text-xs text-gray-500">{[fmt(t.duration_sec), `${t.plays} play${t.plays === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}</span></span>
                  <span className="flex shrink-0 items-center gap-1 text-gray-500">
                    <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 disabled:opacity-30">↑</button>
                    <button onClick={() => move(i, 1)} disabled={i === tracks.length - 1} aria-label="Move down" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 disabled:opacity-30">↓</button>
                    <button onClick={() => rename(t)} className="px-2 text-xs font-medium text-indigo-600">Rename</button>
                    <button onClick={() => remove(t)} className="px-2 text-xs font-medium text-red-600">Remove</button>
                  </span>
                </div>
                {t.url && <audio controls preload="none" src={t.url} className="mt-2 w-full" />}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
