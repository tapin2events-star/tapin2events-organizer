import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { FULFILLMENT_STYLES, FULFILLMENT_LABELS, type ProductOrder } from '../../lib/types';
import { trackingUrl } from '../../lib/tracking';

const tidy = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim();

// A buyer's merchandise orders with delivery status. Shown on My Activity
// (emails link to /activity#orders) and on the Shop page's My Orders tab.
export default function MyProductOrders({ title = 'My Orders' }: { title?: string }) {
  const { user } = useAuth();
  const location = useLocation();
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
        if (error) console.error('Failed to load product orders:', error);
        else setOrders((data ?? []).filter((o: any) => o.items?.some((i: any) => i.type === 'product')) as ProductOrder[]);
        setLoading(false);
      });
  }, [user?.email]);

  // Emails link to #orders; scroll there once the orders have loaded.
  useEffect(() => {
    if (!loading && location.hash === '#orders') document.getElementById('orders')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [loading, location.hash]);

  if (loading || orders.length === 0) return null;

  return (
    <div id="orders" className="mt-10 scroll-mt-20">
      <h2 className="font-display text-xl font-bold text-gray-900">{title}</h2>
      <p className="mt-1 text-sm text-gray-500">Merchandise you've bought and where it is.</p>
      <div className="mt-4 flex flex-col gap-3">
        {orders.map((o) => {
          const product = o.items.find((i) => (i as { type?: string }).type === 'product') as (typeof o.items)[number] & { item_id?: string; image_url?: string };
          const track = trackingUrl(o.tracking_carrier, o.tracking_number);
          const a = o.shipping_address;
          return (
            <div key={o.id} className="flex gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              {product?.image_url ? (
                <img src={product.image_url} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="h-16 w-16 shrink-0 rounded-lg bg-gradient-to-br from-indigo-100 to-teal-100" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">
                      {product?.item_id ? (
                        <Link to={`/products/${product.item_id}`} className="hover:text-marigold">{tidy(product.item_name)}</Link>
                      ) : tidy(product?.item_name)}
                      {product && product.quantity > 1 && <span className="text-gray-500"> × {product.quantity}</span>}
                    </p>
                    <p className="text-sm text-gray-500">
                      ${Number(o.total_amount).toFixed(2)} · {new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {o.order_number && <span className="text-gray-400"> · {o.order_number}</span>}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${FULFILLMENT_STYLES[o.fulfillment_status] ?? FULFILLMENT_STYLES.pending}`}>
                    {FULFILLMENT_LABELS[o.fulfillment_status] ?? o.fulfillment_status}
                  </span>
                </div>
                {o.fulfillment_status === 'ready_for_pickup' && o.pickup_instructions && (
                  <p className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{tidy(o.pickup_instructions)}</p>
                )}
                {a && (
                  <p className="mt-2 text-xs text-gray-400">
                    Shipping to {[tidy(a.address_line1), [[tidy(a.city), tidy(a.state)].filter(Boolean).join(', '), tidy(a.postal_code)].filter(Boolean).join(' ')].filter(Boolean).join(', ')}
                  </p>
                )}
                {o.tracking_number && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                    <span className="font-medium">
                      {o.tracking_carrier ? `${tidy(o.tracking_carrier)} ` : ''}#{tidy(o.tracking_number)}
                    </span>
                    {track && (
                      <a href={track} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-gray-300 px-2.5 py-1 font-semibold text-marigold hover:border-marigold">
                        Track package ↗
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
