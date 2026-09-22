import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { PRODUCT_CATEGORIES, type Product, type ProductCategory } from '../../lib/types';
import ImageUpload from '../ImageUpload';

interface ProductManagerProps {
  ownerType: 'event' | 'resource';
  ownerId: string;
  sellerEmail: string;
}

interface VariantRow {
  id: string | null; // null means not yet saved
  size: string;
  color: string;
  priceAdjustment: string;
  stockQuantity: string;
}

function emptyVariantRow(): VariantRow {
  return { id: null, size: '', color: '', priceAdjustment: '0', stockQuantity: '0' };
}

const emptyForm = {
  name: '',
  description: '',
  price: '',
  category: 'other' as ProductCategory,
  stockQuantity: '0',
  pickupRequired: true,
  shippingAvailable: false,
  shippingCost: '0',
};

export default function ProductManager({ ownerType, ownerId, sellerEmail }: ProductManagerProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [removedVariantIds, setRemovedVariantIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ownerColumn = ownerType === 'event' ? 'event_id' : 'resource_id';

  async function load() {
    const { data, error: loadError } = await supabase.from('products').select('*').eq(ownerColumn, ownerId).order('created_at', { ascending: false });
    if (loadError) {
      console.error('Failed to load products:', loadError);
    } else {
      setProducts((data ?? []) as Product[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [ownerId]);

  function startCreate() {
    setForm(emptyForm);
    setImageUrl(null);
    setEditingId(null);
    setVariants([]);
    setRemovedVariantIds([]);
    setShowForm(true);
  }

  async function startEdit(p: Product) {
    setForm({
      name: p.name,
      description: p.description ?? '',
      price: String(p.price),
      category: p.category,
      stockQuantity: String(p.stock_quantity),
      pickupRequired: p.pickup_required,
      shippingAvailable: p.shipping_available,
      shippingCost: String(p.shipping_cost),
    });
    setImageUrl(p.images?.[0] ?? null);
    setEditingId(p.id);
    setRemovedVariantIds([]);
    const { data: existingVariants } = await supabase
      .from('product_variants')
      .select('id, size, color, price_adjustment, stock_quantity, sold_quantity')
      .eq('product_id', p.id);
    setVariants(
      (existingVariants ?? []).map((v) => ({
        id: v.id,
        size: v.size ?? '',
        color: v.color ?? '',
        priceAdjustment: String(v.price_adjustment),
        stockQuantity: String(v.stock_quantity),
      }))
    );
    setShowForm(true);
  }

  function addVariantRow() {
    setVariants((prev) => [...prev, emptyVariantRow()]);
  }

  function updateVariantRow(index: number, patch: Partial<VariantRow>) {
    setVariants((prev) => prev.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }

  function removeVariantRow(index: number) {
    setVariants((prev) => {
      const row = prev[index];
      if (row.id) setRemovedVariantIds((ids) => [...ids, row.id!]);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      [ownerColumn]: ownerId,
      seller_email: sellerEmail,
      name: form.name,
      description: form.description || null,
      price: parseFloat(form.price),
      images: imageUrl ? [imageUrl] : [],
      category: form.category,
      stock_quantity: parseInt(form.stockQuantity, 10) || 0,
      pickup_required: form.pickupRequired,
      shipping_available: form.shippingAvailable,
      shipping_cost: form.shippingAvailable ? parseFloat(form.shippingCost) || 0 : 0,
    };

    const { data: savedProduct, error: saveError } = editingId
      ? await supabase.from('products').update(payload).eq('id', editingId).select().single()
      : await supabase.from('products').insert(payload).select().single();

    if (saveError || !savedProduct) {
      setSaving(false);
      console.error('Failed to save product:', saveError);
      setError('Something went wrong saving this product. Please try again.');
      return;
    }

    // Save variants: update existing rows, insert new ones, delete removed ones.
    const validVariants = variants.filter((v) => v.size.trim() || v.color.trim());
    for (const v of validVariants) {
      const variantPayload = {
        product_id: savedProduct.id,
        size: v.size.trim() || null,
        color: v.color.trim() || null,
        price_adjustment: parseFloat(v.priceAdjustment) || 0,
        stock_quantity: parseInt(v.stockQuantity, 10) || 0,
      };
      if (v.id) {
        await supabase.from('product_variants').update(variantPayload).eq('id', v.id);
      } else {
        await supabase.from('product_variants').insert(variantPayload);
      }
    }
    if (removedVariantIds.length > 0) {
      await supabase.from('product_variants').delete().in('id', removedVariantIds);
    }

    setSaving(false);
    setShowForm(false);
    load();
  }

  async function toggleActive(p: Product) {
    await supabase.from('products').update({ is_active: !p.is_active }).eq('id', p.id);
    setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_active: !x.is_active } : x)));
  }

  async function deleteProduct(id: string) {
    await supabase.from('products').delete().eq('id', id);
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }

  const fieldClass = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none placeholder:text-gray-400 focus-visible:border-marigold';

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-gray-900">Products</h2>
        <button
          onClick={startCreate}
          className="rounded-lg bg-marigold px-3 py-1.5 text-sm font-semibold text-ink hover:bg-marigold/90"
        >
          + Add product
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <ImageUpload currentUrl={imageUrl} onUploaded={setImageUrl} pathPrefix={`products/${ownerType}`} label="Product photo" />
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Name
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={fieldClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Description
            <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={fieldClass} />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Price ($)
              <input required type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className={fieldClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Category
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ProductCategory })} className={fieldClass}>
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Stock quantity
              <input type="number" min="0" value={form.stockQuantity} onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })} className={fieldClass} />
            </label>
          </div>

          <div className="rounded-lg border border-gray-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Sizes / Colors <span className="font-normal text-gray-400">(optional)</span></p>
                <p className="text-xs text-gray-400">Add a row for each size/color combination you sell -- each tracks its own stock.</p>
              </div>
              <button type="button" onClick={addVariantRow} className="shrink-0 text-xs font-medium text-marigold hover:underline">
                + Add option
              </button>
            </div>
            {variants.length > 0 && (
              <div className="mt-3 flex flex-col gap-2">
                {variants.map((v, i) => (
                  <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-5 sm:items-center">
                    <input
                      placeholder="Size (e.g. Medium)"
                      value={v.size}
                      onChange={(e) => updateVariantRow(i, { size: e.target.value })}
                      className={`${fieldClass} text-sm`}
                    />
                    <input
                      placeholder="Color (e.g. Blue)"
                      value={v.color}
                      onChange={(e) => updateVariantRow(i, { color: e.target.value })}
                      className={`${fieldClass} text-sm`}
                    />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Price +/-"
                      value={v.priceAdjustment}
                      onChange={(e) => updateVariantRow(i, { priceAdjustment: e.target.value })}
                      className={`${fieldClass} text-sm`}
                    />
                    <input
                      type="number"
                      min="0"
                      placeholder="Stock"
                      value={v.stockQuantity}
                      onChange={(e) => updateVariantRow(i, { stockQuantity: e.target.value })}
                      className={`${fieldClass} text-sm`}
                    />
                    <button type="button" onClick={() => removeVariantRow(i)} className="text-xs font-medium text-magenta hover:underline">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.pickupRequired} onChange={(e) => setForm({ ...form, pickupRequired: e.target.checked })} />
              Available for pickup
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.shippingAvailable} onChange={(e) => setForm({ ...form, shippingAvailable: e.target.checked })} />
              Ship to buyer
            </label>
            {form.shippingAvailable && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                Shipping cost ($)
                <input type="number" min="0" step="0.01" value={form.shippingCost} onChange={(e) => setForm({ ...form, shippingCost: e.target.value })} className={`${fieldClass} w-24`} />
              </label>
            )}
          </div>
          {error && <p className="text-sm text-magenta">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-ink hover:bg-marigold/90 disabled:opacity-50">
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create product'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700">
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="mt-4 text-sm text-gray-400">Loading…</p>
      ) : products.length === 0 && !showForm ? (
        <div className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-white/60 py-10 text-center">
          <p className="text-gray-500">No products yet</p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {products.map((p) => (
            <div key={p.id} className="flex gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
              {p.images?.[0] ? (
                <img src={p.images[0]} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="h-16 w-16 shrink-0 rounded-lg bg-gray-100" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-gray-900">{p.name}</p>
                <p className="text-sm text-gray-500">${p.price} &middot; {p.stock_quantity - p.sold_quantity} in stock</p>
                <div className="mt-1 flex gap-2">
                  <button onClick={() => startEdit(p)} className="text-xs font-medium text-marigold hover:underline">Edit</button>
                  <button onClick={() => toggleActive(p)} className="text-xs font-medium text-gray-500 hover:underline">
                    {p.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => deleteProduct(p.id)} className="text-xs font-medium text-magenta hover:underline">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
