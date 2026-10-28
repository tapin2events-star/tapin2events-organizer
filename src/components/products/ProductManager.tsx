import { useEffect, useState } from 'react';
import { useFeature } from '../../lib/preview';
import PlacementPicker, { placeKey } from './PlacementPicker';
import { Link } from 'react-router-dom';
import { ListSkeleton } from '../ui/Skeleton';
import { supabase } from '../../lib/supabaseClient';
import { PRODUCT_CATEGORIES, type Product, type ProductCategory } from '../../lib/types';
import { money } from '../../lib/productMoney';
import MultiImageUpload from '../MultiImageUpload';
import ImageUpload from '../ImageUpload';

interface ProductManagerProps {
  ownerType: 'event' | 'resource';
  ownerId: string;
  sellerEmail: string;
  /** Groups: each member manages only the products they listed. */
  onlyMine?: boolean;
}

interface VariantRow {
  id: string | null; // null = not saved yet
  size: string;
  color: string;
  priceAdjustment: string;
  stockQuantity: string;
  soldQuantity: number;
  imageUrl: string | null;
}
type ProductRow = Product & { pickup_details?: string | null };

const emptyVariantRow = (): VariantRow => ({ id: null, size: '', color: '', priceAdjustment: '0', stockQuantity: '', soldQuantity: 0, imageUrl: null });
const emptyForm = { name: '', description: '', price: '', category: 'other' as ProductCategory, stockQuantity: '', pickupRequired: true, pickupDetails: '', shippingAvailable: false, shippingCost: '' };
const nice = (m?: string) => (m && !/function|permission|jwt|violates/i.test(m) ? m : null);

