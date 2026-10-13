import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadMyOrgs, type MyOrg } from '../../lib/business';

// Profile shortcuts: each organization you're on (straight to its settings), plus TapIN for Business.
export default function ProfileOrgLinks() {
  const [orgs, setOrgs] = useState<MyOrg[] | null>(null);
  useEffect(() => { loadMyOrgs().then((list) => setOrgs(list.filter((o) => o.status !== 'deleted'))); }, []);
  const ROLE: Record<string, string> = { owner: 'Owner', admin: 'Admin', editor: 'Editor', viewer: 'Viewer', helper: 'Helper' };
  return (
    <>
      {(orgs ?? []).map((o) => (
        <Link key={o.id} to={`/business/${o.slug}/manage`} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-surface2 p-4 hover:border-marigold">
          {o.logo_url ? <img src={o.logo_url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-bold text-white" style={{ background: o.brand?.primary || '#0F1B3D' }}>{o.name.charAt(0)}</span>}
          <span className="min-w-0">
            <span className="block truncate font-medium text-bone">{o.name}{o.verified && <span className="ml-1 text-[#C9A227]">✓</span>}</span>
            <span className="block text-xs text-muted">Your organization · {ROLE[o.role] ?? o.role}</span>
          </span>
        </Link>
      ))}
      <Link to="/business" className="rounded-xl border border-gray-200 bg-surface2 p-4 hover:border-marigold">
        <p className="font-medium text-bone">TapIN for Business</p>
        <p className="text-xs text-muted">{orgs && orgs.length > 0 ? 'All your organizations, or start another' : 'Host events as a business, nonprofit or community group'}</p>
      </Link>
    </>
  );
}
