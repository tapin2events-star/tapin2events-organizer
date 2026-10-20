import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

// White-label custom domains: TapIN running on an organization's own address (like tickets.pressplay.com).
export const APP_ORIGIN = 'https://app.tapin2events.com';
const OWN_HOSTS = /^(app\.tapin2events\.com|localhost|127\.0\.0\.1|.*\.pages\.dev|tapin2events-star\.github\.io)$/i;
export const isCustomDomain = () => typeof window !== 'undefined' && !OWN_HOSTS.test(window.location.hostname);

export interface DomainOrg { org_id: string; slug: string | null; name: string }
// The organization this custom domain belongs to (null = not an active custom domain).
export function useDomainOrg(): { org: DomainOrg | null; ready: boolean } {
  const [state, setState] = useState<{ org: DomainOrg | null; ready: boolean }>({ org: null, ready: !isCustomDomain() });
  useEffect(() => {
    if (!isCustomDomain()) return;
    supabase.rpc('org_by_domain', { p_host: window.location.hostname }).then(({ data }) => setState({ org: (data ?? null) as DomainOrg | null, ready: true }));
  }, []);
  return state;
}
export const sendToApp = (path: string) => { window.location.replace(`${APP_ORIGIN}${path}`); };
