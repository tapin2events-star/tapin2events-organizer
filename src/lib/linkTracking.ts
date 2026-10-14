import { supabase } from './supabaseClient';

// Promotion links: remember visits that came through an organizer's or promoter's link, so tickets
// bought within 7 days are credited to it. Signed-out visitors get an anonymous device key; their
// visits attach to their account once they sign in.
const KEY = 'tapin_vk';
export function visitorKey(): string {
  try {
    let k = localStorage.getItem(KEY);
    if (!k) { k = crypto.randomUUID().replace(/-/g, ''); localStorage.setItem(KEY, k); }
    return k;
  } catch { return ''; }
}
export async function recordLinkVisit(code: string) {
  if (!/^[a-z0-9]{6,12}$/i.test(code)) return;
  await supabase.rpc('record_link_visit', { p_code: code.toLowerCase(), p_visitor_key: visitorKey() || null });
  try { localStorage.setItem('tapin_vk_unclaimed', '1'); } catch { /* storage unavailable */ }
}
export async function claimLinkVisits() {
  try {
    if (localStorage.getItem('tapin_vk_unclaimed') !== '1') return;
    const k = localStorage.getItem(KEY);
    if (!k) return;
    await supabase.rpc('claim_link_visits', { p_visitor_key: k });
    localStorage.removeItem('tapin_vk_unclaimed');
  } catch { /* storage unavailable */ }
}
