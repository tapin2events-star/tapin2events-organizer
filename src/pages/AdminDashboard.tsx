import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const TABS = ['Overview', 'Events', 'Resources', 'Products', 'Users', 'Orders'] as const;
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
  const [products, setProducts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});

  async function loadAll() {
    setLoading(true);
    const [eventsRes, resourcesRes, productsRes, usersRes, ordersRes] = await Promise.all([
      supabase.from('events').select('id, title, description, organizer_email, status, event_type, start_date').order('created_at', { ascending: false }),
      supabase.from('resources').select('id, display_name, bio, email, verification_status, status, created_at').order('created_at', { ascending: false }),
      supabase.from('products').select('id, name, description, price, seller_email, is_active').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, email, full_name, is_organizer, is_resource, is_admin, is_banned, created_at').order('created_at', { ascending: false }),
      supabase.from('orders').select('id, order_number, customer_email, items, total_amount, payment_status, created_at').order('created_at', { ascending: false }),
    ]);

    const eventRows = eventsRes.data ?? [];
    const resourceRows = resourcesRes.data ?? [];
    const productRows = productsRes.data ?? [];
    const userRows = usersRes.data ?? [];
    const orderRows = ordersRes.data ?? [];

    setEvents(eventRows);
    setResources(resourceRows);
    setProducts(productRows);
    setUsers(userRows);
    setOrders(orderRows);
    setStats({
      events: eventRows.length,
      resources: resourceRows.length,
      users: userRows.length,
      orders: orderRows.length,
      revenue: orderRows.reduce((sum, o) => sum + (o.total_amount || 0), 0),
    });
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  function startEdit(id: string, initial: Record<string, string>) {
    setEditingId(id);
    setEditForm(initial);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({});
  }

  async function updateResourceStatus(id: string, verification_status: string) {
    setBusyId(id);
    const { error } = await supabase.from('resources').update({ verification_status }).eq('id', id);
    setBusyId(null);
    if (!error) setResources((prev) => prev.map((r) => (r.id === id ? { ...r, verification_status } : r)));
  }

  async function toggleResourceActive(r: any) {
    setBusyId(r.id);
    const status = r.status === 'active' ? 'inactive' : 'active';
    const { error } = await supabase.from('resources').update({ status }).eq('id', r.id);
    setBusyId(null);
    if (!error) setResources((prev) => prev.map((x) => (x.id === r.id ? { ...x, status } : x)));
  }

  async function saveResourceEdit(id: string) {
    setBusyId(id);
    const { error } = await supabase.from('resources').update({ display_name: editForm.display_name, bio: editForm.bio }).eq('id', id);
    setBusyId(null);
    if (!error) {
      setResources((prev) => prev.map((r) => (r.id === id ? { ...r, display_name: editForm.display_name, bio: editForm.bio } : r)));
      cancelEdit();
    }
  }

  async function toggleEventPublished(e: any) {
    setBusyId(e.id);
    const status = e.status === 'published' ? 'draft' : 'published';
    const { error } = await supabase.from('events').update({ status }).eq('id', e.id);
    setBusyId(null);
    if (!error) setEvents((prev) => prev.map((x) => (x.id === e.id ? { ...x, status } : x)));
  }

  async function saveProductEdit(id: string) {
    setBusyId(id);
    const { error } = await supabase
      .from('products')
      .update({ name: editForm.name, description: editForm.description, price: parseFloat(editForm.price) || 0 })
      .eq('id', id);
    setBusyId(null);
    if (!error) {
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, name: editForm.name, description: editForm.description, price: parseFloat(editForm.price) || 0 } : p)));
      cancelEdit();
    }
  }

  async function deleteProduct(id: string) {
    if (!window.confirm('Permanently delete this product? This cannot be undone.')) return;
    setBusyId(id);
    const { error } = await supabase.from('products').delete().eq('id', id);
    setBusyId(null);
    if (!error) setProducts((prev) => prev.filter((p) => p.id !== id));
  }

  async function updateUser(id: string, updates: Record<string, boolean>) {
    setBusyId(id);
    const { error } = await supabase.from('profiles').update(updates).eq('id', id);
    setBusyId(null);
    if (!error) setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...updates } : u)));
  }

  async function saveUserEdit(id: string) {
    setBusyId(id);
    const { error } = await supabase.from('profiles').update({ full_name: editForm.full_name }).eq('id', id);
    setBusyId(null);
    if (!error) {
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, full_name: editForm.full_name } : u)));
      cancelEdit();
    }
  }

  if (loading) return <p className="text-muted">Loading…</p>;

  const pendingResources = resources.filter((r) => r.verification_status === 'pending');
  const fieldClass = 'rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm text-ink';

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
            <div key={e.id} className="rounded-xl border border-gray-200 bg-surface2 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Link to={`/events/${e.id}`} className="font-medium text-bone hover:text-marigold">{e.title}</Link>
                  <p className="text-xs text-muted">{e.organizer_email} &middot; {e.event_type}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${e.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {e.status}
                  </span>
                  <Link to={`/organizer/events/${e.id}/edit`} className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-bone hover:border-marigold hover:text-marigold">
                    Edit
                  </Link>
                  <button
                    onClick={() => toggleEventPublished(e)}
                    disabled={busyId === e.id}
                    className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-bone hover:border-magenta hover:text-magenta disabled:opacity-50"
                  >
                    {e.status === 'published' ? 'Unpublish' : 'Publish'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'Resources' && (
        <div className="mt-6 flex flex-col gap-2">
          {resources.map((r) => (
            <div key={r.id} className="rounded-xl border border-gray-200 bg-surface2 p-3">
              {editingId === r.id ? (
                <div className="flex flex-col gap-2">
                  <input className={fieldClass} value={editForm.display_name} onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })} />
                  <textarea className={fieldClass} rows={2} value={editForm.bio} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} />
                  <div className="flex gap-2">
                    <button onClick={() => saveResourceEdit(r.id)} disabled={busyId === r.id} className="rounded-lg bg-marigold px-3 py-1 text-xs font-semibold text-ink">Save</button>
                    <button onClick={cancelEdit} className="rounded-lg border border-gray-300 px-3 py-1 text-xs text-bone">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Link to={`/resources/${r.id}`} className="font-medium text-bone hover:text-marigold">{r.display_name}</Link>
                    <p className="text-xs text-muted">{r.email}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      r.verification_status === 'verified' ? 'bg-green-100 text-green-800' : r.verification_status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'
                    }`}>
                      {r.verification_status}
                    </span>
                    {r.status === 'inactive' && (
                      <span className="rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-medium text-gray-700">inactive</span>
                    )}
                    {r.verification_status === 'pending' && (
                      <>
                        <button onClick={() => updateResourceStatus(r.id, 'verified')} disabled={busyId === r.id} className="rounded-lg bg-green-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">Approve</button>
                        <button onClick={() => updateResourceStatus(r.id, 'rejected')} disabled={busyId === r.id} className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-bone hover:border-magenta hover:text-magenta disabled:opacity-50">Reject</button>
                      </>
                    )}
                    <button onClick={() => startEdit(r.id, { display_name: r.display_name, bio: r.bio ?? '' })} className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-bone hover:border-marigold hover:text-marigold">Edit</button>
                    <button onClick={() => toggleResourceActive(r)} disabled={busyId === r.id} className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-bone hover:border-magenta hover:text-magenta disabled:opacity-50">
                      {r.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'Products' && (
        <div className="mt-6 flex flex-col gap-2">
          {products.map((p) => (
            <div key={p.id} className="rounded-xl border border-gray-200 bg-surface2 p-3">
              {editingId === p.id ? (
                <div className="flex flex-col gap-2">
                  <input className={fieldClass} value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                  <textarea className={fieldClass} rows={2} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                  <input className={fieldClass} type="number" step="0.01" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} />
                  <div className="flex gap-2">
                    <button onClick={() => saveProductEdit(p.id)} disabled={busyId === p.id} className="rounded-lg bg-marigold px-3 py-1 text-xs font-semibold text-ink">Save</button>
                    <button onClick={cancelEdit} className="rounded-lg border border-gray-300 px-3 py-1 text-xs text-bone">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-bone">{p.name}</p>
                    <p className="text-xs text-muted">{p.seller_email} &middot; ${p.price}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!p.is_active && <span className="rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-medium text-gray-700">inactive</span>}
                    <button onClick={() => startEdit(p.id, { name: p.name, description: p.description ?? '', price: String(p.price) })} className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-bone hover:border-marigold hover:text-marigold">Edit</button>
                    <button onClick={() => deleteProduct(p.id)} disabled={busyId === p.id} className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-magenta hover:bg-red-50 disabled:opacity-50">Delete</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'Users' && (
        <div className="mt-6 flex flex-col gap-2">
          {users.map((u) => (
            <div key={u.id} className="rounded-xl border border-gray-200 bg-surface2 p-3">
              {editingId === u.id ? (
                <div className="flex flex-col gap-2">
                  <input className={fieldClass} value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} placeholder="Full name" />
                  <div className="flex gap-2">
                    <button onClick={() => saveUserEdit(u.id)} disabled={busyId === u.id} className="rounded-lg bg-marigold px-3 py-1 text-xs font-semibold text-ink">Save</button>
                    <button onClick={cancelEdit} className="rounded-lg border border-gray-300 px-3 py-1 text-xs text-bone">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-bone">{u.full_name || u.email}</p>
                    <p className="text-xs text-muted">
                      {u.email}
                      {u.is_organizer && ' \u00b7 Organizer'}
                      {u.is_resource && ' \u00b7 Resource'}
                      {u.is_admin && ' \u00b7 Admin'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {u.is_banned && <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">Banned</span>}
                    <button onClick={() => startEdit(u.id, { full_name: u.full_name ?? '' })} className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-bone hover:border-marigold hover:text-marigold">Edit</button>
                    <button onClick={() => updateUser(u.id, { is_banned: !u.is_banned })} disabled={busyId === u.id} className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-bone hover:border-magenta hover:text-magenta disabled:opacity-50">
                      {u.is_banned ? 'Unban' : 'Ban'}
                    </button>
                    <button onClick={() => updateUser(u.id, { is_admin: !u.is_admin })} disabled={busyId === u.id} className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-bone hover:border-marigold hover:text-marigold disabled:opacity-50">
                      {u.is_admin ? 'Revoke admin' : 'Make admin'}
                    </button>
                  </div>
                </div>
              )}
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
