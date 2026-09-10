import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const TABS = ['Overview', 'Events', 'Resources', 'Orders'] as const;
type Tab = (typeof TABS)[number];

interface StatCounts {
  events: number;
  resources: number;
  users: number;
  orders: number;
  revenue: number;
}

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [stats, setStats] = useState<StatCounts | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    const [eventsRes, resourcesRes, profilesRes, ordersRes] = await Promise.all([
      supabase.from('events').select('id, title, organizer_email, status, event_type, start_date').order('created_at', { ascending: false }),
      supabase.from('resources').select('id, display_name, email, verification_status, status, created_at').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('orders').select('id, order_number, customer_email, items, total_amount, payment_status, created_at').order('created_at', { ascending: false }),
    ]);

    const eventRows = eventsRes.data ?? [];
    const resourceRows = resourcesRes.data ?? [];
    const orderRows = ordersRes.data ?? [];

    setEvents(eventRows);
    setResources(resourceRows);
    setOrders(orderRows);
    setStats({
      events: eventRows.length,
      resources: resourceRows.length,
      users: profilesRes.count ?? 0,
      orders: orderRows.length,
      revenue: orderRows.reduce((sum, o) => sum + (o.total_amount || 0), 0),
    });
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function updateResourceStatus(id: string, verification_status: string) {
    setBusyId(id);
    const { error } = await supabase.from('resources').update({ verification_status }).eq('id', id);
    setBusyId(null);
    if (!error) {
      setResources((prev) => prev.map((r) => (r.id === id ? { ...r, verification_status } : r)));
    }
  }

  if (loading) return <p className="text-muted">Loading…</p>;

  const pendingResources = resources.filter((r) => r.verification_status === 'pending');

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold text-bone">Admin Dashboard</h1>
      <p className="text-sm text-muted">Platform-wide view across all events, resources, and orders.</p>

      <div className="mt-6 flex gap-1 border-b border-gray-300 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 px-4 py-2 text-sm font-medium transition ${
              tab === t ? 'border-b-2 border-marigold text-marigold' : 'text-muted hover:text-bone'
            }`}
          >
            {t}
            {t === 'Resources' && pendingResources.length > 0 && (
              <span className="ml-1.5 rounded-full bg-orange-100 px-1.5 py-0.5 text-xs font-semibold text-orange-800">
                {pendingResources.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'Overview' && stats && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatCard label="Events" value={stats.events} />
          <StatCard label="Resources" value={stats.resources} />
          <StatCard label="Users" value={stats.users} />
          <StatCard label="Orders" value={stats.orders} />
          <StatCard label="Revenue" value={`$${stats.revenue.toFixed(2)}`} />
        </div>
      )}

      {tab === 'Events' && (
        <div className="mt-6 flex flex-col gap-2">
          {events.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 bg-surface2 p-3">
              <div>
                <Link to={`/events/${e.id}`} className="font-medium text-bone hover:text-marigold">{e.title}</Link>
                <p className="text-xs text-muted">{e.organizer_email} &middot; {e.event_type}</p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${e.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                {e.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {tab === 'Resources' && (
        <div className="mt-6 flex flex-col gap-2">
          {resources.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 bg-surface2 p-3">
              <div>
                <Link to={`/resources/${r.id}`} className="font-medium text-bone hover:text-marigold">{r.display_name}</Link>
                <p className="text-xs text-muted">{r.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  r.verification_status === 'verified' ? 'bg-green-100 text-green-800' : r.verification_status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'
                }`}>
                  {r.verification_status}
                </span>
                {r.verification_status === 'pending' && (
                  <>
                    <button
                      onClick={() => updateResourceStatus(r.id, 'verified')}
                      disabled={busyId === r.id}
                      className="rounded-lg bg-green-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => updateResourceStatus(r.id, 'rejected')}
                      disabled={busyId === r.id}
                      className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-bone hover:border-magenta hover:text-magenta disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'Orders' && (
        <div className="mt-6 flex flex-col gap-2">
          {orders.map((o) => (
            <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 bg-surface2 p-3">
              <div>
                <p className="font-medium text-bone">{o.items?.map((i: any) => i.item_name).join(', ') || o.order_number}</p>
                <p className="text-xs text-muted">{o.customer_email} &middot; {new Date(o.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-bone">${o.total_amount?.toFixed(2)}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${o.payment_status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                  {o.payment_status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-surface2 p-4 text-center">
      <p className="font-display text-2xl font-extrabold text-marigold">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
