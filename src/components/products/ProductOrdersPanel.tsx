import { useEffect, useState } from 'react';
import { ListSkeleton } from '../ui/Skeleton';
import { supabase } from '../../lib/supabaseClient';
import { FULFILLMENT_STYLES, FULFILLMENT_LABELS, type FulfillmentStatus, type ProductOrder } from '../../lib/types';
import { money } from '../../lib/productMoney';

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
  // Ready for pickup: tell the buyer where and when.
  const [pickupFormId, setPickupFormId] = useState<string | null>(null);
  const [pickupNote, setPickupNote] = useState('');

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

  async function updateStatus(order: ProductOrder, status: FulfillmentStatus, extra?: { tracking_number?: string | null; tracking_carrier?: string | null; pickup_instructions?: string | null }) {
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
    setPickupFormId(null);
  }

  function handleStatusClick(order: ProductOrder, status: FulfillmentStatus) {
    if (status === 'ready_for_pickup') {
      setPickupFormId(order.id);
      setPickupNote((order as ProductOrder & { pickup_instructions?: string | null }).pickup_instructions ?? '');
      return;
    }
    if (status === 'shipped') {
      setTrackingFormId(order.id);
      setTrackingCarrier(order.tracking_carrier ?? '');
      setTrackingNumber(order.tracking_number ?? '');
      return;
    }
    updateStatus(order, status);
  }

  if (loading) return <ListSkeleton rows={4} className="mt-4" />;

  // What the seller earns: items + shipping (buyer fees go to TapIN and aren't the seller's sales).
  const earned = (o: ProductOrder) => Number((o as ProductOrder & { subtotal?: number }).subtotal ?? o.total_amount) || 0;
  const revenue = orders.reduce((sum, o) => sum + earned(o), 0);

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-gray-900">Product orders</h2>
        {orders.length > 0 && <p className="text-sm text-gray-500">{orders.length} order{orders.length === 1 ? '' : 's'} &middot; {money(revenue)} in sales</p>}
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
                    <p className="text-sm text-gray-500">{o.customer_name || o.customer_email} &middot; You earn {money(earned(o))}</p>
                    <p className="text-xs text-gray-400">{o.order_number ? `${o.order_number} · ` : ''}{new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${FULFILLMENT_STYLES[o.fulfillment_status] ?? FULFILLMENT_STYLES.pending}`}>
                    {FULFILLMENT_LABELS[o.fulfillment_status] ?? o.fulfillment_status}
                  </span>
                </div>

                {isShippable && o.shipping_address && (
                  <p className="mt-2 text-xs text-gray-400">
                    Ship to: {[o.shipping_address.name, o.shipping_address.address_line1, (o.shipping_address as { address_line2?: string }).address_line2, o.shipping_address.city].filter(Boolean).join(', ')}, {o.shipping_address.state} {o.shipping_address.postal_code}
                  </p>
                )}
                {o.tracking_number && (
                  <p className="mt-1 text-xs text-gray-500">Tracking: {o.tracking_number}{o.tracking_carrier ? ` (${o.tracking_carrier})` : ''}</p>
                )}

                {pickupFormId === o.id ? (
                  <div className="mt-3 flex flex-col gap-2 rounded-lg bg-gray-50 p-3">
                    <label className="text-xs font-medium text-gray-600">Pickup details for the buyer (where and when)
                      <input value={pickupNote} maxLength={500} onChange={(e) => setPickupNote(e.target.value)} placeholder="At the merch table, 6–10 PM on event night" className="mt-1 block w-full rounded-lg border border-gray-300 px-2 py-1.5 text-base sm:text-sm" />
                    </label>
                    <div className="flex gap-2">
                      <button onClick={() => updateStatus(o, 'ready_for_pickup', { pickup_instructions: pickupNote.trim() || null })} disabled={busyId === o.id} className="rounded-lg bg-marigold px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Mark ready &amp; notify buyer</button>
                      <button onClick={() => setPickupFormId(null)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700">Cancel</button>
                    </div>
                  </div>
                ) : trackingFormId === o.id ? (
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
                        Mark shipped &amp; notify buyer
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
