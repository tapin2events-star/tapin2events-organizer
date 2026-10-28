import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import Sheet from '../scouting/Sheet';
import { MAX_SONG_BYTES, songMime, titleFromFile, uploadSong } from '../../lib/musicUpload';

// Add a song, one step at a time: 1) the file, 2) title and album, 3) price (if payouts are connected), 4) confirm the
// rights and upload.
interface AlbumOpt { id: string; title: string }
export default function AddSongSheet({ resourceId, albums, canSell, onClose, onDone }: { resourceId: string; albums: AlbumOpt[]; canSell: boolean; onClose: () => void; onDone: () => void }) {
  const steps = canSell ? 4 : 3;
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [albumId, setAlbumId] = useState('');
  const [price, setPrice] = useState('');
  const [preview, setPreview] = useState(false);
  const [rights, setRights] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const last = step === steps;

  function pick(f: File | null) {
    setErr(null);
    if (!f) return;
    if (!songMime(f)) return setErr('Upload an MP3, M4A or WAV file.');
    if (f.size > MAX_SONG_BYTES) return setErr('Songs can be up to 25 MB.');
    setFile(f); setTitle(titleFromFile(f)); setStep(2);
  }
  async function upload() {
    if (!file || !rights) return;
    const n = !albumId && price.trim() ? Number(price) : null;
    if (n !== null && (!Number.isFinite(n) || n < 0.99 || n > 100)) return setErr('Song prices can be $0.99 to $100.');
    setErr(null); setProgress(0);
    const r = await uploadSong(resourceId, file, title, setProgress);
    if (r.error || !r.trackId) { setProgress(null); return setErr(r.error ?? 'Couldn\u2019t upload.'); }
    if (albumId) await supabase.rpc('set_track_album', { p_track_id: r.trackId, p_album_id: albumId });
    if (n) await supabase.rpc('set_music_price', { p_kind: 'track', p_id: r.trackId, p_price: n, p_preview_only: preview });
    onDone();
  }
  const priceStep = canSell ? 3 : -1;
  return (
    <Sheet title="Add a song" onClose={progress === null ? onClose : () => undefined}>
      <div className="mb-3 flex gap-1" aria-label={`Step ${step} of ${steps}`}>{Array.from({ length: steps }, (_, i) => <span key={i} className={`h-1 flex-1 rounded-full ${i < step ? 'bg-marigold' : 'bg-gray-200'}`} />)}</div>
      {step === 1 && (
        <div>
          <p className="font-semibold text-gray-900">Choose your song</p>
          <p className="mt-0.5 text-sm text-gray-500">MP3, M4A or WAV, up to 25 MB.</p>
          <label className="mt-4 flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 text-center hover:border-marigold">
            <span className="text-3xl" aria-hidden="true">🎵</span>
            <span className="mt-1 text-sm font-semibold text-gray-900">Tap to choose a file</span>
            <input type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,audio/wav,.mp3,.m4a,.wav" onChange={(e) => pick(e.target.files?.[0] ?? null)} className="sr-only" />
          </label>
        </div>
      )}
      {step === 2 && (
        <div className="flex flex-col gap-3">
          <p className="font-semibold text-gray-900">Title and album</p>
          <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 120))} placeholder="Song title" aria-label="Song title" className="min-h-[48px] rounded-xl border border-gray-300 px-3 text-base text-gray-900" />
          <label className="text-sm text-gray-700">Album
            <select value={albumId} onChange={(e) => setAlbumId(e.target.value)} className="mt-1 block min-h-[48px] w-full rounded-xl border border-gray-300 bg-white px-3 text-base text-gray-900">
              <option value="">Single (no album)</option>
              {albums.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
            </select>
          </label>
        </div>
      )}
      {step === priceStep && (
        <div className="flex flex-col gap-3">
          <p className="font-semibold text-gray-900">Price</p>
          {albumId ? <p className="text-sm text-gray-600">Songs on an album are sold with the album. Set the album&apos;s price on the album.</p> : (
            <>
              <label className="text-sm text-gray-700">Price (leave blank for free streaming)
                <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="$ free" className="mt-1 block min-h-[48px] w-full rounded-xl border border-gray-300 px-3 text-base text-gray-900" />
              </label>
              {price.trim() !== '' && (
                <label className="text-sm text-gray-700">Listeners who haven&apos;t bought it hear
                  <select value={preview ? 'preview' : 'full'} onChange={(e) => setPreview(e.target.value === 'preview')} className="mt-1 block min-h-[48px] w-full rounded-xl border border-gray-300 bg-white px-3 text-base text-gray-900">
                    <option value="full">the full song</option>
                    <option value="preview">a 30-second preview</option>
                  </select>
                </label>
              )}
              <p className="text-xs text-gray-500">You keep 100% of the price. Buyers pay TapIN&apos;s service fee on top.</p>
            </>
          )}
        </div>
      )}
      {last && (
        <div className="flex flex-col gap-3">
          <p className="font-semibold text-gray-900">Confirm and upload</p>
          <p className="text-sm text-gray-600"><strong>{title}</strong>{albumId ? ` · ${albums.find((a) => a.id === albumId)?.title}` : ' · single'}{!albumId && price ? ` · $${Number(price).toFixed(2)}` : ''}</p>
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-marigold" />
            <span>I wrote and own this music, or I have permission to share it, and it doesn&apos;t infringe anyone&apos;s copyright. (<Link to="/dmca" className="text-marigold underline">Copyright policy</Link>)</span>
          </label>
          {progress !== null && (
            <div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-marigold transition-all" style={{ width: `${progress}%` }} /></div>
              <p className="mt-1 text-xs text-gray-500">Uploading… {progress}%</p>
            </div>
          )}
        </div>
      )}
      {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
      {step > 1 && progress === null && (
        <div className="mt-5 flex gap-2">
          <button onClick={() => setStep(step - 1)} className="min-h-[48px] flex-1 rounded-full border border-gray-300 text-sm font-medium text-gray-700">Back</button>
          {last
            ? <button onClick={upload} disabled={!rights || !title.trim()} className="min-h-[48px] flex-[2] rounded-full bg-marigold text-sm font-semibold text-white disabled:opacity-50">Upload song</button>
            : <button onClick={() => setStep(step + 1)} disabled={step === 2 && !title.trim()} className="min-h-[48px] flex-[2] rounded-full bg-[#0F1B3D] text-sm font-semibold text-white disabled:opacity-50">Next</button>}
        </div>
      )}
    </Sheet>
  );
}
