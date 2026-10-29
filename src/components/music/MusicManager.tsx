import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { toast, toastError } from '../../lib/toast';
import Sheet from '../scouting/Sheet';
import AddSongSheet from './AddSongSheet';
import { useAuth } from '../../context/AuthContext';
import { uploadImage } from '../../lib/business';

// Artist dashboard: upload and manage songs (Cloudflare R2 via the music-upload function). The file goes straight from
// the browser to storage with a one-time address. MP3, M4A or WAV, up to 25 MB each, 30 songs per profile; each upload
// confirms the artist owns the rights.
interface Track { id: string; title: string; url: string | null; size_bytes: number; duration_sec: number | null; plays: number; status: string; sort_order: number; album_id: string | null; price: number | null; preview_only: boolean; sale_mode?: string; donation_amounts?: number[] }
interface Album { id: string; title: string; description: string | null; cover_url: string | null; release_date: string | null; price: number | null; preview_only: boolean; sale_mode?: string; donation_amounts?: number[] }
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

export default function MusicManager({ resourceId, v2 = false, autoAdd = false, autoAlbum = false }: { resourceId: string; v2?: boolean; autoAdd?: boolean; autoAlbum?: boolean }) {
  // v2 (dashboard preview): album cover tiles, compact song rows that open an edit sheet, and the step-by-step Add a song sheet.
  const [adding, setAdding] = useState(autoAdd);
  const [editing, setEditing] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [canSell, setCanSell] = useState(true);
  const [sales, setSales] = useState<{ count: number; total: number }>({ count: 0, total: 0 });
  const { user } = useAuth();
  const [albumForm, setAlbumForm] = useState<{ id: string | null; title: string; description: string; cover_url: string; release_date: string } | null>(autoAlbum ? { id: null, title: '', description: '', cover_url: '', release_date: '' } : null);
  const [coverBusy, setCoverBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [rights, setRights] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const load = useCallback(() => { supabase.rpc('manage_tracks', { p_resource_id: resourceId }).then(({ data }) => { const d = (data ?? { tracks: [], albums: [] }) as { tracks: Track[]; albums: Album[]; can_sell?: boolean; sales?: { count: number; total: number } }; setTracks((d.tracks ?? []).filter((t) => t.status === 'active')); setAlbums(d.albums ?? []); setCanSell(d.can_sell !== false); setSales(d.sales ?? { count: 0, total: 0 }); }); }, [resourceId]);
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
    if (!window.confirm(`Remove \u201c${t.title}\u201d from your profile? (Anyone who bought or donated for it keeps it in their My music.)`)) return;
    const { data, error } = await supabase.functions.invoke('music-upload', { body: { action: 'delete', track_id: t.id } });
    if (error || (data as { error?: string } | null)?.error) return toastError('Couldn\u2019t remove it. Please try again.');
    // Someone bought or donated for it: it's off your profile, but kept in their My music.
    toast((data as { kept_for_buyers?: boolean } | null)?.kept_for_buyers ? 'Removed from your profile. People who bought or donated for it keep it in My music.' : 'Removed'); load();
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

  async function saveAlbum() {
    if (!albumForm || !albumForm.title.trim()) return;
    const { error } = await supabase.rpc('save_album', { p_resource_id: resourceId, p_album_id: albumForm.id, p_title: albumForm.title.trim(), p_description: albumForm.description, p_cover_url: albumForm.cover_url || null, p_release_date: albumForm.release_date || null });
    if (error) return toastError(error.message);
    toast(albumForm.id ? 'Album updated' : '💿 Album created'); setAlbumForm(null); load();
  }
  async function deleteAlbum(a: Album) {
    if (!window.confirm(`Delete the album \u201c${a.title}\u201d? Its songs stay on your profile as singles.`)) return;
    const { error } = await supabase.rpc('delete_album', { p_album_id: a.id });
    if (error) return toastError(error.message);
    toast('Album deleted'); load();
  }
  async function pickCover(f: File | null) {
    if (!f || !user || !albumForm) return;
    setCoverBusy(true);
    const r = await uploadImage(user.id, f, 'album-cover');
    setCoverBusy(false);
    if (r.error || !r.url) return toastError(r.error ?? 'Couldn\u2019t upload the cover.');
    setAlbumForm({ ...albumForm, cover_url: r.url });
  }
  async function setAlbum(t: Track, albumId: string | null) {
    const { error } = await supabase.rpc('set_track_album', { p_track_id: t.id, p_album_id: albumId });
    if (error) return toastError(error.message);
    load();
  }
  async function setSale(kind: 'album' | 'track', id: string, mode: string, price: string, previewOnly: boolean, amounts: number[]) {
    const n = price.trim() ? Number(price) : null;
    if (mode === 'paid' && (n === null || !Number.isFinite(n) || n < 0.99 || n > (kind === 'album' ? 500 : 100))) return toastError(kind === 'album' ? 'Album prices can be $0.99 to $500.' : 'Song prices can be $0.99 to $100.');
    const { error } = await supabase.rpc('set_music_sale', { p_kind: kind, p_id: id, p_mode: mode, p_price: mode === 'paid' ? n : null, p_preview_only: previewOnly, p_amounts: amounts });
    if (error) return toastError(error.message);
    toast(mode === 'paid' ? `Price set: $${(n ?? 0).toFixed(2)}` : mode === 'donation' ? 'Donation-based: free to listen, donors get downloads' : 'Free to listen'); load();
  }
  const full = tracks.length >= 30;
  const ed = editing ? tracks.find((t) => t.id === editing) ?? null : null;
  const edIndex = ed ? tracks.indexOf(ed) : -1;
  return (
    <div className="mt-4 flex flex-col gap-4">
      {v2 && (
        <button onClick={() => setAdding(true)} disabled={full} className="flex min-h-[60px] items-center justify-center gap-2.5 rounded-[18px] bg-gradient-to-br from-indigo-600 via-violet-600 to-teal-500 text-base font-extrabold text-white shadow-lg shadow-indigo-500/30 disabled:opacity-50">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          Add a song <span className="text-[13px] font-semibold opacity-85">{tracks.length}/30</span>
        </button>
      )}
      {adding && <AddSongSheet resourceId={resourceId} albums={albums} canSell={canSell} onClose={() => setAdding(false)} onDone={() => { setAdding(false); toast('🎵 Song added to your profile'); load(); }} />}
      {!v2 && <section className="rounded-2xl border border-gray-200 bg-surface p-4">
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
      </section>}
      <section className="rounded-2xl border border-gray-200 bg-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="font-display text-lg font-bold text-bone">{v2 ? 'Albums' : '💿 Albums'}</p>
          {!albumForm && <button onClick={() => setAlbumForm({ id: null, title: '', description: '', cover_url: '', release_date: '' })} className="rounded-full bg-[#0F1B3D] px-4 py-2 text-sm font-semibold text-white">+ New album</button>}
        </div>
        <p className="mt-0.5 text-sm text-muted">Group songs with cover art. Each album gets its own page to share, and a spinning CD player on your profile.</p>
        {sales.count > 0 && <p className="mt-2 text-sm font-semibold text-emerald-700">{sales.count} sale{sales.count === 1 ? '' : 's'} · ${Number(sales.total).toFixed(2)} earned (you keep 100%)</p>}
        {!canSell && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">To sell your music, <Link to="/profile#payouts" className="font-semibold underline">connect payouts</Link> first. Until then, priced items show without a Buy button.</p>}
        {albumForm && (
          <div className="mt-3 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3">
            <input value={albumForm.title} onChange={(e) => setAlbumForm({ ...albumForm, title: e.target.value.slice(0, 120) })} placeholder="Album title" aria-label="Album title" className="min-h-[44px] rounded-xl border border-gray-300 px-3 text-base text-gray-900 sm:text-sm" />
            <div className="flex items-center gap-3">
              {albumForm.cover_url ? <img src={albumForm.cover_url} alt="" className="h-16 w-16 rounded-lg object-cover" /> : <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-gray-100 text-2xl" aria-hidden="true">💿</span>}
              <label className="text-sm text-gray-700"><span className="block font-medium">Cover art</span><input type="file" accept="image/*" onChange={(e) => pickCover(e.target.files?.[0] ?? null)} className="mt-1 block text-xs" />{coverBusy && <span className="text-xs text-muted">Uploading…</span>}</label>
            </div>
            <label className="text-sm text-gray-700">Release date<input type="date" value={albumForm.release_date} onChange={(e) => setAlbumForm({ ...albumForm, release_date: e.target.value })} className="mt-1 block min-h-[44px] w-full rounded-xl border border-gray-300 px-3 text-base text-gray-900 sm:text-sm" /></label>
            <textarea value={albumForm.description} onChange={(e) => setAlbumForm({ ...albumForm, description: e.target.value.slice(0, 1000) })} rows={2} placeholder="About this album (optional)" className="rounded-xl border border-gray-300 px-3 py-2 text-base text-gray-900 sm:text-sm" />
            {v2 && albumForm.id && (() => { const a = albums.find((x) => x.id === albumForm.id); return a ? (
              <div className="rounded-xl bg-gray-50 p-2">
                <PriceRow kind="album" id={a.id} price={a.price} previewOnly={a.preview_only} mode={a.sale_mode} amounts={a.donation_amounts} setSale={setSale} />
                <div className="mt-2 flex gap-3 text-xs"><Link to={`/albums/${a.id}`} className="font-medium text-indigo-600">View album page</Link><button onClick={() => { setAlbumForm(null); deleteAlbum(a); }} className="font-medium text-red-600">Delete album</button></div>
              </div>
            ) : null; })()}
            <div className="flex gap-2">
              <button onClick={saveAlbum} disabled={!albumForm.title.trim() || coverBusy} className="min-h-[44px] rounded-full bg-marigold px-5 text-sm font-semibold text-white disabled:opacity-50">{albumForm.id ? 'Save album' : 'Create album'}</button>
              <button onClick={() => setAlbumForm(null)} className="min-h-[44px] rounded-full border border-gray-300 px-5 text-sm font-medium text-gray-700">Cancel</button>
            </div>
          </div>
        )}
        {v2 && (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {albums.map((a) => {
              const n = tracks.filter((t) => t.album_id === a.id).length;
              return (
                <button key={a.id} onClick={() => setAlbumForm({ id: a.id, title: a.title, description: a.description ?? '', cover_url: a.cover_url ?? '', release_date: a.release_date ?? '' })} className="text-left">
                  <span className="relative block">
                    {a.cover_url ? <img src={a.cover_url} alt="" className="aspect-square w-full rounded-[18px] object-cover shadow-[0_8px_20px_rgba(39,30,110,0.18)]" /> : <span className="flex aspect-square w-full items-center justify-center rounded-[18px] bg-gradient-to-br from-violet-600 to-teal-500 shadow-[0_8px_20px_rgba(39,30,110,0.18)]" aria-hidden="true"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" /></svg></span>}
                    {a.sale_mode && a.sale_mode !== 'free' && <span className="absolute bottom-2.5 left-2.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-extrabold text-indigo-800">{a.sale_mode === 'donation' ? 'Donation-based' : `$${Number(a.price ?? 0).toFixed(2)}`}</span>}
                  </span>
                  <span className="mt-1.5 block truncate text-sm font-semibold text-gray-900">{a.title}</span>
                  <span className="block text-xs text-gray-500">{n} song{n === 1 ? '' : 's'}{a.release_date ? ` · ${a.release_date.slice(0, 4)}` : ''}</span>
                </button>
              );
            })}
            <button onClick={() => setAlbumForm({ id: null, title: '', description: '', cover_url: '', release_date: '' })} className="flex aspect-square flex-col items-center justify-center gap-2 rounded-[18px] border-2 border-dashed border-gray-300 text-indigo-800 hover:border-indigo-400">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 8v8M8 12h8" /></svg>
              <span className="text-[13px] font-bold">Create an album</span>
            </button>
          </div>
        )}
        {!v2 && albums.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {albums.map((a) => (
              <li key={a.id} className="rounded-xl border border-gray-200 bg-white p-2.5">
                <div className="flex items-center gap-3">
                {a.cover_url ? <img src={a.cover_url} alt="" className="h-12 w-12 rounded-lg object-cover" /> : <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 text-xl" aria-hidden="true">💿</span>}
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-gray-900">{a.title}</span><span className="block text-xs text-gray-500">{tracks.filter((t) => t.album_id === a.id).length} song{tracks.filter((t) => t.album_id === a.id).length === 1 ? '' : 's'}{a.release_date ? ` · ${a.release_date}` : ''}</span></span>
                <Link to={`/albums/${a.id}`} className="px-2 text-xs font-medium text-indigo-600">View</Link>
                <button onClick={() => setAlbumForm({ id: a.id, title: a.title, description: a.description ?? '', cover_url: a.cover_url ?? '', release_date: a.release_date ?? '' })} className="px-2 text-xs font-medium text-indigo-600">Edit</button>
                <button onClick={() => deleteAlbum(a)} className="px-2 text-xs font-medium text-red-600">Delete</button>
                </div>
                <PriceRow kind="album" id={a.id} price={a.price} previewOnly={a.preview_only} mode={a.sale_mode} amounts={a.donation_amounts} setSale={setSale} />
              </li>
            ))}
          </ul>
        )}
      </section>
      {tracks.length > 0 && (
        <section className="rounded-2xl border border-gray-200 bg-surface p-4">
          <p className="font-display text-lg font-bold text-bone">Your songs</p>
          {v2 ? (
            <ul className="mt-2 divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
              {tracks.map((t) => (
                <li key={t.id}>
                  <button onClick={() => setEditing(t.id)} className="flex w-full items-center gap-3 px-3 py-3 text-left">
                    {(() => { const al = albums.find((a) => a.id === t.album_id); return al?.cover_url
                      ? <img src={al.cover_url} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
                      : <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white ${t.album_id ? 'from-violet-600 to-teal-500' : 'from-orange-500 to-pink-500'}`} aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg></span>; })()}
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-gray-900">{t.title}</span>
                      <span className="block truncate text-xs text-gray-500">{[t.album_id ? albums.find((a) => a.id === t.album_id)?.title : 'Single', fmt(t.duration_sec), `${t.plays} play${t.plays === 1 ? '' : 's'}`, !t.album_id && t.price ? `$${Number(t.price).toFixed(2)}` : null].filter(Boolean).join(' · ')}</span></span>
                    <span className="text-gray-400" aria-hidden="true">›</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
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
                {albums.length > 0 && (
                  <label className="mt-2 flex items-center gap-2 text-xs text-gray-600">Album
                    <select value={t.album_id ?? ''} onChange={(e) => setAlbum(t, e.target.value || null)} className="min-h-[36px] rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900">
                      <option value="">Single (no album)</option>
                      {albums.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
                    </select>
                  </label>
                )}
                {!t.album_id && <PriceRow kind="track" id={t.id} price={t.price} previewOnly={t.preview_only} mode={t.sale_mode} amounts={t.donation_amounts} setSale={setSale} />}
                {t.url && <audio controls preload="none" src={t.url} className="mt-2 w-full" />}
              </li>
            ))}
          </ul>
          )}
        </section>
      )}
      {ed && (
        <Sheet title="Edit song" onClose={() => setEditing(null)}>
          <SongTitle key={ed.id} title={ed.title} onSave={async (n) => { const { error } = await supabase.rpc('update_track', { p_track_id: ed.id, p_title: n }); if (error) toastError(error.message); else { toast('Saved'); load(); } }} />
          {albums.length > 0 && (
            <label className="mt-3 block text-sm text-gray-700">Album
              <select value={ed.album_id ?? ''} onChange={(e) => setAlbum(ed, e.target.value || null)} className="mt-1 block min-h-[48px] w-full rounded-xl border border-gray-300 bg-white px-3 text-base text-gray-900">
                <option value="">Single (no album)</option>
                {albums.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
              </select>
            </label>
          )}
          {!ed.album_id && canSell && <PriceRow key={`p-${ed.id}`} kind="track" id={ed.id} price={ed.price} previewOnly={ed.preview_only} mode={ed.sale_mode} amounts={ed.donation_amounts} setSale={setSale} />}
          {ed.url && <audio controls preload="none" src={ed.url} className="mt-3 w-full" />}
          <p className="mt-2 text-xs text-gray-500">{[fmt(ed.duration_sec), `${ed.plays} play${ed.plays === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => move(edIndex, -1)} disabled={edIndex <= 0} className="min-h-[44px] rounded-full border border-gray-300 px-4 text-sm font-medium text-gray-700 disabled:opacity-40">↑ Move up</button>
            <button onClick={() => move(edIndex, 1)} disabled={edIndex < 0 || edIndex >= tracks.length - 1} className="min-h-[44px] rounded-full border border-gray-300 px-4 text-sm font-medium text-gray-700 disabled:opacity-40">↓ Move down</button>
            <button onClick={async () => { const t = ed; setEditing(null); await remove(t); }} className="min-h-[44px] rounded-full border border-red-200 px-4 text-sm font-medium text-red-700">Remove song</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

// Song title editor for the edit sheet (saves on Save).
function SongTitle({ title, onSave }: { title: string; onSave: (t: string) => void }) {
  const [v, setV] = useState(title);
  return (
    <div className="flex gap-2">
      <input value={v} onChange={(e) => setV(e.target.value.slice(0, 120))} aria-label="Song title" className="min-h-[48px] min-w-0 flex-1 rounded-xl border border-gray-300 px-3 text-base text-gray-900" />
      <button onClick={() => v.trim() && v.trim() !== title && onSave(v.trim())} disabled={!v.trim() || v.trim() === title} className="min-h-[48px] shrink-0 rounded-xl bg-[#0F1B3D] px-4 text-sm font-semibold text-white disabled:opacity-40">Save</button>
    </div>
  );
}

// Free / paid / donation-based for an album or a single. Paid: price + full songs or 30-second previews. Donation:
// suggested amounts (anyone listens free; donors get downloads). Saved when changed or when you leave a field.
function PriceRow({ kind, id, price, previewOnly, mode: modeIn, amounts: amountsIn, setSale }: { kind: 'album' | 'track'; id: string; price: number | null; previewOnly: boolean; mode?: string; amounts?: number[]; setSale: (kind: 'album' | 'track', id: string, mode: string, price: string, previewOnly: boolean, amounts: number[]) => void }) {
  const [mode, setMode] = useState(modeIn ?? (price ? 'paid' : 'free'));
  const [v, setV] = useState(price ? String(price) : '');
  const [prev, setPrev] = useState(previewOnly);
  const [amts, setAmts] = useState<string[]>((amountsIn?.length ? amountsIn : [5, 10, 20]).slice(0, 3).map(String));
  const nums = () => amts.map((x) => Math.round(Number(x))).filter((x) => x >= 1 && x <= 1000);
  const save = (m = mode, p2 = prev) => { if (m === 'paid' && !v.trim()) return; setSale(kind, id, m, v, p2, nums()); };
  return (
    <div className="mt-2 flex flex-col gap-2 text-xs text-gray-600">
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={`How listeners get this ${kind === 'album' ? 'album' : 'song'}`}>
        {[['free', 'Free'], ['paid', 'Paid'], ['donation', 'Donation-based']].map(([k, label]) => (
          <button key={k} type="button" role="radio" aria-checked={mode === k} onClick={() => { setMode(k); if (k !== 'paid') setSale(kind, id, k, '', false, nums()); }}
            className={`min-h-[32px] rounded-full border px-3 text-xs font-semibold ${mode === k ? 'border-marigold bg-marigold text-white' : 'border-gray-300 bg-white text-gray-700'}`}>{label}</button>
        ))}
      </div>
      {mode === 'paid' && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1">Price $<input value={v} onChange={(e) => setV(e.target.value.replace(/[^0-9.]/g, ''))} onBlur={() => save()} inputMode="decimal" placeholder="9.99" aria-label={`${kind} price`} className="min-h-[32px] w-16 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900" /></label>
          <label className="flex items-center gap-1">Listeners hear
            <select value={prev ? 'preview' : 'full'} onChange={(e) => { const p2 = e.target.value === 'preview'; setPrev(p2); save('paid', p2); }} className="min-h-[32px] rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900">
              <option value="full">full songs</option>
              <option value="preview">30-second previews</option>
            </select>
          </label>
        </div>
      )}
      {mode === 'donation' && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span>Suggested amounts $</span>
          {amts.map((x, i) => (
            <input key={i} value={x} onChange={(e) => setAmts(amts.map((y, j) => (j === i ? e.target.value.replace(/[^0-9]/g, '') : y)))} onBlur={() => save('donation')} inputMode="numeric" aria-label={`Suggested amount ${i + 1}`} className="min-h-[32px] w-12 rounded-lg border border-gray-300 bg-white px-2 text-center text-sm text-gray-900" />
          ))}
          <span className="w-full text-[11px] text-gray-500">Anyone can listen free. Donors choose any amount, you get 100%, and they get downloads.</span>
        </div>
      )}
    </div>
  );
}
