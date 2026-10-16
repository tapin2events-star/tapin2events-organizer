import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import HlsVideo from '../feed/HlsVideo';
import { useFeature } from '../../lib/preview';

// Video header (Preview, Business plan): a muted, looping trailer at the top of an event or organization page,
// shown in place of the poster/cover once it's chosen. Returns null when there's no header video.
export function useHeaderVideo(eventId?: string | null, orgId?: string | null) {
  const on = useFeature('video_headers');
  const [v, setV] = useState<{ id: string; src: string; poster: string | null } | null>(null);
  useEffect(() => {
    if (!on || (!eventId && !orgId)) { setV(null); return; }
    supabase.rpc('header_video', { p_event_id: eventId ?? null, p_org_id: orgId ?? null }).then(({ data }) => setV((data ?? null) as typeof v));
  }, [on, eventId, orgId]); // eslint-disable-line react-hooks/exhaustive-deps
  return v;
}

export default function HeaderVideo({ src, poster }: { src: string; poster: string | null }) {
  const [muted, setMuted] = useState(true);
  return (
    <>
      <HlsVideo src={src} poster={poster ?? undefined} shouldLoad shouldPlay muted={muted} loop playsInline autoPlay className="h-full w-full object-cover" aria-label="Video" />
      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMuted(!muted); }} aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
        className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-base text-white backdrop-blur">{muted ? '🔇' : '🔊'}</button>
    </>
  );
}
