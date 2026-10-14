import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

// Short promotion links: /p/<code> -> the event page, credited to that link.
export default function ShortLink() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    supabase.rpc('resolve_event_link', { p_code: code ?? '' }).then(({ data }) => {
      if (data) navigate(`/events/${data}?src=${encodeURIComponent((code ?? '').toLowerCase())}`, { replace: true });
      else setMissing(true);
    });
  }, [code, navigate]);
  return missing
    ? <div className="mx-auto max-w-md py-16 text-center"><p className="font-semibold text-bone">This link isn't active anymore.</p><a href={import.meta.env.BASE_URL} className="mt-3 inline-block text-sm font-medium text-marigold">Find events on TapIN</a></div>
    : <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-label="Loading"><span className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-marigold" /></div>;
}
