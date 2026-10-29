import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useFeature } from '../../lib/preview';
import { toast, toastError } from '../../lib/toast';

// Group Manage (owner/admins): songs members want to add to the group's page. Approve to show them in "Music from our
// members", or decline. The member is told either way.
interface Req { track_id: string; title: string; url: string | null; artist: string; artist_id: string; at: string }
export default function GroupSongRequests({ groupId }: { groupId: string }) {
  const on = useFeature('music_uploads');
  const [reqs, setReqs] = useState<Req[]>([]);
  const load = useCallback(() => { supabase.rpc('group_song_requests', { p_group_id: groupId }).then(({ data }) => setReqs((data ?? []) as Req[])); }, [groupId]);
  useEffect(() => { if (on) load(); }, [on, load]);
  if (!on || reqs.length === 0) return null;
  async function decide(r: Req, approve: boolean) {
    const { error } = await supabase.rpc('decide_group_song', { p_group_id: groupId, p_track_id: r.track_id, p_approve: approve });
    if (error) return toastError(error.message);
    toast(approve ? `\u201c${r.title}\u201d is on the group's page` : 'Declined'); load();
  }
  return (
    <section className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 sm:p-5">
      <h2 className="font-display text-lg font-semibold text-indigo-950">🎵 Songs waiting for approval</h2>
      <p className="text-xs text-indigo-900">Members want to show these songs from their own profiles on the group&apos;s page. The songs stay theirs, and so do any earnings.</p>
      <ul className="mt-3 flex flex-col gap-2">
        {reqs.map((r) => (
          <li key={r.track_id} className="rounded-xl bg-white p-3">
            <p className="text-sm font-semibold text-gray-900">{r.title} <span className="font-normal text-gray-500">by {r.artist}</span></p>
            {r.url && <audio controls preload="none" src={r.url} className="mt-2 w-full" />}
            <div className="mt-2 flex gap-2">
              <button onClick={() => decide(r, true)} className="min-h-[40px] rounded-full bg-indigo-600 px-4 text-sm font-semibold text-white">Approve</button>
              <button onClick={() => decide(r, false)} className="min-h-[40px] rounded-full border border-gray-300 px-4 text-sm font-medium text-gray-700">Decline</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
