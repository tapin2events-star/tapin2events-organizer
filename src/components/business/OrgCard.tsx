import { Link } from 'react-router-dom';
import { primeOrg, type CachedOrg } from '../../lib/orgCache';
import OrgFollowButton from './OrgFollowButton';
import type { DirOrg } from '../../lib/orgDirectory';

// Organization card for the directory and the Discover row.
export default function OrgCard({ org, compact = false, featured = false }: { org: DirOrg; compact?: boolean; featured?: boolean }) {
  primeOrg(org as unknown as CachedOrg);
  return (
    <div className={`flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white ${compact ? 'w-64 shrink-0 snap-start' : ''}`}>
      <Link to={`/o/${org.slug}`} className="block">
        <div className="h-16 w-full" style={{ background: org.cover_url ? `center / cover no-repeat url("${org.cover_url}")` : `linear-gradient(135deg, ${org.brand.primary}, ${org.brand.accent})` }} />
        <div className="-mt-7 px-4">
          {org.logo_url ? <img src={org.logo_url} alt="" className="h-14 w-14 rounded-2xl border-4 border-white bg-white object-cover" /> : <span className="flex h-14 w-14 items-center justify-center rounded-2xl border-4 border-white text-xl font-bold text-white" style={{ background: org.brand.primary }}>{org.name.charAt(0)}</span>}
        </div>
      </Link>
      <div className="flex flex-1 flex-col px-4 pb-4 pt-1">
        <Link to={`/o/${org.slug}`} className="font-semibold text-gray-900 hover:underline">
          <span className="line-clamp-1">{org.name}{org.verified && <span className="ml-1" style={{ color: org.brand.accent }} title="Verified">✓</span>}</span>
          {featured && <span className="mt-0.5 inline-block w-fit rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">⭐ Featured</span>}
        </Link>
        <p className="text-xs text-gray-500">{org.kind === 'nonprofit' ? 'Nonprofit' : org.kind === 'community' ? 'Community group' : 'Organization'}{org.city ? ` · ${org.city}${org.state ? `, ${org.state}` : ''}` : ''}</p>
        {org.tagline && <p className="mt-1.5 line-clamp-2 text-sm text-gray-600">{org.tagline}</p>}
        <p className="mt-2 text-xs font-medium" style={{ color: org.upcoming_events ? org.brand.primary : '#9CA3AF' }}>
          {org.upcoming_events ? `${org.upcoming_events} upcoming event${org.upcoming_events === 1 ? '' : 's'}` : 'No upcoming events'}
        </p>
        <div className="mt-auto pt-3"><OrgFollowButton orgId={org.id} color={org.brand.primary} compact /></div>
      </div>
    </div>
  );
}
