import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import Sheet from '../scouting/Sheet';
import PremiumBadge from '../business/PremiumBadge';
import { useAuth } from '../../context/AuthContext';
import { uploadVideoFile } from '../../lib/videoUpload';

interface Cand { id: string; thumbnail: string | null; caption: string | null; author: string | null }

// Organizer side (Preview): choose a Feed video as the header for an event or organization page.
export default function VideoHeaderCard({ eventId, orgId, what }: { eventId?: string; orgId?: string; what: string }) {
  const { user } = useAuth();
  const [current, setCurrent] = useState<{ id: string; poster: string | null; status: string; feed_visible: boolean } | null | undefined>(undefined);
  const [file, setFile] = useState<File | null>(null);
  const [toFeed, setToFeed] = useState(true);
  const [caption, setCaption] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [cands, setCands] = useState<Cand[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    const { data } = await supabase.rpc('header_video_status', { p_event_id: eventId ?? null, p_org_id: orgId ?? null });
    setCurrent((data ?? null) as typeof current);
  }, [eventId, orgId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!open) return;
    supabase.rpc('video_header_candidates', { p_event_id: eventId ?? null, p_org_id: orgId ?? null }).then(({ data }) => setCands((data ?? []) as Cand[]));
  }, [open, eventId, orgId]);
  async function choose(postId: string | null) {
    setErr(null);
    const { error } = await supabase.rpc('set_header_video', { p_event_id: eventId ?? null, p_org_id: orgId ?? null, p_post_id: postId });
    if (error) return setErr(error.message && !/function|permission/i.test(error.message) ? error.message : "Couldn't change the video.");
    setOpen(false); load();
  }
  async function uploadAndUse() {
    if (!file || !user?.email) return;
    setErr(null); setProgress(0);
    try {
      const assetId = await uploadVideoFile(file, { onProgress: setProgress, onNote: setNote });
      const { data: post, error } = await supabase.from('posts').insert({
        author_email: user.email, caption: caption.trim() || null, video_url: null, status: 'processing',
        processing_started_at: new Date().toISOString(), gumlet_asset_id: assetId, event_id: eventId ?? null, feed_visible: toFeed,
      }).select('id').single();
      if (error || !post) throw new Error('Your video uploaded, but saving it failed. Please try again.');
      await choose(post.id);
      setFile(null); setCaption(''); setProgress(null);
    } catch (e) {
      setProgress(null);
      setErr((e as Error).message || "Couldn't upload the video.");
    }
  }
  if (current === undefined) return null;
  return (
    <section className="mb-4 rounded-2xl border border-gray-200 bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {current?.poster ? <img src={current.poster} alt="" className="h-14 w-24 shrink-0 rounded-lg object-cover" /> : <span className="flex h-14 w-24 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-2xl">🎬</span>}
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-semibold text-bone">🎬 Video header <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700">Preview</span> <PremiumBadge /></p>
            <p className="text-sm text-muted">{current?.status === 'processing' ? 'Your video is processing. It\u2019ll appear as the header in a few minutes.' : current ? `A muted, looping trailer plays at the top of ${what}.${current.feed_visible ? '' : ' (Header only, not in the Feed.)'}` : `Play a short trailer at the top of ${what}, in place of the image.`}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setOpen(true)} className="rounded-xl bg-[#0F1B3D] px-3 py-2 text-sm font-semibold text-white">{current ? 'Change' : 'Choose a video'}</button>
          {current && <button onClick={() => choose(null)} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700">Remove</button>}
        </div>
      </div>
      {err && <p role="alert" className="mt-2 text-sm text-red-600">{err}</p>}
      {open && (
        <Sheet title="Choose a video" onClose={() => setOpen(false)}>
          <div className="-mt-2 mb-4 rounded-xl border border-gray-200 bg-white p-3">
            <p className="text-sm font-semibold text-gray-900">Upload a video</p>
            <p className="text-xs text-gray-500">💡 Landscape (wide) videos look best as headers. Short clips (15–60 seconds) work great.</p>
            {progress !== null ? (
              <div className="mt-3">
                <div className="h-2 overflow-hidden rounded-full bg-gray-200"><div className="h-full rounded-full bg-marigold transition-all" style={{ width: `${progress}%` }} /></div>
                <p className="mt-1 text-xs text-gray-600">{note ?? `Uploading… ${progress}%. Keep TapIN open until it finishes.`}</p>
              </div>
            ) : (
              <>
                <label className="mt-2 block cursor-pointer rounded-xl border border-dashed border-gray-300 px-3 py-3 text-center text-sm text-gray-700">{file ? `🎥 ${file.name}` : '🎥 Choose a video file'}
                  <input type="file" accept="video/*" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </label>
                {file && (
                  <>
                    <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={150} placeholder="Caption (optional)" aria-label="Caption" className="mt-2 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 sm:text-sm" />
                    <label className="mt-2 flex items-start gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={toFeed} onChange={(e) => setToFeed(e.target.checked)} className="mt-0.5 h-4 w-4 accent-marigold" />
                      <span>Also share to the Feed<span className="block text-xs text-gray-500">{toFeed ? 'More people see it, tagged to ' + (eventId ? 'this event' : 'you') + '.' : 'Used only as the header and kept out of the Feed.'}</span></span>
                    </label>
                    <button onClick={uploadAndUse} className="mt-3 w-full rounded-xl bg-marigold py-2.5 text-sm font-semibold text-white">Upload and use as header</button>
                  </>
                )}
              </>
            )}
          </div>
          <p className="text-sm font-semibold text-gray-900">Or choose one you've posted</p>
          <p className="text-sm text-gray-600">Videos from the Feed{eventId ? ' posted to this event or by its team and performers' : ' by your team and artists, or posted to your events'}. Short clips (15–60 seconds) work best.</p>
          {cands === null ? <p className="mt-4 text-sm text-gray-500">Loading…</p> : cands.length === 0 ? (
            <p className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">No videos yet. Post one to the Feed first (tag it to {eventId ? 'this event' : 'one of your events'} if you can), then come back to choose it.</p>
          ) : (
            <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {cands.map((c) => (
                <li key={c.id}><button onClick={() => choose(c.id)} className={`block w-full overflow-hidden rounded-xl border-2 text-left ${current?.id === c.id ? 'border-marigold' : 'border-transparent'}`}>
                  {c.thumbnail ? <img src={c.thumbnail} alt="" className="aspect-[9/12] w-full object-cover" /> : <span className="flex aspect-[9/12] w-full items-center justify-center bg-gray-200 text-2xl">🎬</span>}
                  <span className="block truncate px-1.5 py-1 text-xs text-gray-700">{c.caption || c.author || 'Video'}</span>
                </button></li>
              ))}
            </ul>
          )}
          <Link to="/feed" className="mt-4 inline-block text-sm font-medium text-marigold">Post a new video to the Feed ›</Link>
        </Sheet>
      )}
    </section>
  );
}
