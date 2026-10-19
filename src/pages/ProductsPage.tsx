import { useCallback, useEffect, useMemo, useState } from 'react';
import BackButton from '../components/BackButton';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { PRODUCT_CATEGORIES, type Product } from '../lib/types';
import { priceLabel } from '../lib/productMoney';
import MyProductOrders from '../components/products/MyProductOrders';
import MyProducts from '../components/products/MyProducts';
import { EventCardGridSkeleton } from '../components/ui/Skeleton';

interface ProductWithSeller extends Product {
  sellerName: string;
  linkTo: string;
  left: number;
  priceText: string;
}

const TABS = ['Browse', 'My Orders', 'My Products'] as const;
type Tab = (typeof TABS)[number];

export default function ProductsPage() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab');
  const [tab, setTab] = useState<Tab>(initialTab === 'orders' ? 'My Orders' : initialTab === 'products' ? 'My Products' : 'Browse');
  const [products, setProducts] = useState<ProductWithSeller[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  // Loads (and reloads) the product list.
  const load = useCallback(async () => {
    {
      const { data: productRows, error } = await supabase.from('products').select('*').eq('is_active', true).eq('visibility', 'public').order('created_at', { ascending: false });
      if (error) {
        console.error('Failed to load products:', error);
        setLoading(false);
        return;
      }

      const eventIds = [...new Set((productRows ?? []).filter((p) => p.event_id).map((p) => p.event_id))];
      const resourceIds = [...new Set((productRows ?? []).filter((p) => p.resource_id).map((p) => p.resource_id))];

      const [{ data: events }, { data: resources }] = await Promise.all([
        eventIds.length ? supabase.from('events').select('id, title').in('id', eventIds) : Promise.resolve({ data: [] }),
        resourceIds.length ? supabase.from('resources').select('id, display_name').in('id', resourceIds) : Promise.resolve({ data: [] }),
      ]);
      const ids = (productRows ?? []).map((p) => p.id);
      const { data: variantRows } = ids.length ? await supabase.from('product_variants').select('product_id, stock_quantity, sold_quantity, price_adjustment').in('product_id', ids) : { data: [] as { product_id: string; stock_quantity: number; sold_quantity: number; price_adjustment: number }[] };
      const vLeft = new Map<string, number>(); const vAdj = new Map<string, number[]>();
      (variantRows ?? []).forEach((v) => { vLeft.set(v.product_id, (vLeft.get(v.product_id) ?? 0) + Math.max(0, v.stock_quantity - v.sold_quantity)); vAdj.set(v.product_id, [...(vAdj.get(v.product_id) ?? []), Number(v.price_adjustment) || 0]); });
      const eventsById = new Map((events ?? []).map((e) => [e.id, e]));
      const resourcesById = new Map((resources ?? []).map((r) => [r.id, r]));

      const merged = (productRows ?? []).map((p: any) => ({
        ...p,
        sellerName: p.event_id ? (eventsById.get(p.event_id)?.title ?? 'An event') : (resourcesById.get(p.resource_id)?.display_name ?? 'An artist'),
        linkTo: `/products/${p.id}`,
        left: vLeft.has(p.id) ? vLeft.get(p.id)! : Math.max(0, p.stock_quantity - p.sold_quantity),
        priceText: priceLabel(Number(p.price), vAdj.get(p.id)),
      }));
      setProducts(merged);
      setLoading(false);
    }
  }, []);
  // Refresh when the page opens, when you come back to the app or tab, and when products change anywhere in the app.
  useEffect(() => {
    load();
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    const onChanged = () => load();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onChanged);
    window.addEventListener('tapin-products-changed', onChanged);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onChanged);
      window.removeEventListener('tapin-products-changed', onChanged);
    };
  }, [load]);
  // Switching back to Browse shows the latest products.
  useEffect(() => { if (tab === 'Browse') load(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    return products
      .filter((p) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return p.name.toLowerCase().includes(q) || p.sellerName.toLowerCase().includes(q);
      })
      .filter((p) => !category || p.category === category);
  }, [products, search, category]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-3"><BackButton fallback="/" fallbackLabel="Discover" /></div>
      <h1 className="font-display text-4xl font-extrabold text-gray-900">Shop</h1>
      <p className="mt-1 text-lg text-gray-500">Merch and products from events and artists on TapIN</p>

      <div className="mt-6 flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition ${
              tab === t ? 'border-b-2 border-marigold text-marigold' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Browse' && (
        <div className="mt-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products or sellers"
              className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none placeholder:text-gray-400 focus-visible:border-marigold"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none focus-visible:border-marigold"
            >
              <option value="">All categories</option>
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <EventCardGridSkeleton count={6} className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" />
          ) : filtered.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-white/60 py-16 text-center">
              <p className="text-lg font-semibold text-gray-500">No products found</p>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((p) => {
                const available = p.left;
                return (
                  <Link
                    key={p.id}
                    to={p.linkTo}
                    className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-lg"
                  >
                    {p.images?.[0] ? (
                      <img src={p.images[0]} alt="" className="h-40 w-full object-cover" />
                    ) : (
                      <div className="flex h-40 w-full items-center justify-center bg-gradient-to-br from-indigo-100 to-teal-100">
                        <span className="font-display text-3xl font-extrabold text-indigo-300">{p.name.charAt(0)}</span>
                      </div>
                    )}
                    <div className="p-5">
                      <p className="font-display text-lg font-bold text-gray-900">{p.name}</p>
                      <p className="mt-0.5 text-sm text-gray-400">Sold by {p.sellerName}</p>
                      <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 text-sm">
                        <span className="text-gray-500">{available > 0 ? `${available} left` : 'Sold out'}</span>
                        <span className="font-medium text-gray-900">{p.priceText}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'My Orders' && <MyProductOrders title="My Orders" />}
      {tab === 'My Products' && <MyProducts />}
    </div>
  );
}
