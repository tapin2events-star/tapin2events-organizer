import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useFeature } from '../../lib/preview';
import { toast, toastError } from '../../lib/toast';

// Manage page (group or organization): member songs currently showing on the page ("Music from our members"), with
// Remove for the owner and admins. The songs stay on each member's own profile.
interface T { id: string; title: string; artist: string; artist_id: string; cover: string | null }
export default function MemberSongsOnPage({ targetId, name, canRemove }: { targetId: string | null; name: string; canRemove: boolean }) {
  const on = useFeature('music_uploads');
  const [songs, setSongs] = useState<T[] | null>(null);
  const load = useCallback(() => { if (targetId) supabase.rpc('group_member_music', { p_group_id: targetId }).then(({ data }) => setSongs((data ?? []) as T[])); }, [targetId]);
  useEffect(() => { if (on) load(); }, [on, load]);
  if (!on || !songs || songs.length === 0) return null;
  async function remove(t: T) {
    if (!window.confirm(`Take \u201c${t.title}\u201d off ${name}\u2019s page? It stays on ${t.artist}\u2019s own profile.`)) return;
    const { error } = await supabase.rpc('decide_group_song', { p_group_id: targetId, p_track_id: t.id, p_approve: false });
    if (error) return toastError(error.message);
    toast('Removed from the page'); load();
  }
  return (
    <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
      <h2 className="font-display text-lg font-semibold text-gray-900">🎤 Music from our members</h2>
      <p className="mt-0.5 text-xs text-gray-500">Songs from members&apos; own profiles, showing on {name}&apos;s page. Plays and earnings go to each member.</p>
      <ul className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-200">
        {songs.map((t) => (
          <li key={t.id} className="flex min-h-[56px] items-center gap-3 px-3 py-2">
            {t.cover ? <img src={t.cover} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-teal-500 text-white" aria-hidden="true">♪</span>}
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-gray-900">{t.title}</span>
              <span className="block truncate text-xs text-gray-500">by <Link to={`/resources/${t.artist_id}`} className="font-medium text-indigo-600 hover:underline">{t.artist}</Link></span></span>
            {canRemove && <button onClick={() => remove(t)} className="min-h-[36px] shrink-0 rounded-full border border-gray-300 px-3 text-xs font-medium text-gray-700">Remove</button>}
          </li>
        ))}
      </ul>
    </section>
  );
}
