import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { FULFILLMENT_STYLES, FULFILLMENT_LABELS, type ProductOrder } from '../../lib/types';

export default function MyProductOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<ProductOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.email) return;
    supabase
      .from('orders')
      .select('*')
      .eq('customer_email', user.email)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error('Failed to load product orders:', error);
        } else {
          setOrders((data ?? []).filter((o: any) => o.items?.some((i: any) => i.type === 'product')) as ProductOrder[]);
        }
        setLoading(false);
      });
  }, [user?.email]);

  if (loading || orders.length === 0) return null;

  return (
    <div className="mt-10">
      <h2 className="font-display text-xl font-bold text-gray-900">My Purchases</h2>
      <p className="mt-1 text-sm text-gray-500">Products you've bought and their delivery status.</p>
      <div className="mt-4 flex flex-col gap-3">
        {orders.map((o) => {
          const isShippable = !!o.shipping_address;
          return (
            <div key={o.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-gray-900">
                    {o.items.map((i) => `${i.item_name} \u00d7 ${i.quantity}`).join(', ')}
                  </p>
                  <p className="text-sm text-gray-500">${o.total_amount.toFixed(2)} &middot; {new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${FULFILLMENT_STYLES[o.fulfillment_status] ?? FULFILLMENT_STYLES.pending}`}>
                  {FULFILLMENT_LABELS[o.fulfillment_status] ?? o.fulfillment_status}
                </span>
              </div>
              {isShippable && o.shipping_address && (
                <p className="mt-2 text-xs text-gray-400">Shipping to: {o.shipping_address.address_line1}, {o.shipping_address.city}, {o.shipping_address.state} {o.shipping_address.postal_code}</p>
              )}
              {o.tracking_number && (
                <p className="mt-1 text-xs font-medium text-gray-600">Tracking: {o.tracking_number}{o.tracking_carrier ? ` via ${o.tracking_carrier}` : ''}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
