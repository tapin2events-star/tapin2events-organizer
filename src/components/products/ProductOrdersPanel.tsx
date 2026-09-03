import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { FULFILLMENT_STYLES, FULFILLMENT_LABELS, type FulfillmentStatus, type ProductOrder } from '../../lib/types';

interface ProductOrdersPanelProps {
  ownerType: 'event' | 'resource';
  ownerId: string;
}

export default function ProductOrdersPanel({ ownerType, ownerId }: ProductOrdersPanelProps) {
  const [orders, setOrders] = useState<ProductOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [trackingFormId, setTrackingFormId] = useState<string | null>(null);
  const [trackingCarrier, setTrackingCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');

  const ownerColumn = ownerType === 'event' ? 'event_id' : 'resource_id';

  async function load() {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq(ownerColumn, ownerId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Failed to load product orders:', error);
    } else {
      // This owner's orders table may also include ticket-type rows for
      // events; only product orders belong on this panel.
      setOrders((data ?? []).filter((o: any) => o.items?.some((i: any) => i.type === 'product')) as ProductOrder[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [ownerId]);

  async function notifyBuyer(order: ProductOrder, status: FulfillmentStatus) {
    const itemName = order.items[0]?.item_name ?? 'your order';
    let message = `Your order for ${itemName} was updated: ${FULFILLMENT_LABELS[status]}`;
    if (status === 'shipped' && order.tracking_number) {
      message += ` (tracking: ${order.tracking_number}${order.tracking_carrier ? ` via ${order.tracking_carrier}` : ''})`;
    }
    // Best-effort — the status update itself already succeeded regardless.
    // Never chain .select() here: the seller isn't the notification's
    // recipient, so RLS correctly won't let them read it back.
    supabase.from('notifications').insert({ user_email: order.customer_email, type: `order_${status}`, message, link: '/activity' }).then(() => {});
  }

  async function updateStatus(order: ProductOrder, status: FulfillmentStatus, extra?: { tracking_number?: string | null; tracking_carrier?: string | null }) {
    setBusyId(order.id);
    const payload: any = { fulfillment_status: status, ...extra };
    const { error } = await supabase.from('orders').update(payload).eq('id', order.id);
    setBusyId(null);
    if (!error) {
      const updated = { ...order, ...payload };
      setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)));
      notifyBuyer(updated, status);
    }
    setTrackingFormId(null);
    setTrackingCarrier('');
    setTrackingNumber('');
  }

  function handleStatusClick(order: ProductOrder, status: FulfillmentStatus) {
    if (status === 'shipped') {
      setTrackingFormId(order.id);
      setTrackingCarrier(order.tracking_carrier ?? '');
      setTrackingNumber(order.tracking_number ?? '');
      return;
    }
    updateStatus(order, status);
  }

  if (loading) return <p className="mt-4 text-sm text-gray-400">Loading…</p>;

  const revenue = orders.reduce((sum, o) => sum + o.total_amount, 0);

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-gray-900">Product Sales</h2>
        {orders.length > 0 && <p className="text-sm text-gray-500">{orders.length} order{orders.length === 1 ? '' : 's'} &middot; ${revenue.toFixed(2)}</p>}
      </div>

      {orders.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-white/60 py-10 text-center">
          <p className="text-gray-500">No product orders yet</p>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {orders.map((o) => {
            const isShippable = !!o.shipping_address;
            const nextOptions: FulfillmentStatus[] = isShippable
              ? ['pending', 'shipped', 'delivered']
              : ['pending', 'ready_for_pickup', 'picked_up'];
            return (
              <div key={o.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-900">
                      {o.items.map((i) => `${i.item_name} \u00d7 ${i.quantity}`).join(', ')}
                    </p>
                    <p className="text-sm text-gray-500">{o.customer_name || o.customer_email} &middot; ${o.total_amount.toFixed(2)}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${FULFILLMENT_STYLES[o.fulfillment_status] ?? FULFILLMENT_STYLES.pending}`}>
                    {FULFILLMENT_LABELS[o.fulfillment_status] ?? o.fulfillment_status}
                  </span>
                </div>

                {isShippable && o.shipping_address && (
                  <p className="mt-2 text-xs text-gray-400">
                    Ship to: {o.shipping_address.name}, {o.shipping_address.address_line1}, {o.shipping_address.city}, {o.shipping_address.state} {o.shipping_address.postal_code}
                  </p>
                )}
                {o.tracking_number && (
                  <p className="mt-1 text-xs text-gray-500">Tracking: {o.tracking_number}{o.tracking_carrier ? ` (${o.tracking_carrier})` : ''}</p>
                )}

                {trackingFormId === o.id ? (
                  <div className="mt-3 flex flex-col gap-2 rounded-lg bg-gray-50 p-3">
                    <div className="flex gap-2">
                      <input placeholder="Carrier (optional)" value={trackingCarrier} onChange={(e) => setTrackingCarrier(e.target.value)} className="w-1/2 rounded-lg border border-gray-300 px-2 py-1 text-sm" />
                      <input placeholder="Tracking number" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} className="w-1/2 rounded-lg border border-gray-300 px-2 py-1 text-sm" />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateStatus(o, 'shipped', { tracking_number: trackingNumber || null, tracking_carrier: trackingCarrier || null })}
                        disabled={busyId === o.id}
                        className="rounded-lg bg-marigold px-3 py-1.5 text-xs font-semibold text-ink hover:bg-marigold/90 disabled:opacity-50"
                      >
                        Confirm shipped
                      </button>
                      <button onClick={() => setTrackingFormId(null)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {nextOptions.map((status) => (
                      <button
                        key={status}
                        onClick={() => handleStatusClick(o, status)}
                        disabled={busyId === o.id || o.fulfillment_status === status}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-40 ${
                          o.fulfillment_status === status ? 'border-marigold bg-marigold/10 text-marigold' : 'border-gray-300 text-gray-700 hover:border-marigold hover:text-marigold'
                        }`}
                      >
                        {FULFILLMENT_LABELS[status]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
