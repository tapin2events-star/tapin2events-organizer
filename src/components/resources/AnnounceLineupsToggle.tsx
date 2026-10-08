import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

// "Tell my followers when I'm added to an event lineup" for a resource or group.
export default function AnnounceLineupsToggle({ resourceId, isGroup = false }: { resourceId: string; isGroup?: boolean }) {
  const [on, setOn] = useState<boolean | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    supabase.from('resources').select('announce_lineups').eq('id', resourceId).maybeSingle().then(({ data }) => setOn(data?.announce_lineups ?? true));
  }, [resourceId]);
  if (on === null) return null;
  async function toggle() {
    const next = !on;
    setOn(next); setError(false);
    const { error: e } = await supabase.from('resources').update({ announce_lineups: next }).eq('id', resourceId);
    if (e) { setOn(!next); setError(true); }
  }
  return (
    <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4">
      <input type="checkbox" checked={on} onChange={toggle} className="mt-0.5 h-5 w-5 accent-marigold" />
      <span>
        <span className="block text-sm font-medium text-gray-900">Tell {isGroup ? "the group's" : 'my'} followers when {isGroup ? "we're" : "I'm"} added to an event lineup</span>
        <span className="block text-xs text-gray-500">Followers get an email about an hour after an organizer adds {isGroup ? 'the group' : 'you'} to a published event's lineup. Bookings themselves stay private.</span>
        {error && <span className="mt-1 block text-xs text-red-600">Couldn't save. Please try again.</span>}
      </span>
    </label>
  );
}
