import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

// Public profile links by account (/u/:id) instead of by email, so emails never appear in links, shared URLs or QR
// codes. Emails already on screen are turned into account ids in batches (one request for everything on a page).
const cache = new Map<string, string | null>();
const listeners = new Set<() => void>();
let queue = new Set<string>();
let timer: number | null = null;
let inflight: Promise<void> | null = null;

function flush(): Promise<void> {
  timer = null;
  const batch = [...queue]; queue = new Set();
  if (!batch.length) return Promise.resolve();
  inflight = Promise.resolve(supabase.rpc('profile_ids_by_emails', { p_emails: batch })).then(({ data }) => {
    const map = (data ?? {}) as Record<string, string>;
    for (const e of batch) cache.set(e, map[e] ?? null);
    listeners.forEach((l) => l());
  }, () => { for (const e of batch) if (!cache.has(e)) cache.set(e, null); listeners.forEach((l) => l()); });
  return inflight;
}
function request(email: string) {
  if (cache.has(email) || queue.has(email)) return;
  queue.add(email);
  if (timer === null) timer = window.setTimeout(flush, 30);
}
const norm = (e: string | null | undefined) => (e ? e.trim().toLowerCase() : '');

/** The account id for an email (undefined while loading, null if there's no TapIN account). */
export function useProfileId(email: string | null | undefined): string | null | undefined {
  const e = norm(email);
  const [, bump] = useState(0);
  useEffect(() => {
    if (!e) return;
    const l = () => bump((n) => n + 1);
    listeners.add(l); request(e);
    return () => { listeners.delete(l); };
  }, [e]);
  return e ? cache.get(e) : null;
}
/** Resolve right away (for navigation after a scan, etc.). */
export async function resolveProfileId(email: string | null | undefined): Promise<string | null> {
  const e = norm(email);
  if (!e) return null;
  if (cache.has(e)) return cache.get(e) ?? null;
  request(e);
  if (timer !== null) { window.clearTimeout(timer); await flush(); } else if (inflight) await inflight;
  return cache.get(e) ?? null;
}
export const profilePathForId = (id: string) => `/u/${id}`;
