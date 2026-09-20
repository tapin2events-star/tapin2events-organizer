import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
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

export default function MyVendorApplicationsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [apps, setApps] = useState<(VendorApp & { event_title: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | VendorApp['status']>('all');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    if (!user.email) return;
    (async () => {
      const { data, error } = await supabase
        .from('event_vendor_applications')
        .select('*')
        .eq('resource_email', user.email)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Failed to load vendor applications:', error);
        setLoading(false);
        return;
      }
      const rows = data ?? [];
      const eventIds = [...new Set(rows.map((r) => r.event_id))];
      const { data: events, error: eventsError } = eventIds.length
        ? await supabase.from('events').select('id, title').in('id', eventIds)
        : { data: [], error: null };
      if (eventsError) console.error('Failed to load event titles for vendor applications:', eventsError);
      const eventsById = new Map((events ?? []).map((e) => [e.id, e.title]));
      setApps(rows.map((r) => ({ ...r, event_title: eventsById.get(r.event_id) ?? 'Event' })));
      setLoading(false);
    })();
  }, [user, authLoading, navigate, location.pathname]);

  const filteredApps = useMemo(
    () => apps.filter((a) => statusFilter === 'all' || a.status === statusFilter),
    [apps, statusFilter]
  );

  async function payFee(applicationId: string) {
    setPayingId(applicationId);
    const base = window.location.origin + import.meta.env.BASE_URL;
    const { data, error } = await supabase.functions.invoke('create-vendor-fee-checkout', {
      body: {
        application_id: applicationId,
        successUrl: `${base}vendor-applications?checkout=success`,
        cancelUrl: `${base}vendor-applications?checkout=cancelled`,
      },
    });
    setPayingId(null);
    if (error || !data?.url) {
      alert(error?.message || 'Something went wrong starting checkout. Please try again.');
      return;
    }
    window.location.href = data.url;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-display text-3xl font-extrabold text-gray-900">My Vendor Applications</h1>
        <p className="mt-1 text-gray-500">Every event you've applied to be a vendor at.</p>

        {loading ? (
          <p className="mt-6 text-gray-500">Loading…</p>
        ) : apps.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-white/60 py-16 text-center">
            <p className="text-lg font-semibold text-gray-500">No vendor applications yet</p>
            <Link to="/" className="mt-3 inline-block text-marigold hover:underline">Browse events to get started &rarr;</Link>
          </div>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap gap-2">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900">
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="paid">Paid</option>
                <option value="rejected">Rejected</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
            </div>

            {filteredApps.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-white/60 py-10 text-center">
                <p className="text-gray-500">No applications match this filter.</p>
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                {filteredApps.map((app) => (
                  <div key={app.id} className="rounded-xl border border-gray-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-gray-900">{app.business_name}</p>
                        <Link to={`/events/${app.event_id}`} className="text-sm text-gray-500 hover:text-marigold">{app.event_title}</Link>
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[app.status]}`}>
                        {app.status}
                      </span>
                    </div>
                    {app.description && <p className="mt-2 text-sm text-gray-600">{app.description}</p>}
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
            )}
          </>
        )}
      </div>
    </div>
  );
}
