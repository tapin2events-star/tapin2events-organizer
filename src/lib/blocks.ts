import { supabase } from './supabaseClient';

// Blocking hides each person's posts and comments from the other, removes follows
// both ways, and stops comments, follows, tags, and tips between them (enforced in the database).
export async function blockUser(myEmail: string, email: string): Promise<boolean> {
  const { error } = await supabase.from('user_blocks').upsert({ blocker_email: myEmail, blocked_email: email }, { onConflict: 'blocker_email,blocked_email', ignoreDuplicates: true });
  return !error;
}

export async function unblockUser(myEmail: string, email: string): Promise<boolean> {
  const { error } = await supabase.from('user_blocks').delete().eq('blocker_email', myEmail).eq('blocked_email', email);
  return !error;
}

export async function hasBlocked(myEmail: string, email: string): Promise<boolean> {
  const { data } = await supabase.from('user_blocks').select('blocked_email').eq('blocker_email', myEmail).eq('blocked_email', email).maybeSingle();
  return !!data;
}
