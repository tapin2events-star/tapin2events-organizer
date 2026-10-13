import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadMyOrgs } from '../../lib/business';

// Profile shortcut to TapIN for Business, where all of your organizations are listed.
export default function ProfileOrgLinks() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => { loadMyOrgs().then((list) => setCount(list.filter((o) => o.status !== 'deleted').length)); }, []);
  return (
    <Link to="/business" className="rounded-xl border border-gray-200 bg-surface2 p-4 hover:border-marigold">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-bone">TapIN for Business</p>
        {!!count && <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-muted">{count} organization{count === 1 ? '' : 's'}</span>}
      </div>
      <p className="text-xs text-muted">{count ? 'Your organizations, or start another' : 'Host events as a business, nonprofit or community group'}</p>
    </Link>
  );
}