// Add, edit, hide and delete products for an event or an artist & services profile.
export default function ProductManager({ ownerType, ownerId, sellerEmail, onlyMine = false, autoCreate = false }: ProductManagerProps & { autoCreate?: boolean }) {
  const sellAnywhere = useFeature('sell_anywhere');
  const [placements, setPlacements] = useState<Set<string>>(new Set());
  // How many other places each product also appears in (Sell anywhere).
  const [alsoIn, setAlsoIn] = useState<Map<string, number>>(new Map());
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [variantStock, setVariantStock] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [payoutReady, setPayoutReady] = useState<boolean | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [removedVariantIds, setRemovedVariantIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ownerColumn = ownerType === 'event' ? 'event_id' : 'resource_id';

  async function load() {
    let query = supabase.from('products').select('*').eq(ownerColumn, ownerId);
    if (onlyMine) query = query.eq('seller_email', sellerEmail);
    const { data, error: loadError } = await query.order('created_at', { ascending: false });
    if (loadError) console.error('Failed to load products:', loadError);
    const rows = (data ?? []) as ProductRow[];
    setProducts(rows);
    if (sellAnywhere && rows.length) {
      supabase.from('product_placements').select('product_id').in('product_id', rows.map((r) => r.id)).then(({ data: pl }) => {
        const m = new Map<string, number>();
        for (const r of pl ?? []) m.set(r.product_id, (m.get(r.product_id) ?? 0) + 1);
        setAlsoIn(m);
      });
    }
    if (rows.length) {
      const { data: vs } = await supabase.from('product_variants').select('product_id, stock_quantity, sold_quantity').in('product_id', rows.map((p) => p.id));
      const totals = new Map<string, number>();
      (vs ?? []).forEach((v) => totals.set(v.product_id, (totals.get(v.product_id) ?? 0) + Math.max(0, v.stock_quantity - v.sold_quantity)));
      setVariantStock(totals);
    }
    setLoading(false);
  }
  useEffect(() => {
    load();
    supabase.rpc('product_payout_ready', { p_owner_type: ownerType, p_owner_id: ownerId }).then(({ data }) => setPayoutReady(data === true));
  }, [ownerId]); // eslint-disable-line react-hooks/exhaustive-deps

  function startCreate() {
    setForm(emptyForm); setImageUrls([]); setEditingId(null); setVariants([]); setRemovedVariantIds([]); setError(null); setPlacements(new Set()); setShowForm(true);
  }
  useEffect(() => { if (autoCreate) startCreate(); }, [autoCreate]); // eslint-disable-line react-hooks/exhaustive-deps
  async function startEdit(p: ProductRow) {
    setForm({
      name: p.name, description: p.description ?? '', price: Number(p.price).toFixed(2), category: p.category,
      stockQuantity: String(p.stock_quantity), pickupRequired: p.pickup_required, pickupDetails: p.pickup_details ?? '',
      shippingAvailable: p.shipping_available, shippingCost: p.shipping_available ? Number(p.shipping_cost).toFixed(2) : '',
    });
    setImageUrls(p.images ?? []); setEditingId(p.id); setRemovedVariantIds([]); setError(null);
    setPlacements(new Set());
    if (sellAnywhere) supabase.rpc('product_placements_for', { p_product_id: p.id }).then(({ data }) => setPlacements(new Set(((data ?? []) as { kind: string; id: string }[]).map(placeKey))));
    const { data: existing } = await supabase.from('product_variants').select('id, size, color, price_adjustment, stock_quantity, sold_quantity, image_url').eq('product_id', p.id);
    setVariants((existing ?? []).map((v) => ({ id: v.id, size: v.size ?? '', color: v.color ?? '', priceAdjustment: String(v.price_adjustment), stockQuantity: String(v.stock_quantity), soldQuantity: v.sold_quantity ?? 0, imageUrl: v.image_url ?? null })));
    setShowForm(true);
  }
  const updateVariantRow = (i: number, patch: Partial<VariantRow>) => setVariants((prev) => prev.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  function removeVariantRow(i: number) {
    setVariants((prev) => { const row = prev[i]; if (row.id) setRemovedVariantIds((ids) => [...ids, row.id!]); return prev.filter((_, j) => j !== i); });
  }

  const usedVariants = variants.filter((v) => v.size.trim() || v.color.trim());
  const hasVariants = usedVariants.length > 0;
  const basePrice = parseFloat(form.price);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const price = parseFloat(form.price);
    if (!form.name.trim()) return setError('Give your product a name.');
    if (!Number.isFinite(price) || price < 1) return setError('Set a price of at least $1.00.');
    if (!form.pickupRequired && !form.shippingAvailable) return setError('Choose how buyers get it: pickup, shipping, or both.');
    const shippingCost = form.shippingAvailable ? parseFloat(form.shippingCost || '0') : 0;
    if (form.shippingAvailable && (!Number.isFinite(shippingCost) || shippingCost < 0)) return setError('Enter a shipping cost (0 for free shipping).');
    const stock = parseInt(form.stockQuantity, 10);
    if (!hasVariants && (!Number.isInteger(stock) || stock < 0)) return setError('Enter how many you have to sell.');
    for (const v of usedVariants) {
      const adj = parseFloat(v.priceAdjustment || '0');
      if (!Number.isFinite(adj) || price + adj < 1) return setError(`"${[v.size, v.color].filter(Boolean).join(' / ')}" would cost less than $1.00. Adjust its price change.`);
      const s = parseInt(v.stockQuantity, 10);
      if (!Number.isInteger(s) || s < 0) return setError(`Enter how many you have of "${[v.size, v.color].filter(Boolean).join(' / ')}".`);
    }
    setSaving(true);
    const payload = {
      [ownerColumn]: ownerId,
      seller_email: sellerEmail,
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: Math.round(price * 100) / 100,
      images: imageUrls,
      category: form.category,
      stock_quantity: hasVariants ? usedVariants.reduce((n, v) => n + (parseInt(v.stockQuantity, 10) || 0), 0) : stock,
      pickup_required: form.pickupRequired,
      pickup_details: form.pickupRequired ? form.pickupDetails.trim() || null : null,
      shipping_available: form.shippingAvailable,
      shipping_cost: form.shippingAvailable ? Math.round(shippingCost * 100) / 100 : 0,
    };
    const { data: saved, error: saveError } = editingId
      ? await supabase.from('products').update(payload).eq('id', editingId).select().single()
      : await supabase.from('products').insert(payload).select().single();
    if (saveError || !saved) {
      setSaving(false);
      console.error('Failed to save product:', saveError);
      return setError(nice(saveError?.message) ?? "Couldn't save this product. Please try again.");
    }
    // Sizes / colors: update existing rows, add new ones, delete removed ones.
    let variantFailed = false;
    for (const v of usedVariants) {
      const vp = { product_id: saved.id, size: v.size.trim() || null, color: v.color.trim() || null, price_adjustment: Math.round((parseFloat(v.priceAdjustment || '0') || 0) * 100) / 100, stock_quantity: parseInt(v.stockQuantity, 10) || 0, image_url: v.imageUrl };
      const { error: ve } = v.id ? await supabase.from('product_variants').update(vp).eq('id', v.id) : await supabase.from('product_variants').insert(vp);
      if (ve) variantFailed = true;
    }
    if (removedVariantIds.length) {
      const { error: de } = await supabase.from('product_variants').delete().in('id', removedVariantIds);
      if (de) variantFailed = true;
    }
    window.dispatchEvent(new Event('tapin-products-changed'));
    setSaving(false);
    if (sellAnywhere) await supabase.rpc('set_product_placements', { p_product_id: saved.id, p_places: [...placements].map((k) => ({ kind: k.split(':')[0], id: k.split(':')[1] })) });
    if (variantFailed) { setEditingId(saved.id); load(); return setError('The product saved, but some sizes/colors didn\u2019t. Please check them and save again.'); }
    setShowForm(false);
    load();
  }

  async function toggleActive(p: ProductRow) {
    await supabase.from('products').update({ is_active: !p.is_active }).eq('id', p.id);
    window.dispatchEvent(new Event('tapin-products-changed'));
    setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_active: !x.is_active } : x)));
  }
  async function deleteProduct(p: ProductRow) {
    const sold = (p.sold_quantity ?? 0) > 0;
    if (!window.confirm(sold
      ? `Delete "${p.name}"? It has orders, which stay in your sales history, but buyers' links to the product will stop working. To stop selling it but keep it, use "Hide from shop" instead.`
      : `Delete "${p.name}"? This can't be undone.`)) return;
    const { error: de } = await supabase.from('products').delete().eq('id', p.id);
    if (de) return window.alert(nice(de.message) ?? "Couldn't delete it. Try hiding it from your shop instead.");
    window.dispatchEvent(new Event('tapin-products-changed'));
    setProducts((prev) => prev.filter((x) => x.id !== p.id));
  }

  const fieldClass = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 outline-none placeholder:text-gray-400 focus-visible:border-marigold sm:text-sm';
  const labelClass = 'flex flex-col gap-1 text-sm font-medium text-gray-700';

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-xl font-bold text-gray-900">Products</h2>
        <button onClick={startCreate} className="rounded-lg bg-marigold px-3 py-1.5 text-sm font-semibold text-white hover:bg-marigold/90">+ Add product</button>
      </div>

      {payoutReady === false && (
        <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Connect payouts to start selling.</strong> Buyers can't check out until your payout account is connected, so you get paid for every order. <Link to="/profile#payouts" className="font-semibold underline">Connect payouts</Link>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm" noValidate>
          <p className="font-semibold text-gray-900">{editingId ? 'Edit product' : 'New product'}</p>
          <MultiImageUpload urls={imageUrls} onChange={setImageUrls} pathPrefix={`products/${ownerType}`} label="Product photos" />
          <label className={labelClass}>Name
            <input required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Tour T-shirt" className={fieldClass} />
          </label>
          <label className={labelClass}>Description <span className="text-xs font-normal text-gray-400">(optional)</span>
            <textarea rows={3} maxLength={2000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Material, fit, what's included…" className={fieldClass} />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className={labelClass}>Price
              <span className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input required type="number" inputMode="decimal" min="1" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="25.00" className={`${fieldClass} w-full pl-7`} /></span>
            </label>
            <label className={labelClass}>Category
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ProductCategory })} className={fieldClass}>
                {PRODUCT_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>
            {!hasVariants ? (
              <label className={labelClass}>Quantity available
                <input type="number" inputMode="numeric" min="0" value={form.stockQuantity} onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })} placeholder="How many to sell" className={fieldClass} />
              </label>
            ) : (
              <div className="flex flex-col justify-end text-xs text-gray-500">Quantity is set for each size/color below.</div>
            )}
          </div>
          <p className="-mt-1 text-xs text-gray-500">You receive your full price (plus shipping). Buyers pay a service fee (3.7% + $1.79 per order) and a 2.9% processing fee on top.</p>

          <div className="rounded-lg border border-gray-200 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-gray-700">Sizes / colors <span className="font-normal text-gray-400">(optional)</span></p>
                <p className="text-xs text-gray-500">Add one row per size/color you sell. Each has its own quantity, and can cost more or less than the main price.</p>
              </div>
              <button type="button" onClick={() => setVariants((prev) => [...prev, emptyVariantRow()])} className="shrink-0 text-sm font-medium text-marigold">+ Add option</button>
            </div>
            {variants.length > 0 && (
              <div className="mt-3 flex flex-col gap-3">
                {variants.map((v, i) => {
                  const adj = parseFloat(v.priceAdjustment || '0') || 0;
                  return (
                    <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 p-2">
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <label className="text-xs text-gray-500">Size<input placeholder="Medium" value={v.size} onChange={(e) => updateVariantRow(i, { size: e.target.value })} className={`${fieldClass} mt-0.5 w-full`} /></label>
                        <label className="text-xs text-gray-500">Color<input placeholder="Blue" value={v.color} onChange={(e) => updateVariantRow(i, { color: e.target.value })} className={`${fieldClass} mt-0.5 w-full`} /></label>
                        <label className="text-xs text-gray-500">Price change ($)<input type="number" inputMode="decimal" step="0.01" placeholder="0" value={v.priceAdjustment} onChange={(e) => updateVariantRow(i, { priceAdjustment: e.target.value })} className={`${fieldClass} mt-0.5 w-full`} /></label>
                        <label className="text-xs text-gray-500">Quantity{v.soldQuantity > 0 ? ` (${v.soldQuantity} sold)` : ''}<input type="number" inputMode="numeric" min="0" placeholder="0" value={v.stockQuantity} onChange={(e) => updateVariantRow(i, { stockQuantity: e.target.value })} className={`${fieldClass} mt-0.5 w-full`} /></label>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="text-gray-600">{Number.isFinite(basePrice) ? <>Sells for <strong>{money(basePrice + adj)}</strong></> : 'Set the main price first'}</span>
                        <button type="button" onClick={() => removeVariantRow(i)} className="font-medium text-gray-500 hover:text-red-600">Remove</button>
                      </div>
                      <div className="mt-2">
                        <ImageUpload currentUrl={v.imageUrl} onUploaded={(url) => updateVariantRow(i, { imageUrl: url })} pathPrefix={`products/${ownerType}/variants`} label="Photo for this option (optional; otherwise the main photos are used)" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 p-3">
            <p className="text-sm font-medium text-gray-700">How buyers get it</p>
            <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.pickupRequired} onChange={(e) => setForm({ ...form, pickupRequired: e.target.checked })} className="h-4 w-4 accent-marigold" /> Pickup
            </label>
            {form.pickupRequired && (
              <input maxLength={500} value={form.pickupDetails} onChange={(e) => setForm({ ...form, pickupDetails: e.target.value })} placeholder="Where and when (e.g. at the merch table on event night)" className={`${fieldClass} mt-1.5 w-full`} />
            )}
            <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.shippingAvailable} onChange={(e) => setForm({ ...form, shippingAvailable: e.target.checked })} className="h-4 w-4 accent-marigold" /> Shipping (U.S. addresses)
            </label>
            {form.shippingAvailable && (
              <label className="mt-1.5 flex items-center gap-2 text-sm text-gray-700">Shipping cost per order
                <span className="relative"><span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input type="number" inputMode="decimal" min="0" step="0.01" value={form.shippingCost} onChange={(e) => setForm({ ...form, shippingCost: e.target.value })} placeholder="0.00" className={`${fieldClass} w-28 pl-6`} /></span>
              </label>
            )}
          </div>

          {sellAnywhere && <PlacementPicker homeKind={ownerType} homeId={ownerId} value={placements} onChange={setPlacements} />}
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-white hover:bg-marigold/90 disabled:opacity-50">{saving ? 'Saving…' : editingId ? 'Save changes' : 'Create product'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700">Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <ListSkeleton rows={4} className="mt-4" />
      ) : products.length === 0 && !showForm ? (
        <div className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-white/60 py-10 text-center"><p className="text-gray-500">No products yet</p></div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {products.map((p) => {
            const left = variantStock.has(p.id) ? variantStock.get(p.id)! : Math.max(0, p.stock_quantity - p.sold_quantity);
            return (
              <div key={p.id} className={`flex gap-3 rounded-xl border bg-white p-3 shadow-sm ${p.is_active ? 'border-gray-200' : 'border-dashed border-gray-300 opacity-75'}`}>
                {p.images?.[0] ? <img src={p.images[0]} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" /> : <div className="h-16 w-16 shrink-0 rounded-lg bg-gray-100" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-900">{p.name}{!p.is_active && <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 align-middle text-[10px] font-bold uppercase text-gray-600">Hidden</span>}</p>
                  <p className="text-sm text-gray-500">{money(Number(p.price))} · {left > 0 ? `${left} left` : 'Sold out'}{p.sold_quantity > 0 ? ` · ${p.sold_quantity} sold` : ''}</p>
                  {(alsoIn.get(p.id) ?? 0) > 0 && <p className="text-xs font-medium text-indigo-700">Also in {alsoIn.get(p.id)} other place{alsoIn.get(p.id) === 1 ? '' : 's'} · shared stock</p>}
                  <div className="mt-1 flex flex-wrap gap-x-3 text-xs">
                    <button onClick={() => startEdit(p)} className="py-1 font-medium text-marigold">Edit</button>
                    {p.is_active && <Link to={`/products/${p.id}`} className="py-1 font-medium text-gray-600">View</Link>}
                    <button onClick={() => toggleActive(p)} className="py-1 font-medium text-gray-600">{p.is_active ? 'Hide from shop' : 'Show in shop'}</button>
                    <button onClick={() => deleteProduct(p)} className="py-1 font-medium text-gray-500 hover:text-red-600">Delete</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
