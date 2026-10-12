import { supabase } from './supabaseClient';

export type OrgKind = 'business' | 'nonprofit';
export type EventKind = 'community' | 'business' | 'nonprofit';
export interface Brand { primary: string; accent: string; font: string; theme: 'light' | 'dark' }
export interface Organization {
  id: string; name: string; slug: string; kind: OrgKind; tagline: string | null; description: string | null;
  website: string | null; contact_email: string | null; city: string | null; state: string | null;
  logo_url: string | null; cover_url: string | null; brand: Brand; verified: boolean; status: string; created_by: string | null;
}
export interface MyOrg { id: string; name: string; slug: string; kind: OrgKind; logo_url: string | null; brand: Brand; role: 'owner' | 'admin' | 'member'; verified: boolean }
export interface Session { id: string; event_id: string; title: string; description: string | null; kind: string; starts_at: string | null; ends_at: string | null; room: string | null; track: string | null; capacity: number | null; sort_order: number }
export interface Speaker { id: string; event_id: string; name: string; title: string | null; company: string | null; bio: string | null; photo_url: string | null; resource_id: string | null; link: string | null; featured: boolean; sort_order: number }
export interface Sponsor { id: string; event_id: string; name: string; tier: string; logo_url: string | null; website: string | null; sort_order: number }

export const DEFAULT_BRAND: Brand = { primary: '#1E3A8A', accent: '#C9A227', font: 'Inter', theme: 'light' };
// Fonts loaded from Google Fonts on business pages.
export const BRAND_FONTS = ['Inter', 'Poppins', 'Montserrat', 'Playfair Display', 'Lora', 'Raleway', 'DM Sans', 'Merriweather'];
export const SESSION_KINDS: { key: string; label: string }[] = [
  { key: 'keynote', label: 'Keynote' }, { key: 'session', label: 'Session' }, { key: 'panel', label: 'Panel' }, { key: 'workshop', label: 'Workshop' },
  { key: 'networking', label: 'Networking' }, { key: 'break', label: 'Break' }, { key: 'meal', label: 'Meal' }, { key: 'other', label: 'Other' },
];
export const SPONSOR_TIERS = ['Presenting', 'Platinum', 'Gold', 'Silver', 'Bronze', 'Supporter', 'Community partner'];

export const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

export function loadFont(font?: string) {
  if (!font || typeof document === 'undefined') return;
  const id = `gf-${font.replace(/\s+/g, '-')}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id; link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@400;600;700;800&display=swap`;
  document.head.appendChild(link);
}

// Upload an image (logo, cover, speaker photo, sponsor logo) to TapIN storage.
export async function uploadImage(userId: string, file: File, label: string): Promise<{ url?: string; error?: string }> {
  if (!/^image\/(jpeg|png|webp|gif|svg\+xml)$/.test(file.type)) return { error: 'Please choose a JPG, PNG, WebP, GIF or SVG image.' };
  if (file.size > 5 * 1024 * 1024) return { error: 'That image is over 5 MB.' };
  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${userId}/${label}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('event-posters').upload(path, file, { contentType: file.type });
  if (error) return { error: 'Upload failed. Please try again.' };
  return { url: supabase.storage.from('event-posters').getPublicUrl(path).data.publicUrl };
}

export async function loadMyOrgs(): Promise<MyOrg[]> {
  const { data } = await supabase.rpc('my_organizations');
  return ((data ?? []) as MyOrg[]).map((o) => ({ ...o, brand: { ...DEFAULT_BRAND, ...(o.brand ?? {}) } }));
}
