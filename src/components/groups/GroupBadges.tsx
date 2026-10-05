import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { groupsOf } from '../../lib/groups';

// "Member of" chips on a person's or resource's profile.
export default function GroupBadges({ email, className = '' }: { email: string; className?: string }) {
  const [groups, setGroups] = useState<Awaited<ReturnType<typeof groupsOf>>>([]);
  useEffect(() => { if (email) groupsOf(email).then(setGroups); }, [email]);
  if (groups.length === 0) return null;
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="text-xs font-medium text-gray-500">Member of</span>
      {groups.map((g) => (
        <Link key={g.group_id} to={`/resources/${g.group_id}`} className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white py-0.5 pl-0.5 pr-2.5 text-xs font-medium text-gray-800 hover:border-marigold">
          {g.profile_image
            ? <img src={g.profile_image} alt="" className="h-5 w-5 rounded-full object-cover" />
            : <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-100 text-[10px] font-bold text-purple-700">{g.name.charAt(0)}</span>}
          {g.name}{g.title ? <span className="text-gray-400"> · {g.title}</span> : null}
        </Link>
      ))}
    </div>
  );
}
