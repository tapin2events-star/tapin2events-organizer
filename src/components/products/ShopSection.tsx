import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import type { Product } from '../../lib/types';

interface ShopSectionProps {
  ownerType: 'event' | 'resource';
  ownerId: string;
}

export default function ShopSection({ ownerType, ownerId }: ShopSectionProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [variantAvailability, setVariantAvailability] = useState<Map<string, number>>(new Map());

  const ownerColumn = ownerType === 'event' ? 'event_id' : 'resource_id';

  useEffect(() => {
    supabase
      .from('products')
      .select('*')
      .eq(ownerColumn, ownerId)
      .then(async ({ data }) => {
        const rows = (data ?? []) as Product[];
        setProducts(rows);
        // For products with variants, total available stock is the sum
        // across all variants, so the card can still show a sensible number.
        const { data: variantRows } = await supabase
          .from('product_variants')
          .select('product_id, stock_quantity, sold_quantity')
          .in('product_id', rows.map((p) => p.id));
        const totals = new Map<string, number>();
        (variantRows ?? []).forEach((v) => {
          totals.set(v.product_id, (totals.get(v.product_id) ?? 0) + (v.stock_quantity - v.sold_quantity));
        });
        setVariantAvailability(totals);
      });
  }, [ownerId]);

  if (products.length === 0) return null;

  return (
    <div className="mt-10">
      <h2 className="font-display text-xl font-bold text-gray-900">Shop</h2>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {products.map((p) => {
          const hasVariants = variantAvailability.has(p.id);
          const available = hasVariants ? variantAvailability.get(p.id)! : p.stock_quantity - p.sold_quantity;
          return (
            <Link key={p.id} to={`/products/${p.id}`} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm hover:border-marigold">
              <div className="flex gap-3">
                {p.images?.[0] ? (
                  <img src={p.images[0]} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="h-20 w-20 shrink-0 rounded-lg bg-gray-100" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900">{p.name}</p>
                  <p className="text-sm text-gray-500">${p.price}{hasVariants && '+'}</p>
                  <p className="text-xs text-gray-400">{available > 0 ? `${available} available` : 'Sold out'}</p>
                  {hasVariants && <p className="mt-1 text-xs font-medium text-marigold">Select options &rarr;</p>}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
