import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

// /e/:code: an event's short link. Opens the event page (keeping any ?ref= or #section).
export default function ShortEventLink() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    supabase.rpc('resolve_event_short', { p_code: code ?? '' }).then(({ data }) => {
      if (typeof data === 'string' && data) navigate(`/events/${data}${window.location.search}${window.location.hash}`, { replace: true });
      else setMissing(true);
    });
  }, [code, navigate]);
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center text-sm text-muted">
      {missing ? <>That event link doesn&apos;t exist. <a href="/" className="text-marigold underline">Discover events</a></> : 'Opening event…'}
    </div>
  );
}
