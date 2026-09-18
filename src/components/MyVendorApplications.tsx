import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

interface VendorApp {
  id: string;
  event_id: string;
  business_name: string;
  description: string;
  agreed_fee: number;
  status: 'pending' | 'approved' | 'paid' | 'rejected' | 'withdrawn';
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-orange-100 text-orange-800',
  approved: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  withdrawn: 'bg-gray-100 text-gray-600',
};

export default function MyVendorApplications() {
  const { user } = useAuth();
  const [apps, setApps] = useState<(VendorApp & { event_title: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.email) return;
    (async () => {
      const { data } = await supabase
        .from('event_vendor_applications')
        .select('*')
        .eq('resource_email', user.email)
        .order('created_at', { ascending: false });
      const rows = data ?? [];
      const eventIds = [...new Set(rows.map((r) => r.event_id))];
      const { data: events } = eventIds.length
        ? await supabase.from('events').select('id, title').in('id', eventIds)
        : { data: [] };
      const eventsById = new Map((events ?? []).map((e) => [e.id, e.title]));
      setApps(rows.map((r) => ({ ...r, event_title: eventsById.get(r.event_id) ?? 'Event' })));
      setLoading(false);
    })();
  }, [user?.email]);

  async function payFee(applicationId: string) {
    setPayingId(applicationId);
    const base = window.location.origin + import.meta.env.BASE_URL;
    const { data, error } = await supabase.functions.invoke('create-vendor-fee-checkout', {
      body: {
        application_id: applicationId,
        successUrl: `${base}activity?checkout=success`,
        cancelUrl: `${base}activity?checkout=cancelled`,
      },
    });
    setPayingId(null);
    if (error || !data?.url) {
      alert(error?.message || 'Something went wrong starting checkout. Please try again.');
      return;
    }
    window.location.href = data.url;
  }

  if (loading || apps.length === 0) return null;

  return (
    <div className="mt-10">
      <h2 className="font-display text-xl font-bold text-gray-900">My Vendor Applications</h2>
      <div className="mt-3 flex flex-col gap-3">
        {apps.map((app) => (
          <div key={app.id} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-gray-900">{app.business_name}</p>
                <p className="text-sm text-gray-500">{app.event_title}</p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[app.status]}`}>
                {app.status}
              </span>
            </div>
            {app.agreed_fee > 0 && (
              <p className="mt-2 text-sm text-gray-600">Vendor fee: ${app.agreed_fee.toFixed(2)}</p>
            )}
            {app.status === 'approved' && app.agreed_fee > 0 && (
              <button
                onClick={() => payFee(app.id)}
                disabled={payingId === app.id}
                className="mt-3 rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-white hover:bg-marigold/90 disabled:opacity-50"
              >
                {payingId === app.id ? 'Please wait…' : `Pay vendor fee — $${app.agreed_fee.toFixed(2)}`}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
