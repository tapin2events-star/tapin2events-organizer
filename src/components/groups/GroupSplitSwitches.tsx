import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useFeature } from '../../lib/preview';
import { toast, toastError } from '../../lib/toast';

// Group splits for music and tips (preview): the owner chooses what else is split by the members' shares (the same
// shares as bookings). Off: that money goes to the group's owner. Members who haven't connected payouts have their
// share held for them (buyers and tippers are never blocked).
export default function GroupSplitSwitches({ groupId, isOwner }: { groupId: string; isOwner: boolean }) {
  const on = useFeature('music_uploads');
  const [s, setS] = useState<{ music: boolean; tips: boolean } | null>(null);
  useEffect(() => { if (on) supabase.rpc('group_split_settings', { p_group_id: groupId }).then(({ data }) => setS((data ?? null) as { music: boolean; tips: boolean } | null)); }, [on, groupId]);
  if (!on || !s) return null;
  async function set(key: 'music' | 'tips', value: boolean) {
    const { error } = await supabase.rpc('set_group_split', { p_group_id: groupId, p_music: key === 'music' ? value : null, p_tips: key === 'tips' ? value : null });
    if (error) return toastError(error.message);
    setS({ ...s!, [key]: value });
    toast(value ? `✓ ${key === 'music' ? 'Music sales and donations' : 'Tips'} are split by shares` : `${key === 'music' ? 'Music sales and donations' : 'Tips'} go to the owner`);
  }
  const Row = ({ k, title, desc }: { k: 'music' | 'tips'; title: string; desc: string }) => (
    <div className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0"><p className="text-sm font-semibold text-gray-900">{title}</p><p className="text-xs text-gray-500">{desc}</p></div>
      <button role="switch" aria-checked={s[k]} aria-label={title} disabled={!isOwner} onClick={() => set(k, !s[k])}
        className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-60 ${s[k] ? 'bg-indigo-600' : 'bg-gray-300'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${s[k] ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-white px-3">
      <p className="pt-3 text-sm font-semibold text-gray-900">Also split by these shares</p>
      <div className="divide-y divide-gray-100">
        <Row k="music" title="🎵 Music sales & donations" desc="Each member gets their share of every album, song and donation. Off: it goes to the owner." />
        <Row k="tips" title="💸 Tips" desc="Tips to the group (Tip the performers) are shared the same way. Off: they go to the owner." />
      </div>
      <p className="pb-3 text-[11px] text-gray-500">{isOwner ? 'Members who haven\u2019t connected payouts have their share held for them, so fans can always buy and tip. Members are notified when their share changes.' : 'Only the owner can change this.'}</p>
    </div>
  );
}
