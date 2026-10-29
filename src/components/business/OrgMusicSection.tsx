import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useFeature } from '../../lib/preview';
import ArtistMusic from '../music/ArtistMusic';
import GroupMemberMusic from '../music/GroupMemberMusic';

// Organization page (preview): a "Music" section, spaced and titled like the page's other sections, with the
// organization's albums and songs, then "Music from our members" (team members' own songs, approved by its admins).
export default function OrgMusicSection({ orgId, orgName }: { orgId: string; orgName: string }) {
  const on = useFeature('music_uploads');
  const [rid, setRid] = useState<string | null>(null);
  useEffect(() => { if (on) supabase.rpc('org_music_resource_id', { p_org_id: orgId }).then(({ data }) => setRid((data as string | null) ?? null)); }, [on, orgId]);
  if (!on || !rid) return null;
  return (
    <section className="pb-10" aria-label={`Music from ${orgName}`}>
      <h2 className="text-xl font-bold">Music</h2>
      <div className="mt-4 flex flex-col gap-6">
        <ArtistMusic resourceId={rid} artistName={orgName} bare />
        <GroupMemberMusic groupId={rid} groupName={orgName} bare />
      </div>
    </section>
  );
}
