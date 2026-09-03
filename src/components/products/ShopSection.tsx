import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import type { Product } from '../../lib/types';

interface ShopSectionProps {
  ownerType: 'event' | 'resource';
  ownerId: string;
}

export default function ShopSection({ ownerType, ownerId }: ShopSectionProps) {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [fulfillment, setFulfillment] = useState<'pickup' | 'shipping'>('pickup');
  const [shipping, setShipping] = useState({ name: '', address_line1: '', city: '', state: '', postal_code: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ownerColumn = ownerType === 'event' ? 'event_id' : 'resource_id';

  useEffect(() => {
    supabase
      .from('products')
      .select('*')
      .eq(ownerColumn, ownerId)
      .then(({ data }) => setProducts((data ?? []) as Product[]));
  }, [ownerId]);

  if (products.length === 0) return null;

  function startBuy(p: Product) {
    setBuyingId(p.id);
    setQuantity(1);
    setFulfillment(p.pickup_required ? 'pickup' : 'shipping');
    setError(null);
  }

  async function handleCheckout(p: Product) {
    if (!user) {
      setError('Please sign in first.');
      return;
    }
    setSubmitting(true);
    setError(null);

    const { data, error: checkoutError } = await supabase.functions.invoke('create-product-checkout', {
      body: {
        product_id: p.id,
        quantity,
        fulfillment_method: fulfillment,
        shipping_address: fulfillment === 'shipping' ? shipping : null,
        successUrl: `${window.location.href}?order=success`,
        cancelUrl: window.location.href,
      },
    });

    setSubmitting(false);
    if (checkoutError || !data?.url) {
      setError(data?.error || 'Something went wrong starting checkout. Please try again.');
      return;
    }
    window.location.href = data.url;
  }

  return (
    <div className="mt-6 border-t border-gray-200 pt-6">
      <h2 className="font-display text-lg font-semibold text-gray-900">Shop</h2>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {products.map((p) => {
          const available = p.stock_quantity - p.sold_quantity;
          return (
            <div key={p.id} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
              <div className="flex gap-3">
                {p.images?.[0] ? (
                  <img src={p.images[0]} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="h-20 w-20 shrink-0 rounded-lg bg-gray-100" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900">{p.name}</p>
                  <p className="text-sm text-gray-500">${p.price}</p>
                  <p className="text-xs text-gray-400">{available > 0 ? `${available} available` : 'Sold out'}</p>
                </div>
              </div>

              {buyingId === p.id ? (
                <div className="mt-3 flex flex-col gap-2 rounded-lg bg-gray-50 p-3">
                  <label className="flex items-center justify-between text-sm text-gray-700">
                    Quantity
                    <input type="number" min="1" max={available} value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)} className="w-16 rounded-lg border border-gray-300 px-2 py-1" />
                  </label>
                  {p.pickup_required && p.shipping_available && (
                    <div className="flex gap-3 text-sm text-gray-700">
                      <label className="flex items-center gap-1"><input type="radio" checked={fulfillment === 'pickup'} onChange={() => setFulfillment('pickup')} /> Pickup</label>
                      <label className="flex items-center gap-1"><input type="radio" checked={fulfillment === 'shipping'} onChange={() => setFulfillment('shipping')} /> Ship (+${p.shipping_cost})</label>
                    </div>
                  )}
                  {fulfillment === 'shipping' && (
                    <div className="flex flex-col gap-1.5">
                      <input placeholder="Full name" value={shipping.name} onChange={(e) => setShipping({ ...shipping, name: e.target.value })} className="rounded-lg border border-gray-300 px-2 py-1 text-sm" />
                      <input placeholder="Address" value={shipping.address_line1} onChange={(e) => setShipping({ ...shipping, address_line1: e.target.value })} className="rounded-lg border border-gray-300 px-2 py-1 text-sm" />
                      <div className="flex gap-1.5">
                        <input placeholder="City" value={shipping.city} onChange={(e) => setShipping({ ...shipping, city: e.target.value })} className="w-1/2 rounded-lg border border-gray-300 px-2 py-1 text-sm" />
                        <input placeholder="State" value={shipping.state} onChange={(e) => setShipping({ ...shipping, state: e.target.value })} className="w-1/4 rounded-lg border border-gray-300 px-2 py-1 text-sm" />
                        <input placeholder="ZIP" value={shipping.postal_code} onChange={(e) => setShipping({ ...shipping, postal_code: e.target.value })} className="w-1/4 rounded-lg border border-gray-300 px-2 py-1 text-sm" />
                      </div>
                    </div>
                  )}
                  {error && <p className="text-xs text-magenta">{error}</p>}
                  <div className="flex gap-2">
                    <button onClick={() => handleCheckout(p)} disabled={submitting} className="rounded-lg bg-marigold px-3 py-1.5 text-xs font-semibold text-ink hover:bg-marigold/90 disabled:opacity-50">
                      {submitting ? 'Redirecting…' : 'Checkout'}
                    </button>
                    <button onClick={() => setBuyingId(null)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700">Cancel</button>
                  </div>
                </div>
              ) : (
                available > 0 && (
                  <button onClick={() => startBuy(p)} className="mt-3 w-full rounded-lg bg-marigold px-3 py-1.5 text-sm font-semibold text-ink hover:bg-marigold/90">
                    Buy now
                  </button>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
