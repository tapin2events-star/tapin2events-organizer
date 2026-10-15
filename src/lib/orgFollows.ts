import { supabase } from './supabaseClient';

// Shared, remembered follow state for organizations: one request for all of your follows (instead of
// one per card), cached for the session, so Follow/Following never flips after a page appears.
let followsFor: string | null = null;
let follows: Set<string> | null = null;
let pending: Promise<Set<string>> | null = null;
const counts = new Map<string, number>();
const roles = new Map<string, string | null>();

export function knownFollows(email: string | null | undefined): Set<string> | null {
  return email && followsFor === email.toLowerCase() ? follows : null;
}
export function loadFollows(email: string): Promise<Set<string>> {
  const e = email.toLowerCase();
  if (followsFor === e && follows) return Promise.resolve(follows);
  if (followsFor === e && pending) return pending;
  followsFor = e;
  pending = (async () => {
    const { data } = await supabase.from('organization_follows').select('org_id').ilike('user_email', e);
    follows = new Set(((data ?? []) as { org_id: string }[]).map((r) => r.org_id));
    return follows;
  })();
  return pending;
}
export function setFollowing(orgId: string, on: boolean) {
  if (!follows) follows = new Set();
  if (on) follows.add(orgId); else follows.delete(orgId);
  const c = counts.get(orgId);
  if (c !== undefined) counts.set(orgId, Math.max(0, c + (on ? 1 : -1)));
}
export const cachedCount = (orgId: string) => counts.get(orgId);
export async function loadCount(orgId: string) {
  const { data } = await supabase.rpc('org_follower_count', { p_org_id: orgId });
  const n = typeof data === 'number' ? data : 0;
  counts.set(orgId, n);
  return n;
}
// Your role in an organization (for the Manage button), remembered per session.
export const cachedRole = (orgId: string) => (roles.has(orgId) ? roles.get(orgId) ?? null : undefined);
export async function loadRole(orgId: string) {
  const { data } = await supabase.rpc('org_role', { p_org: orgId });
  const r = (data as string | null) ?? null;
  roles.set(orgId, r);
  return r;
}
