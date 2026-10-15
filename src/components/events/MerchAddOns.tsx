import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export interface AddOnPick { product_id: string; variant_id: string | null; qty: number }
interface Variant { id: string; label: string; price_adjustment: number; available: number }
interface Product { id: string; name: string; price: number; image: string | null; description: string | null; available: number; variants: Variant[] }
const money = (n: number) => `$${Number(n).toFixed(2).replace(/\.00$/, '')}`;

// Ticket checkout: "Add merch" from the event's own pickup merch. Picks are paid in the same checkout and
// picked up at the event. Hidden when the event has no add-on merch.
export default function MerchAddOns({ eventId, value, onChange, accent }: { eventId: string; value: AddOnPick[]; onChange: (v: AddOnPick[]) => void; accent?: string }) {
  const [items, setItems] = useState<Product[]>([]);
  const [variantFor, setVariantFor] = useState<Record<string, string>>({});
  useEffect(() => { supabase.rpc('event_addon_products', { p_event_id: eventId }).then(({ data }) => setItems(((data ?? []) as Product[]).map((p) => ({ ...p, price: Number(p.price) })))); }, [eventId]);
  const shown = items.filter((p) => (p.variants.length ? p.variants.some((v) => v.available > 0) : p.available > 0));
  if (!shown.length) return null;
  const key = (p: Product) => (p.variants.length ? `${p.id}:${variantFor[p.id] ?? ''}` : p.id);
  const qtyOf = (p: Product) => value.find((v) => v.product_id === p.id && (v.variant_id ?? '') === (p.variants.length ? variantFor[p.id] ?? '' : ''))?.qty ?? 0;
  function setQty(p: Product, qty: number) {
    const vid = p.variants.length ? variantFor[p.id] ?? null : null;
    if (p.variants.length && !vid) return;
    const rest = value.filter((v) => !(v.product_id === p.id && (v.variant_id ?? null) === vid));
    onChange(qty > 0 ? [...rest, { product_id: p.id, variant_id: vid, qty }].slice(0, 4) : rest);
  }
  const subtotal = value.reduce((n, v) => {
    const p = items.find((x) => x.id === v.product_id);
    const adj = p?.variants.find((x) => x.id === v.variant_id)?.price_adjustment ?? 0;
    return n + (p ? (p.price + Number(adj)) * v.qty : 0);
  }, 0);
  return (
    <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-3">
      <p className="text-sm font-semibold text-gray-900">🛍️ Add merch <span className="font-normal text-gray-500">· pick up at the event</span></p>
      <ul className="mt-2 flex flex-col gap-2">
        {shown.map((p) => {
          const vid = variantFor[p.id] ?? '';
          const v = p.variants.find((x) => x.id === vid);
          const max = Math.min(10, p.variants.length ? v?.available ?? 0 : p.available);
          const q = qtyOf(p);
          return (
            <li key={key(p)} className="flex items-center gap-3">
              {p.image ? <img src={p.image} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" /> : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xl">🛍️</span>}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-gray-900">{p.name}</span>
                <span className="block text-xs text-gray-500">{money(p.price + Number(v?.price_adjustment ?? 0))}</span>
                {p.variants.length > 0 && (
                  <select value={vid} onChange={(e) => setVariantFor({ ...variantFor, [p.id]: e.target.value })} aria-label={`${p.name} option`} className="mt-1 rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800">
                    <option value="">Choose…</option>
                    {p.variants.map((x) => <option key={x.id} value={x.id} disabled={x.available <= 0}>{x.label}{x.available <= 0 ? ' (sold out)' : ''}</option>)}
                  </select>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <button type="button" onClick={() => setQty(p, Math.max(0, q - 1))} disabled={q === 0} aria-label={`Fewer ${p.name}`} className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-gray-700 disabled:opacity-40">−</button>
                <span className="w-5 text-center text-sm font-semibold text-gray-900">{q}</span>
                <button type="button" onClick={() => setQty(p, Math.min(max, q + 1))} disabled={q >= max || (p.variants.length > 0 && !vid)} aria-label={`More ${p.name}`} className="flex h-8 w-8 items-center justify-center rounded-full text-white disabled:opacity-40" style={{ background: accent || '#0F1B3D' }}>+</button>
              </span>
            </li>
          );
        })}
      </ul>
      {subtotal > 0 && <p className="mt-2 text-xs text-gray-600">Merch: <strong>{money(subtotal)}</strong> + fees, added to your ticket checkout. Pick it up at the merch table.</p>}
    </div>
  );
}
