import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { VendorApplication, VendorApplicationStatus } from '../../lib/types';

const STATUS_STYLES: Record<VendorApplicationStatus, string> = {
  pending: 'bg-marigold/20 text-marigold',
  approved: 'bg-mint/20 text-mint',
  paid: 'bg-mint/20 text-mint',
  rejected: 'bg-magenta/20 text-magenta',
  withdrawn: 'bg-surface2 text-muted',
};

export default function VendorApplicationsTab({ eventId }: { eventId: string }) {
  const [apps, setApps] = useState<VendorApplication[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase
      .from('event_vendor_applications')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });
    setApps((data ?? []) as VendorApplication[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [eventId]);

  async function setStatus(id: string, status: VendorApplicationStatus) {
    await supabase.from('event_vendor_applications').update({ status }).eq('id', id);
    load();
  }

  if (loading) return <p className="text-muted">Loading…</p>;

  if (apps.length === 0) {
    return (
      <p className="text-sm text-muted">
        No vendor applications yet. Enable vendor applications when editing this event to start
        accepting them.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {apps.map((app) => (
        <li key={app.id} className="rounded-xl bg-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-lg font-semibold text-bone">{app.business_name}</p>
              <p className="font-mono text-xs text-muted">{app.resource_email}</p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${STATUS_STYLES[app.status]}`}
            >
              {app.status}
            </span>
          </div>
          <p className="mt-2 text-sm text-muted">{app.description}</p>
          <p className="mt-1 font-mono text-xs text-bone">Fee: ${app.agreed_fee?.toFixed(2)}</p>

          {app.status === 'pending' && (
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setStatus(app.id, 'approved')}
                className="rounded-lg bg-mint/20 px-3 py-1.5 text-xs font-semibold text-mint hover:bg-mint/30"
              >
                Approve
              </button>
              <button
                onClick={() => setStatus(app.id, 'rejected')}
                className="rounded-lg bg-magenta/20 px-3 py-1.5 text-xs font-semibold text-magenta hover:bg-magenta/30"
              >
                Reject
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
