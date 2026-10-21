import { useOrgWhiteLabel } from '../lib/whiteLabel';
import OrgPublic from './business/OrgPublic';
import type { DomainOrg } from '../lib/customDomain';

// The home page of an organization's own domain: its full organization page, in its branding
// (no TapIN menus). White-labeled events open on the same domain; anything else goes to app.tapin2events.com.
export default function OrgDomainHome({ org }: { org: DomainOrg }) {
  useOrgWhiteLabel(org.slug);
  if (!org.slug) return <div className="min-h-screen bg-white" />;
  return (
    // Full screen: the page's own edge-to-edge layout (its cover spans the whole width; content stays centered).
    <div className="min-h-screen overflow-x-clip px-4 pt-4 sm:px-6">
      <OrgPublic slugOverride={org.slug} />
    </div>
  );
}
