import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import CreatePostModal from '../feed/CreatePostModal';

// Past event pages (Preview): a "Highlights" reel of videos people posted to the event, and a prompt to share one.
export default function EventHighlights({ eventId, eventTitle, ended }: { eventId: string; eventTitle: string; ended: boolean }) {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState<{ id: string; thumbnail: string | null; caption: string | null; author: string | null }[] | null>(null);
  const [sharing, setSharing] = useState(false);
  const [posted, setPosted] = useState(false);
  useEffect(() => { supabase.rpc('event_highlights', { p_event_id: eventId }).then(({ data }) => setItems((data ?? []) as typeof items)); }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps
  // Opened from the "share a clip" notification.
  useEffect(() => {
    if (params.get('share') === '1' && user) { setSharing(true); params.delete('share'); setParams(params, { replace: true }); }
  }, [params, user, setParams]);
  if (items === null) return null;
  if (!ended && !items.length) return null;
  return (
    <section className="mt-6" aria-labelledby="event-highlights">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="event-highlights" className="font-display text-xl font-bold text-bone">🎞️ Highlights</h2>
        {ended && (user
          ? <button onClick={() => setSharing(true)} className="rounded-xl bg-marigold px-3 py-2 text-sm font-semibold text-white">Share a clip</button>
          : <Link to="/login" className="text-sm font-medium text-marigold">Sign in to share a clip ›</Link>)}
      </div>
      {posted && <p role="status" className="mt-2 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">Thanks! Your clip is processing and will appear here in a few minutes.</p>}
      {items.length ? (
        <div className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
          {items.map((v) => (
            <Link key={v.id} to={`/feed?post=${v.id}`} className="relative w-32 shrink-0 snap-start overflow-hidden rounded-2xl" aria-label={v.caption || 'Play video'}>
              {v.thumbnail ? <img src={v.thumbnail} alt="" className="aspect-[9/14] w-full object-cover" /> : <span className="flex aspect-[9/14] w-full items-center justify-center bg-gray-800 text-2xl">🎬</span>}
              <span className="absolute left-2 top-2 rounded-full bg-black/50 px-1.5 text-xs text-white">▶</span>
              {v.author && <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-6 text-xs text-white">{v.author}</span>}
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-2 rounded-2xl border border-dashed border-gray-300 p-5 text-center text-sm text-muted">Were you there? Be the first to share a clip from {eventTitle}.</p>
      )}
      {sharing && <CreatePostModal initialEvent={{ id: eventId, title: eventTitle }} onClose={() => setSharing(false)} onPosted={() => { setSharing(false); setPosted(true); }} />}
    </section>
  );
}
