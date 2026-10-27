import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

// Event editor (paid tickets): for an organization or organizer new on TapIN, explain the first-event payout
// protection up front: 75% paid on the normal schedule, 25% released two days after the event.
export default function NewOrganizerNote({ orgId }: { orgId: string | null }) {
  const [isNew, setIsNew] = useState(false);
  useEffect(() => { supabase.rpc('payout_is_new', { p_org_id: orgId }).then(({ data }) => setIsNew(data === true)); }, [orgId]);
  if (!isNew) return null;
  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900">
      <p className="font-semibold">💸 How payouts work for your first paid event</p>
      <p className="mt-1">You get <strong>75% of your earnings on the normal schedule</strong>, and <strong>25% is released 2 days after your event ends</strong>. This protects your buyers. After your first event, payouts come on the normal schedule.</p>
    </div>
  );
}
