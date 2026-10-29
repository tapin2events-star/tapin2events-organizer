import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useFeature } from '../../lib/preview';
import { toast, toastError } from '../../lib/toast';

// "Add your songs" on a group's or organization's Manage page: a member checks songs from their own artist profile to
// show on the page ("Music from our members"). The owner or admins approve each one (a manager's own are approved
// right away). The songs stay the member's: plays and earnings go to them.
interface Song { id: string; title: string; duration_sec: number | null; cover: string | null; status: 'pending' | 'approved' | null }
export default function AddMySongs({ targetId, name }: { targetId: string | null; name: string }) {
  const on = useFeature('music_uploads');
  const [songs, setSongs] = useState<Song[] | null>(null);
  const load = useCallback(() => { if (targetId) supabase.rpc('my_songs_for_target', { p_target: targetId }).then(({ data }) => setSongs((data ?? []) as Song[])); }, [targetId]);
  useEffect(() => { if (on) load(); }, [on, load]);
  if (!on || !targetId || songs === null) return null;
  async function toggle(s: Song) {
    const { data, error } = await supabase.rpc('set_track_on_group', { p_track_id: s.id, p_group_id: targetId, p_on: !s.status });
    if (error) return toastError(error.message);
    toast(data === 'pending' ? 'Sent for approval' : data === 'approved' ? `Added to ${name}\u2019s page` : `Removed from ${name}\u2019s page`);
    load();
  }
  return (
    <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
      <h2 className="font-display text-lg font-semibold text-gray-900">🎤 Add your songs</h2>
      <p className="mt-0.5 text-xs text-gray-500">Show songs from your own artist profile on {name}&apos;s page. The owner or an admin approves them first. They stay yours: plays and earnings go to you.</p>
      {songs.length === 0 ? (
        <p className="mt-3 text-sm text-gray-600">You don&apos;t have any songs yet. <Link to="/resources/dashboard?tab=Music" className="font-medium text-marigold underline">Add music to your artist profile</Link>, then come back here.</p>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-200">
          {songs.map((s) => (
            <li key={s.id}>
              <label className="flex min-h-[56px] cursor-pointer items-center gap-3 px-3 py-2">
                {s.cover ? <img src={s.cover} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-teal-500 text-white" aria-hidden="true">♪</span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-gray-900">{s.title}</span>
                  <span className={`block text-xs ${s.status === 'approved' ? 'text-green-700' : s.status === 'pending' ? 'text-amber-700' : 'text-gray-500'}`}>{s.status === 'approved' ? `On ${name}\u2019s page` : s.status === 'pending' ? 'Waiting for approval' : 'Not added'}</span>
                </span>
                <input type="checkbox" checked={!!s.status} onChange={() => toggle(s)} className="h-5 w-5 shrink-0 accent-indigo-600" aria-label={`Show ${s.title} on ${name}'s page`} />
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
