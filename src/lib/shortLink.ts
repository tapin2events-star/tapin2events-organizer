import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

// Short event links: /e/<code> (an event's random code, or a custom name its organizer chose).
const cache = new Map<string, string | null>();
export async function eventShortCode(eventId: string): Promise<string | null> {
  if (cache.has(eventId)) return cache.get(eventId) ?? null;
  const { data } = await supabase.rpc('event_short_code', { p_event_id: eventId });
  const code = typeof data === 'string' && data ? data : null;
  cache.set(eventId, code);
  return code;
}
export function forgetShortCode(eventId: string) { cache.delete(eventId); }
/** The path to share for an event: /e/<code> when it has one, else /events/<id>. */
export function useEventSharePath(eventId: string | null | undefined): string | null {
  const [path, setPath] = useState<string | null>(eventId && cache.get(eventId) ? `/e/${cache.get(eventId)}` : null);
  useEffect(() => {
    if (!eventId) return;
    let alive = true;
    eventShortCode(eventId).then((c) => { if (alive) setPath(c ? `/e/${c}` : `/events/${eventId}`); });
    return () => { alive = false; };
  }, [eventId]);
  return path;
}
