import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { ROLE_LABELS, type PublicMember } from '../../lib/groups';

// Members on a group's public page. Members who have a resource profile link to it;
// others (managers, crew) link to their regular TapIN profile.
export default function GroupMembersSection({ groupId }: { groupId: string }) {
  const [members, setMembers] = useState<PublicMember[] | null>(null);
  useEffect(() => {
    supabase.rpc('group_members_public', { p_group: groupId }).then(({ data }) => setMembers((data ?? []) as PublicMember[]));
  }, [groupId]);
  if (!members || members.length === 0) return null;
  return (
    <div className="mt-6 border-t border-gray-200 pt-6">
      <h2 className="font-display text-lg font-semibold text-gray-900">Members</h2>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {members.map((m) => {
          const name = m.resource_name || m.full_name || 'TapIN member';
          const to = m.resource_id ? `/resources/${m.resource_id}` : `/creator/${encodeURIComponent(m.user_email)}`;
          return (
            <Link key={m.user_email} to={to} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 hover:border-marigold">
              {m.profile_photo
                ? <img src={m.profile_photo} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
                : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-marigold to-teal font-bold text-white">{name.charAt(0).toUpperCase()}</span>}
              <span className="min-w-0">
                <span className="block truncate font-medium text-gray-900">{name}</span>
                <span className="block truncate text-xs text-gray-500">
                  {m.title || (m.role !== 'member' ? ROLE_LABELS[m.role] : m.resource_id ? 'Artist & resource' : 'Member')}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
