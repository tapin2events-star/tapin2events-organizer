import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { PRODUCT_CATEGORIES, type Product } from '../lib/types';
import MyProductOrders from '../components/products/MyProductOrders';

interface ProductWithSeller extends Product {
  sellerName: string;
  linkTo: string;
}

const TABS = ['Browse', 'My Orders'] as const;
type Tab = (typeof TABS)[number];

export default function ProductsPage() {
  const [tab, setTab] = useState<Tab>('Browse');
  const [products, setProducts] = useState<ProductWithSeller[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  useEffect(() => {
    (async () => {
      const { data: productRows, error } = await supabase.from('products').select('*');
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
      const eventsById = new Map((events ?? []).map((e) => [e.id, e]));
      const resourcesById = new Map((resources ?? []).map((r) => [r.id, r]));

      const merged = (productRows ?? []).map((p: any) => ({
        ...p,
        sellerName: p.event_id ? (eventsById.get(p.event_id)?.title ?? 'An event') : (resourcesById.get(p.resource_id)?.display_name ?? 'A resource'),
        linkTo: p.event_id ? `/events/${p.event_id}` : `/resources/${p.resource_id}`,
      }));
      setProducts(merged);
      setLoading(false);
    })();
  }, []);

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
            <p className="mt-6 text-sm text-gray-500">Loading…</p>
          ) : filtered.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-white/60 py-16 text-center">
              <p className="text-lg font-semibold text-gray-500">No products found</p>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((p) => {
                const available = p.stock_quantity - p.sold_quantity;
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
                        <span className="text-gray-500">{available > 0 ? `${available} available` : 'Sold out'}</span>
                        <span className="font-medium text-gray-900">${p.price}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'My Orders' && <MyProductOrders />}
    </div>
  );
}
