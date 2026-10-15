import { supabase } from './supabaseClient';
import { DEFAULT_BRAND, type Brand } from './business';

export interface DirOrg { id: string; name: string; slug: string; kind: 'business' | 'nonprofit' | 'community'; tagline: string | null; logo_url: string | null; cover_url: string | null; brand: Brand; verified: boolean; city: string | null; state: string | null; upcoming_events: number; followers: number; plan_member?: boolean }

export async function loadOrgDirectory(opts: { query?: string; kind?: string | null; verified?: boolean; city?: string | null; featured?: boolean; limit?: number; offset?: number; planPerk?: boolean } = {}): Promise<DirOrg[]> {
  const { data } = await supabase.rpc('organization_directory', {
    p_query: opts.query?.trim() || null, p_kind: opts.kind || null, p_verified: !!opts.verified, p_city: opts.city || null,
    p_featured: !!opts.featured, p_limit: opts.limit ?? 30, p_offset: opts.offset ?? 0, p_plan_perk: !!opts.planPerk,
  });
  return ((data ?? []) as DirOrg[]).map((o) => ({ ...o, brand: { ...DEFAULT_BRAND, ...(o.brand ?? {}) }, upcoming_events: Number(o.upcoming_events), followers: Number(o.followers) }));
}
