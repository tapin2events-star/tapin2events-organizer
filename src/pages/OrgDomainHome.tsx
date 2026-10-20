import { useOrgWhiteLabel } from '../lib/whiteLabel';
import OrgPublic from './business/OrgPublic';
import type { DomainOrg } from '../lib/customDomain';

// The home page of an organization's own domain: its full organization page, in its branding
// (no TapIN menus). White-labeled events open on the same domain; anything else goes to app.tapin2events.com.
export default function OrgDomainHome({ org }: { org: DomainOrg }) {
  useOrgWhiteLabel(org.slug);
  if (!org.slug) return <div className="min-h-screen bg-white" />;
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-6" style={{ paddingTop: 'calc(1.5rem + env(safe-area-inset-top, 0px))' }}>
        <OrgPublic slugOverride={org.slug} />
      </div>
    </div>
  );
}
