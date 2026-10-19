import { useEffect, useState, useSyncExternalStore } from 'react';
import { supabase } from './supabaseClient';
import { useFeature } from './preview';

// White-label (Preview): when an attendee-facing page (event page, ticket) belongs to a white-labeled event,
// the app frame hides TapIN's menu, top bar and bottom tabs and the page shows the organization's brand.
export interface WhiteLabelBrand { name: string; logo: string | null; primary: string; accent: string; slug: string | null }
let current: WhiteLabelBrand | null = null;
const listeners = new Set<() => void>();
export function setWhiteLabel(b: WhiteLabelBrand | null) { current = b; listeners.forEach((l) => l()); }
export function useWhiteLabel() {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => current, () => null);
}

// For a page about one event: turns white-label on while the page is open (and off when leaving).
export function useEventWhiteLabel(eventId: string | null | undefined): WhiteLabelBrand | null {
  const on = useFeature('white_label');
  const [brand, setBrand] = useState<WhiteLabelBrand | null>(null);
  useEffect(() => {
    if (!on || !eventId) { setBrand(null); return; }
    let alive = true;
    (async () => {
      const { data: ev } = await supabase.from('events').select('white_label, organization_id').eq('id', eventId).maybeSingle();
      const e = ev as { white_label?: boolean; organization_id?: string | null } | null;
      if (!e?.white_label || !e.organization_id) { if (alive) setBrand(null); return; }
      const { data: org } = await supabase.from('organizations').select('name, slug, logo_url, brand').eq('id', e.organization_id).maybeSingle();
      const o = org as { name: string; slug: string | null; logo_url: string | null; brand: { primary?: string; accent?: string } | null } | null;
      if (alive && o) setBrand({ name: o.name, slug: o.slug, logo: o.logo_url, primary: o.brand?.primary || '#0F1B3D', accent: o.brand?.accent || '#C9A227' });
    })();
    return () => { alive = false; };
  }, [on, eventId]);
  useEffect(() => { setWhiteLabel(brand); return () => setWhiteLabel(null); }, [brand]);
  return brand;
}

// White-labeled pages: the browser tab shows the event's name and the organization's logo (restored on leave).
export function useBrandedTab(brand: WhiteLabelBrand | null, title: string | null | undefined) {
  useEffect(() => {
    if (!brand) return;
    const prevTitle = document.title;
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const prevIcon = icon?.href ?? null;
    document.title = title ? `${title} · ${brand.name}` : brand.name;
    if (icon && brand.logo) icon.href = brand.logo;
    return () => { document.title = prevTitle; if (icon && prevIcon) icon.href = prevIcon; };
  }, [brand, title]);
}

// For an organization's own pages (like "Your tickets"): branded when the organization has a white-labeled event.
// Returns the brand plus one of its white-labeled events (used for the branded sign-in code).
export function useOrgWhiteLabel(slug: string | null | undefined): { brand: WhiteLabelBrand | null; orgId: string | null; eventId: string | null; ready: boolean } {
  const on = useFeature('white_label');
  const [state, setState] = useState<{ brand: WhiteLabelBrand | null; orgId: string | null; eventId: string | null; ready: boolean }>({ brand: null, orgId: null, eventId: null, ready: false });
  useEffect(() => {
    if (!slug) { setState({ brand: null, orgId: null, eventId: null, ready: true }); return; }
    let alive = true;
    (async () => {
      const { data: org } = await supabase.from('organizations').select('id, name, slug, logo_url, brand').eq('slug', slug).maybeSingle();
      const o = org as { id: string; name: string; slug: string | null; logo_url: string | null; brand: { primary?: string; accent?: string } | null } | null;
      if (!o) { if (alive) setState({ brand: null, orgId: null, eventId: null, ready: true }); return; }
      const { data: ev } = await supabase.from('events').select('id').eq('organization_id', o.id).eq('white_label', true).limit(1).maybeSingle();
      const brand = on && ev ? { name: o.name, slug: o.slug, logo: o.logo_url, primary: o.brand?.primary || '#0F1B3D', accent: o.brand?.accent || '#C9A227' } : null;
      if (alive) setState({ brand, orgId: o.id, eventId: (ev as { id: string } | null)?.id ?? null, ready: true });
    })();
    return () => { alive = false; };
  }, [on, slug]);
  useEffect(() => { setWhiteLabel(state.brand); return () => setWhiteLabel(null); }, [state.brand]);
  return state;
}
