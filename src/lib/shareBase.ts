import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

// The address to put in share links and QR codes: a white-labeled event's (or an organization's) connected domain,
// like https://tickets.pressplay.com/, or TapIN's own address otherwise.
export const tapinBase = () => `${window.location.origin}${import.meta.env.BASE_URL}`;
const cache = new Map<string, Promise<string>>();
export function getShareBase(eventId?: string | null, orgId?: string | null): Promise<string> {
  if (!eventId && !orgId) return Promise.resolve(tapinBase());
  const key = `${eventId ?? ''}|${orgId ?? ''}`;
  if (!cache.has(key)) {
    cache.set(key, Promise.resolve(supabase.rpc('share_base', { p_event_id: eventId ?? null, p_org_id: orgId ?? null }))
      .then(({ data }) => (typeof data === 'string' && data ? data : tapinBase()), () => tapinBase()));
  }
  return cache.get(key)!;
}
export function useShareBase(eventId?: string | null, orgId?: string | null): string {
  const [base, setBase] = useState(tapinBase());
  useEffect(() => { let alive = true; getShareBase(eventId, orgId).then((b) => { if (alive) setBase(b); }); return () => { alive = false; }; }, [eventId, orgId]);
  return base;
}
