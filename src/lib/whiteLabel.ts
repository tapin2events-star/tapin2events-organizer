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
