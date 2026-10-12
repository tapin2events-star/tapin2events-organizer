import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import OrgCard from './OrgCard';
import { loadOrgDirectory, type DirOrg } from '../../lib/orgDirectory';

// Discover: a swipeable row of organizations with upcoming events (verified first),
// or, while searching, organizations whose names match.
export default function FeaturedOrgs({ query = '' }: { query?: string }) {
  const [orgs, setOrgs] = useState<DirOrg[]>([]);
  const searching = query.trim().length >= 2;
  useEffect(() => {
    const t = setTimeout(() => {
      loadOrgDirectory(searching ? { query, limit: 6 } : { featured: true, limit: 10 }).then(setOrgs);
    }, searching ? 250 : 0);
    return () => clearTimeout(t);
  }, [query, searching]);
  if (orgs.length === 0) return null;
  return (
    <section className="mt-6">
      <div className="flex items-end justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-gray-900">{searching ? 'Organizations' : 'Featured organizations'}</h2>
        <Link to="/organizations" className="shrink-0 text-sm font-semibold text-marigold">See all ›</Link>
      </div>
      <div className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
        {orgs.map((o) => <OrgCard key={o.id} org={o} compact />)}
      </div>
    </section>
  );
}
