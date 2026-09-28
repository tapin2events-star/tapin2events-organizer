import { supabase } from './supabaseClient';

export interface TaggedPerson {
  email: string;
  name: string;
  photo?: string | null;
}

export const MAX_TAGS = 10;

// Active tags for a set of posts, with each person's display name. People who
// aren't publicly visible are skipped, so a tag never links to a missing page.
export async function loadTags(postIds: string[]): Promise<Map<string, TaggedPerson[]>> {
  const out = new Map<string, TaggedPerson[]>();
  if (postIds.length === 0) return out;
  const { data: rows } = await supabase
    .from('post_tags')
    .select('post_id, tagged_email, created_at')
    .eq('status', 'active')
    .in('post_id', postIds)
    .order('created_at', { ascending: true });
  const emails = [...new Set((rows ?? []).map((r) => r.tagged_email as string))];
  if (emails.length === 0) return out;
  const { data: people } = await supabase.from('public_profiles').select('email, full_name, profile_photo').in('email', emails);
  const byEmail = new Map((people ?? []).map((p) => [p.email as string, p]));
  for (const r of rows ?? []) {
    const p = byEmail.get(r.tagged_email as string);
    if (!p) continue;
    const list = out.get(r.post_id as string) ?? [];
    list.push({ email: p.email as string, name: (p.full_name as string | null)?.trim() || 'Creator', photo: (p.profile_photo as string | null) ?? null });
    out.set(r.post_id as string, list);
  }
  return out;
}
