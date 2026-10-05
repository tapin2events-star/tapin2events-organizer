import { supabase } from './supabaseClient';

export type GroupRole = 'owner' | 'admin' | 'member';

export interface MyGroup {
  group_id: string; name: string; profile_image: string | null; role: GroupRole;
  status: 'invited' | 'active'; title: string | null; member_count: number; invited_by_name: string | null;
}
export interface PublicMember {
  user_email: string; full_name: string | null; profile_photo: string | null; role: GroupRole;
  title: string | null; resource_id: string | null; resource_name: string | null;
}
export interface ManagedMember {
  user_email: string; role: GroupRole; title: string | null; status: 'invited' | 'active'; show_on_group: boolean;
  full_name?: string | null; profile_photo?: string | null;
}

export const ROLE_LABELS: Record<GroupRole, string> = { owner: 'Owner', admin: 'Admin', member: 'Member' };

// Database messages are written for people; show them as-is.
export function rpcError(error: { message?: string } | null, fallback = 'Something went wrong. Please try again.') {
  const m = error?.message ?? '';
  return m && !/violates|permission denied|syntax|function/i.test(m) ? m : fallback;
}

export async function groupsOf(email: string) {
  const { data } = await supabase.rpc('groups_of', { p_email: email });
  return (data ?? []) as { group_id: string; name: string; profile_image: string | null; title: string | null }[];
}
