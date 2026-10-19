import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import BackButton from '../components/BackButton';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import type { Product } from '../lib/types';
import { DetailSkeleton } from '../components/ui/Skeleton';
import { money, productFees } from '../lib/productMoney';

interface Variant { id: string; size: string | null; color: string | null; price_adjustment: number; stock_quantity: number; sold_quantity: number; image_url: string | null }
type ProductRow = Product & { pickup_details?: string | null };
const MAX_QTY = 20;
const emptyAddress = { name: '', address_line1: '', address_line2: '', city: '', state: '', postal_code: '' };

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const location = useLocation();
  const [product, setProduct] = useState<ProductRow | null>(null);
  const [seller, setSeller] = useState<{ name: string; to: string } | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [size, setSize] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [fulfillment, setFulfillment] = useState<'pickup' | 'shipping'>('pickup');
  const [address, setAddress] = useState(emptyAddress);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ordered = new URLSearchParams(location.search).get('order') === 'success';

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [{ data: p }, { data: vs }] = await Promise.all([
        supabase.from('products').select('*').eq('id', id).maybeSingle(),
        supabase.from('product_variants').select('*').eq('product_id', id),
      ]);
      const row = (p ?? null) as ProductRow | null;
      setProduct(row);
      setVariants((vs ?? []) as Variant[]);
      if (row) {
        setFulfillment(row.pickup_required ? 'pickup' : 'shipping');
        if (row.resource_id) {
          const { data: r } = await supabase.from('resources').select('id, display_name').eq('id', row.resource_id).maybeSingle();
          if (r) setSeller({ name: r.display_name, to: `/resources/${r.id}` });
        } else if (row.event_id) {
          const { data: e } = await supabase.from('events').select('id, title').eq('id', row.event_id).maybeSingle();
          if (e) setSeller({ name: e.title, to: `/events/${e.id}` });
        }
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <DetailSkeleton label="Loading product" />;
  if (!product) return <div className="mx-auto max-w-2xl px-4 py-8"><BackButton fallback="/products" fallbackLabel="Shop" /><p className="mt-6 text-muted">This product isn't available right now.</p></div>;

  const hasVariants = variants.length > 0;
  const sizes = [...new Set(variants.map((v) => v.size).filter((s): s is string => !!s))];
  const colors = [...new Set(variants.map((v) => v.color).filter((c): c is string => !!c))];
  const twoStep = sizes.length > 0 && colors.length > 0; // pick a size, then a color
  const options = twoStep ? variants.filter((v) => v.size === size) : variants;
  const selectedVariant = variants.find((v) => v.id === selectedVariantId) ?? null;
  const left = (v: Variant) => Math.max(0, v.stock_quantity - v.sold_quantity);
  const displayedImage = selectedVariant?.image_url || product.images?.[galleryIndex] || product.images?.[0] || null;
  const unitPrice = Number(product.price) + Number(selectedVariant?.price_adjustment ?? 0);
  const available = hasVariants ? (selectedVariant ? left(selectedVariant) : null) : Math.max(0, product.stock_quantity - product.sold_quantity);
  const totalLeft = hasVariants ? variants.reduce((n, v) => n + left(v), 0) : available ?? 0;
  const maxQty = Math.min(MAX_QTY, available ?? 1);
  const qty = Math.min(Math.max(1, quantity), Math.max(1, maxQty));
  const shipping = fulfillment === 'shipping' ? Number(product.shipping_cost) || 0 : 0;
  const fees = productFees(unitPrice * qty, shipping);
  const canBuy = (available ?? 0) > 0;
  const minPrice = hasVariants ? Math.min(...variants.map((v) => Number(product.price) + Number(v.price_adjustment))) : unitPrice;
  const maxPrice = hasVariants ? Math.max(...variants.map((v) => Number(product.price) + Number(v.price_adjustment))) : unitPrice;

  async function handleCheckout() {
    if (hasVariants && !selectedVariant) return setError('Please choose an option first.');
    if (fulfillment === 'shipping') {
      if (!address.name.trim() || !address.address_line1.trim() || !address.city.trim()) return setError('Add your name, street address and city.');
      if (!/^[A-Za-z]{2}$/.test(address.state.trim())) return setError('Use the 2-letter state code (for example NC).');
      if (!/^\d{5}(-\d{4})?$/.test(address.postal_code.trim())) return setError('Enter a 5-digit ZIP code.');
    }
    setSubmitting(true); setError(null);
    const { data, error: fnErr } = await supabase.functions.invoke('create-product-checkout', {
      body: {
        product_id: product!.id, variant_id: selectedVariant?.id ?? null, quantity: qty, fulfillment_method: fulfillment,
        shipping_address: fulfillment === 'shipping' ? { ...address, state: address.state.trim().toUpperCase() } : null,
        successUrl: `${window.location.origin}${window.location.pathname}?order=success`, cancelUrl: window.location.href.split('?')[0],
      },
    });
    if (data?.url) { window.location.href = data.url; return; }
    let msg: string | null = data?.error ?? null;
    if (!msg && fnErr) { try { msg = (await (fnErr as { context?: Response }).context?.json())?.error ?? null; } catch { /* no details */ } }
    setSubmitting(false);
    setError(msg || 'Something went wrong starting checkout. Please try again.');
  }

  const chip = (on: boolean, disabled = false) => `rounded-lg border px-3 py-2 text-sm ${disabled ? 'cursor-not-allowed opacity-40' : ''} ${on ? 'border-marigold bg-marigold/10 font-semibold text-marigold' : 'border-gray-300 text-gray-700'}`;
  const field = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 sm:text-sm';

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <BackButton fallback="/products" fallbackLabel="Shop" />
      {ordered && (
        <div role="status" className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          <p className="font-semibold">🎉 Order placed! Thank you.</p>
          <p className="mt-1">Your receipt is on its way to your email. Track your order anytime in <Link to="/products?tab=orders" className="font-semibold underline">My Orders</Link>.</p>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          {displayedImage ? <img src={displayedImage} alt={product.name} className="aspect-square w-full rounded-2xl object-cover" /> : <div className="flex aspect-square w-full items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-teal-100 font-display text-5xl font-extrabold text-indigo-300">{product.name.charAt(0)}</div>}
          {product.images && product.images.length > 1 && !selectedVariant?.image_url && (
            <div className="mt-2 flex gap-2 overflow-x-auto">
              {product.images.map((img, i) => (
                <button key={img} onClick={() => setGalleryIndex(i)} aria-label={`Photo ${i + 1}`} className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 ${galleryIndex === i ? 'border-marigold' : 'border-transparent'}`}><img src={img} alt="" className="h-full w-full object-cover" /></button>
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold text-gray-900 [overflow-wrap:anywhere]">{product.name}</h1>
          {seller && <p className="mt-0.5 text-sm text-gray-500">Sold by <Link to={seller.to} className="font-medium text-marigold">{seller.name}</Link></p>}
          <p className="mt-2 text-xl font-semibold text-gray-900">{hasVariants && !selectedVariant ? (minPrice === maxPrice ? money(minPrice) : `${money(minPrice)} – ${money(maxPrice)}`) : money(unitPrice)}</p>
          {product.description && <p className="mt-2 whitespace-pre-line text-sm text-gray-600 [overflow-wrap:anywhere]">{product.description}</p>}

          {hasVariants && twoStep && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700">Size</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {sizes.map((s) => {
                  const soldOut = variants.filter((v) => v.size === s).every((v) => left(v) === 0);
                  return <button key={s} type="button" disabled={soldOut} onClick={() => { setSize(s); setSelectedVariantId(null); }} className={chip(size === s, soldOut)}>{s}{soldOut ? ' (sold out)' : ''}</button>;
                })}
              </div>
            </div>
          )}
          {hasVariants && (!twoStep || size) && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700">{twoStep ? 'Color' : sizes.length ? 'Size' : 'Color'}</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {options.map((v) => {
                  const label = twoStep ? v.color : [v.size, v.color].filter(Boolean).join(' / ');
                  const soldOut = left(v) === 0;
                  const adj = Number(v.price_adjustment);
                  return <button key={v.id} type="button" disabled={soldOut} onClick={() => { setSelectedVariantId(v.id); setQuantity(1); }} className={chip(selectedVariantId === v.id, soldOut)}>{label}{adj ? ` (${adj > 0 ? '+' : '−'}${money(Math.abs(adj))})` : ''}{soldOut ? ' (sold out)' : ''}</button>;
                })}
              </div>
            </div>
          )}

          <p className="mt-3 text-sm text-gray-500">
            {totalLeft === 0 ? 'Sold out' : available === null ? (twoStep && !size ? 'Choose a size' : 'Choose an option') : `${available} left`}
          </p>

          {product.pickup_required && product.pickup_details && <p className="mt-2 text-sm text-gray-600">📍 <strong>Pickup:</strong> {product.pickup_details}</p>}
          {product.shipping_available && <p className="mt-1 text-sm text-gray-600">📦 <strong>Shipping:</strong> {Number(product.shipping_cost) > 0 ? `${money(Number(product.shipping_cost))} per order` : 'Free'} (U.S. only)</p>}

          {canBuy && (
            <div className="mt-4 flex flex-col gap-3 rounded-xl bg-gray-50 p-4">
              <div className="flex items-center justify-between text-sm text-gray-700">
                <span>Quantity</span>
                <span className="flex items-center gap-2">
                  <button type="button" onClick={() => setQuantity(Math.max(1, qty - 1))} disabled={qty <= 1} aria-label="Fewer" className="h-8 w-8 rounded-lg border border-gray-300 bg-white disabled:opacity-40">−</button>
                  <span className="w-6 text-center font-semibold">{qty}</span>
                  <button type="button" onClick={() => setQuantity(Math.min(maxQty, qty + 1))} disabled={qty >= maxQty} aria-label="More" className="h-8 w-8 rounded-lg border border-gray-300 bg-white disabled:opacity-40">+</button>
                </span>
              </div>
              {product.pickup_required && product.shipping_available && (
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="How you'll get it">
                  <button type="button" role="radio" aria-checked={fulfillment === 'pickup'} onClick={() => setFulfillment('pickup')} className={chip(fulfillment === 'pickup')}>Pickup · free</button>
                  <button type="button" role="radio" aria-checked={fulfillment === 'shipping'} onClick={() => setFulfillment('shipping')} className={chip(fulfillment === 'shipping')}>Ship · {Number(product.shipping_cost) > 0 ? money(Number(product.shipping_cost)) : 'free'}</button>
                </div>
              )}
              {fulfillment === 'shipping' && (
                <div className="flex flex-col gap-1.5">
                  <input placeholder="Full name" autoComplete="name" value={address.name} onChange={(e) => setAddress({ ...address, name: e.target.value })} className={field} />
                  <input placeholder="Street address" autoComplete="address-line1" value={address.address_line1} onChange={(e) => setAddress({ ...address, address_line1: e.target.value })} className={field} />
                  <input placeholder="Apt, suite, unit (optional)" autoComplete="address-line2" value={address.address_line2} onChange={(e) => setAddress({ ...address, address_line2: e.target.value })} className={field} />
                  <div className="grid grid-cols-6 gap-1.5">
                    <input placeholder="City" autoComplete="address-level2" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} className={`${field} col-span-3`} />
                    <input placeholder="State" autoComplete="address-level1" maxLength={2} value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value.toUpperCase() })} className={`${field} col-span-1 px-2`} />
                    <input placeholder="ZIP" autoComplete="postal-code" inputMode="numeric" maxLength={10} value={address.postal_code} onChange={(e) => setAddress({ ...address, postal_code: e.target.value })} className={`${field} col-span-2`} />
                  </div>
                </div>
              )}
              {(!hasVariants || selectedVariant) && (
                <div className="rounded-lg bg-white p-3 text-sm">
                  <div className="flex justify-between text-gray-600"><span>{qty} × {money(unitPrice)}</span><span>{money(unitPrice * qty)}</span></div>
                  {shipping > 0 && <div className="flex justify-between text-gray-600"><span>Shipping</span><span>{money(shipping)}</span></div>}
                  <div className="flex justify-between text-gray-600"><span>Service fee</span><span>{money(fees.service)}</span></div>
                  <div className="flex justify-between text-gray-600"><span>Processing fee</span><span>{money(fees.processing)}</span></div>
                  <div className="mt-1 flex justify-between border-t border-gray-100 pt-1 font-bold text-gray-900"><span>Total</span><span>{money(fees.total)}</span></div>
                </div>
              )}
              {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
              {user ? (
                <button onClick={handleCheckout} disabled={submitting || (hasVariants && !selectedVariant)} className="rounded-lg bg-marigold px-4 py-3 text-sm font-semibold text-white hover:bg-marigold/90 disabled:opacity-50">
                  {submitting ? 'Opening checkout…' : hasVariants && !selectedVariant ? 'Choose an option' : `Buy · ${money(fees.total)}`}
                </button>
              ) : (
                <Link to="/login" state={{ from: location.pathname }} className="rounded-lg bg-marigold px-4 py-3 text-center text-sm font-semibold text-white">Sign in to buy</Link>
              )}
              <p className="text-xs text-gray-500">Service and processing fees are non-refundable. For returns or exchanges, contact the seller. <Link to="/refund-policy" className="underline">Refund policy</Link></p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
