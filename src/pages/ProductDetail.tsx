import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import type { Product } from '../lib/types';

interface Variant {
  id: string;
  size: string | null;
  color: string | null;
  price_adjustment: number;
  stock_quantity: number;
  sold_quantity: number;
  image_url: string | null;
}

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [fulfillment, setFulfillment] = useState<'pickup' | 'shipping'>('pickup');
  const [shipping, setShipping] = useState({ name: '', address_line1: '', city: '', state: '', postal_code: '' });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [{ data: productData }, { data: variantData }] = await Promise.all([
        supabase.from('products').select('*').eq('id', id).single(),
        supabase.from('product_variants').select('*').eq('product_id', id),
      ]);
      setProduct(productData);
      setVariants(variantData ?? []);
      if (productData) setFulfillment(productData.pickup_required ? 'pickup' : 'shipping');
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <p className="p-6 text-muted">Loading…</p>;
  if (!product) return <p className="p-6 text-muted">This product could not be found.</p>;

  const hasVariants = variants.length > 0;
  const selectedVariant = variants.find((v) => v.id === selectedVariantId) ?? null;
  const displayedImage = selectedVariant?.image_url || product.images?.[galleryIndex] || product.images?.[0] || null;
  const effectivePrice = product.price + (selectedVariant?.price_adjustment ?? 0);
  const available = hasVariants
    ? selectedVariant
      ? selectedVariant.stock_quantity - selectedVariant.sold_quantity
      : null
    : product.stock_quantity - product.sold_quantity;
  const canBuy = hasVariants ? !!selectedVariant && (available ?? 0) > 0 : (available ?? 0) > 0;

  async function handleCheckout() {
    if (!user) {
      setError('Please sign in first.');
      return;
    }
    if (hasVariants && !selectedVariant) {
      setError('Please choose an option first.');
      return;
    }
    setSubmitting(true);
    setError(null);

    const { data, error: checkoutError } = await supabase.functions.invoke('create-product-checkout', {
      body: {
        product_id: product!.id,
        variant_id: selectedVariant?.id ?? null,
        quantity,
        fulfillment_method: fulfillment,
        shipping_address: fulfillment === 'shipping' ? shipping : null,
        successUrl: `${window.location.origin}${window.location.pathname}?order=success`,
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

  // Group variants by whichever dimensions are actually used, so a
  // size-only or color-only product doesn't show an empty selector.
  const sizes = [...new Set(variants.map((v) => v.size).filter((s): s is string => !!s))];
  const colors = [...new Set(variants.map((v) => v.color).filter((c): c is string => !!c))];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <button onClick={() => navigate(-1)} className="text-sm text-marigold">&larr; Back</button>

      <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          {displayedImage ? (
            <img src={displayedImage} alt={product.name} className="aspect-square w-full rounded-2xl object-cover" />
          ) : (
            <div className="aspect-square w-full rounded-2xl bg-gray-100" />
          )}
          {product.images && product.images.length > 1 && !selectedVariant?.image_url && (
            <div className="mt-2 flex gap-2">
              {product.images.map((img, i) => (
                <button
                  key={img}
                  onClick={() => setGalleryIndex(i)}
                  className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 ${galleryIndex === i ? 'border-marigold' : 'border-transparent'}`}
                >
                  <img src={img} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">{product.name}</h1>
          <p className="mt-1 text-xl font-semibold text-marigold">${effectivePrice.toFixed(2)}</p>
          {product.description && <p className="mt-2 text-sm text-gray-500">{product.description}</p>}

          {hasVariants && sizes.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700">Size</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {sizes.map((size) => {
                  // If colors also exist, picking a size alone doesn't fully
                  // resolve a variant -- but we still highlight it and let
                  // the combined picker below do the final selection when
                  // both dimensions are present.
                  const matchingIfNoColor = variants.find((v) => v.size === size && !v.color);
                  const isSelected = selectedVariant?.size === size;
                  return (
                    <button
                      key={size}
                      onClick={() => matchingIfNoColor && setSelectedVariantId(matchingIfNoColor.id)}
                      className={`rounded-lg border px-3 py-1.5 text-sm ${isSelected ? 'border-marigold bg-marigold/10 text-marigold' : 'border-gray-300 text-gray-700'}`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {hasVariants && (sizes.length === 0 || colors.length > 0) && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700">{sizes.length > 0 ? 'Choose an option' : 'Color'}</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {variants.map((v) => {
                  const label = [v.size, v.color].filter(Boolean).join(' / ');
                  const stockLeft = v.stock_quantity - v.sold_quantity;
                  return (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariantId(v.id)}
                      disabled={stockLeft <= 0}
                      className={`rounded-lg border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40 ${
                        selectedVariantId === v.id ? 'border-marigold bg-marigold/10 text-marigold' : 'border-gray-300 text-gray-700'
                      }`}
                    >
                      {label} {stockLeft <= 0 && '(Sold out)'}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <p className="mt-3 text-sm text-gray-500">
            {available === null ? 'Choose an option to see availability' : available > 0 ? `${available} available` : 'Sold out'}
          </p>

          {canBuy && (
            <div className="mt-4 flex flex-col gap-3 rounded-xl bg-gray-50 p-4">
              <label className="flex items-center justify-between text-sm text-gray-700">
                Quantity
                <input
                  type="number"
                  min="1"
                  max={available ?? 1}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-16 rounded-lg border border-gray-300 px-2 py-1"
                />
              </label>
              {product.pickup_required && product.shipping_available && (
                <div className="flex gap-3 text-sm text-gray-700">
                  <label className="flex items-center gap-1"><input type="radio" checked={fulfillment === 'pickup'} onChange={() => setFulfillment('pickup')} /> Pickup</label>
                  <label className="flex items-center gap-1"><input type="radio" checked={fulfillment === 'shipping'} onChange={() => setFulfillment('shipping')} /> Ship (+${product.shipping_cost})</label>
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
              <button onClick={handleCheckout} disabled={submitting} className="rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-white hover:bg-marigold/90 disabled:opacity-50">
                {submitting ? 'Redirecting…' : 'Checkout'}
              </button>
            </div>
          )}
          {error && !canBuy && <p className="mt-2 text-xs text-magenta">{error}</p>}
        </div>
      </div>
    </div>
  );
}
