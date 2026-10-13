// Organizations already seen this session (from the directory, cards or a previous visit), so an
// organization's page can show its name, logo, cover and colors instantly while the rest loads.
export interface CachedOrg { id: string; name: string; slug: string; kind?: string; tagline?: string | null; logo_url?: string | null; cover_url?: string | null; brand?: Record<string, unknown> | null; verified?: boolean; city?: string | null; state?: string | null }
const cache = new Map<string, CachedOrg>();
export const primeOrg = (o: CachedOrg) => { if (o?.slug) cache.set(o.slug, { ...(cache.get(o.slug) ?? {}), ...o }); };
export const cachedOrg = (slug: string | undefined) => (slug ? cache.get(slug) ?? null : null);
