import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

// Sales tab: the first-event payout protection, with what's held and when it's released.
interface Info { reserve?: { new?: boolean; release_at?: string | null }; reserved_cents?: number; reserve_release_at?: string | null }
export default function ReserveCard({ eventId }: { eventId: string }) {
  const [info, setInfo] = useState<Info | null>(null);
  useEffect(() => { supabase.rpc('event_payout_info', { p_event_id: eventId }).then(({ data }) => setInfo((data ?? null) as Info | null)); }, [eventId]);
  if (!info) return null;
  const held = Number(info.reserved_cents ?? 0);
  if (!info.reserve?.new && held <= 0) return null;
  const when = info.reserve_release_at ?? info.reserve?.release_at ?? null;
  const date = when ? new Date(when).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : null;
  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900">
      <p className="font-semibold">💸 First event payout protection</p>
      {held > 0 ? (
        <p className="mt-1"><strong>${(held / 100).toFixed(2)}</strong> is held{date ? <> and will be released on <strong>{date}</strong></> : ' until after your event'}. Everything else is paid on the normal schedule.</p>
      ) : (
        <p className="mt-1">You get 75% of your earnings on the normal schedule, and 25% is released{date ? <> on <strong>{date}</strong></> : ''}, 2 days after your event ends.</p>
      )}
      <p className="mt-1 text-xs text-indigo-800">This protects your buyers on your first event with TapIN. After it, payouts come on the normal schedule.</p>
    </div>
  );
}
