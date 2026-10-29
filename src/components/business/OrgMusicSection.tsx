import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useFeature } from '../../lib/preview';
import ArtistMusic from '../music/ArtistMusic';
import GroupMemberMusic from '../music/GroupMemberMusic';

// Organization page (preview): the organization's albums and songs, and "Music from our members" (team members' own
// songs, approved by the organization's admins).
export default function OrgMusicSection({ orgId, orgName }: { orgId: string; orgName: string }) {
  const on = useFeature('music_uploads');
  const [rid, setRid] = useState<string | null>(null);
  useEffect(() => { if (on) supabase.rpc('org_music_resource_id', { p_org_id: orgId }).then(({ data }) => setRid((data as string | null) ?? null)); }, [on, orgId]);
  if (!on || !rid) return null;
  return (
    <div className="mt-10">
      <ArtistMusic resourceId={rid} artistName={orgName} />
      <GroupMemberMusic groupId={rid} groupName={orgName} />
    </div>
  );
}
