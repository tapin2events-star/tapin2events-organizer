import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import HlsVideo from '../feed/HlsVideo';
import { useFeature } from '../../lib/preview';

// Video header (Preview, Business plan): a muted, looping trailer at the top of an event or organization page,
// shown in place of the poster/cover once it's chosen. Returns null when there's no header video.
export function useHeaderVideo(eventId?: string | null, orgId?: string | null, resourceId?: string | null) {
  const on = useFeature('video_headers');
  const [v, setV] = useState<{ id: string; src: string; poster: string | null } | null>(null);
  useEffect(() => {
    if (!on || (!eventId && !orgId && !resourceId)) { setV(null); return; }
    supabase.rpc('header_video', { p_event_id: eventId ?? null, p_org_id: orgId ?? null, p_resource_id: resourceId ?? null }).then(({ data }) => setV((data ?? null) as typeof v));
  }, [on, eventId, orgId, resourceId]); // eslint-disable-line react-hooks/exhaustive-deps
  return v;
}

export default function HeaderVideo({ src, poster, postId }: { src: string; poster: string | null; postId?: string }) {
  const [muted, setMuted] = useState(true);
  // Tapping the video shows a small card to watch the full video (hides itself after a few seconds).
  const [card, setCard] = useState(false);
  useEffect(() => { if (!card) return; const t = setTimeout(() => setCard(false), 6000); return () => clearTimeout(t); }, [card]);
  return (
    <>
      <HlsVideo src={src} poster={poster ?? undefined} shouldLoad shouldPlay muted={muted} loop playsInline autoPlay className="h-full w-full object-cover" aria-label="Video" />
      {postId && <button type="button" onClick={() => setCard(true)} aria-label="Video options" className="absolute inset-0 h-full w-full cursor-pointer" />}
      {postId && card && (
        <div className="absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full bg-black/75 p-1.5 pl-2 shadow-xl backdrop-blur" role="dialog" aria-label="Watch the full video">
          <Link to={`/feed?post=${postId}`} className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-bold text-gray-900">▶ Watch the full video</Link>
          <button type="button" onClick={() => setCard(false)} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-white/80 hover:text-white">×</button>
        </div>
      )}
      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMuted(!muted); }} aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
        className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-base text-white backdrop-blur">{muted ? '🔇' : '🔊'}</button>
    </>
  );
}

// For the event's or organization's team only: is a newly chosen header video still processing?
export function useHeaderVideoProcessing(eventId?: string | null, orgId?: string | null) {
  const on = useFeature('video_headers');
  const [processing, setProcessing] = useState(false);
  useEffect(() => {
    if (!on || (!eventId && !orgId)) { setProcessing(false); return; }
    supabase.rpc('header_video_status', { p_event_id: eventId ?? null, p_org_id: orgId ?? null }).then(({ data }) => setProcessing((data as { status?: string } | null)?.status === 'processing'));
  }, [on, eventId, orgId]);
  return processing;
}

export function ProcessingLabel() {
  return (
    <span className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur" role="status">
      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" /> Your header video is processing
    </span>
  );
}
