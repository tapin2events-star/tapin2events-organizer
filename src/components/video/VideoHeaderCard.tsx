import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import Sheet from '../scouting/Sheet';
import PremiumBadge from '../business/PremiumBadge';

interface Cand { id: string; thumbnail: string | null; caption: string | null; author: string | null }

// Organizer side (Preview): choose a Feed video as the header for an event or organization page.
export default function VideoHeaderCard({ eventId, orgId, what }: { eventId?: string; orgId?: string; what: string }) {
  const [current, setCurrent] = useState<{ id: string; poster: string | null } | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [cands, setCands] = useState<Cand[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    const { data } = await supabase.rpc('header_video', { p_event_id: eventId ?? null, p_org_id: orgId ?? null });
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
  if (current === undefined) return null;
  return (
    <section className="mb-4 rounded-2xl border border-gray-200 bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {current?.poster ? <img src={current.poster} alt="" className="h-14 w-24 shrink-0 rounded-lg object-cover" /> : <span className="flex h-14 w-24 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-2xl">🎬</span>}
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-semibold text-bone">🎬 Video header <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700">Preview</span> <PremiumBadge /></p>
            <p className="text-sm text-muted">{current ? `A muted, looping trailer plays at the top of ${what}.` : `Play a short trailer at the top of ${what}, in place of the image.`}</p>
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
          <p className="-mt-2 text-sm text-gray-600">Videos from the Feed{eventId ? ' posted to this event or by its team and performers' : ' by your team and artists, or posted to your events'}. Short clips (15–60 seconds) work best.</p>
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
