import { useEffect, useState, type ReactNode } from 'react';
import { matchPath, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { isCustomDomain, sendToApp, useDomainOrg } from '../lib/customDomain';
import OrgDomainHome from '../pages/OrgDomainHome';

// On an organization's own domain, only its white-labeled content is shown: its branded home page, its
// white-labeled events, tickets and "Your tickets". Anything else goes to app.tapin2events.com.
const ALLOWED = ['/events/:id', '/pass/:ticketId', '/tickets/:slug', '/o/:slug', '/p/:code', '/terms', '/privacy', '/refund-policy'];

export default function DomainGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { org, ready } = useDomainOrg();
  const [eventOk, setEventOk] = useState<boolean | null>(null);
  const custom = isCustomDomain();
  const eventMatch = matchPath('/events/:id', location.pathname);
  useEffect(() => {
    if (!custom || !ready) return;
    const path = location.pathname + location.search;
    if (!org) { sendToApp(path); return; }
    if (location.pathname === '/') return;
    // The organization's own page lives at the domain's main address; other organizations go to TapIN.
    const orgMatch = matchPath('/o/:slug', location.pathname);
    if (orgMatch) { if (orgMatch.params.slug === org.slug) window.history.replaceState(null, '', '/'); else sendToApp(path); return; }
    if (!ALLOWED.some((p) => matchPath(p, location.pathname))) { sendToApp(path); return; }
    if (eventMatch?.params.id) {
      // Only this organization's white-labeled events live on its domain.
      setEventOk(null);
      supabase.from('events').select('organization_id, white_label').eq('id', eventMatch.params.id).maybeSingle().then(({ data }) => {
        const ok = !!data && data.organization_id === org.org_id && data.white_label === true;
        if (!ok) sendToApp(path); else setEventOk(true);
      });
    }
  }, [custom, ready, org, location.pathname, location.search]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!custom) return <>{children}</>;
  if (!ready || !org) return <div className="min-h-screen bg-white" />;
  if (location.pathname === '/' || matchPath('/o/:slug', location.pathname)?.params.slug === org.slug) return <OrgDomainHome org={org} />;
  if (eventMatch && !eventOk) return <div className="min-h-screen bg-white" />;
  return <>{children}</>;
}
