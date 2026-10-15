import { useEffect, useState } from 'react';
import { useFeature } from '../../lib/preview';
import { Link } from 'react-router-dom';
import OrgCard from './OrgCard';
import { loadOrgDirectory, type DirOrg } from '../../lib/orgDirectory';

// Discover: a swipeable row of organizations with upcoming events (verified first),
// or, while searching, organizations whose names match.
export default function FeaturedOrgs({ query = '' }: { query?: string }) {
  const [orgs, setOrgs] = useState<DirOrg[]>([]);
  const searching = query.trim().length >= 2;
  // Business plan perk (Preview): plan members are featured first.
  const planPerk = useFeature('featured_perk');
  useEffect(() => {
    const t = setTimeout(() => {
      loadOrgDirectory(searching ? { query, limit: 6, planPerk } : { featured: true, limit: 10, planPerk }).then(setOrgs);
    }, searching ? 250 : 0);
    return () => clearTimeout(t);
  }, [query, searching, planPerk]);
  if (orgs.length === 0) return null;
  return (
    <section className="mt-6">
      <div className="flex items-end justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-gray-900">{searching ? 'Organizations' : 'Featured organizations'}</h2>
        <Link to="/organizations" className="shrink-0 text-sm font-semibold text-marigold">See all ›</Link>
      </div>
      <div className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
        {orgs.map((o) => <OrgCard key={o.id} org={o} compact featured={planPerk && !!o.plan_member} />)}
      </div>
    </section>
  );
}
