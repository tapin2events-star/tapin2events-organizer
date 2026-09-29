import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { money } from '../../lib/bookings';
import { ListSkeleton } from '../ui/Skeleton';
import { Badge, Chips, ConfirmDialog, Empty, FormDialog, PAGE_SIZE, Pager, Row, SearchBox, actionBtn, dangerBtn, safeSearch, useDebounced, type Notify } from './shared';

interface ProductRow { id: string; name: string; description: string | null; price: number; seller_email: string; is_active: boolean; sold_quantity: number | null }
type Filter = 'all' | 'active' | 'hidden';
const FILTERS: { id: Filter; label: string }[] = [{ id: 'all', label: 'All' }, { id: 'active', label: 'Visible' }, { id: 'hidden', label: 'Hidden' }];

export default function ProductsTab({ notify }: { notify: Notify }) {
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [deleting, setDeleting] = useState<ProductRow | null>(null);
  const q = useDebounced(safeSearch(search));

  useEffect(() => { setPage(0); }, [filter, q]);

  useEffect(() => {
    let stale = false;
    setLoading(true);
    let query = supabase.from('products').select('id, name, description, price, seller_email, is_active, sold_quantity', { count: 'exact' });
    if (filter === 'active') query = query.eq('is_active', true);
    if (filter === 'hidden') query = query.eq('is_active', false);
    if (q) query = query.or(`name.ilike.%${q}%,seller_email.ilike.%${q}%`);
    query.order('created_at', { ascending: false }).range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1).then(({ data, count, error }) => {
      if (stale) return;
      if (error) { console.error(error); notify('err', "Couldn't load products."); }
      setRows((data ?? []) as ProductRow[]);
      setTotal(count ?? 0);
      setLoading(false);
    });
    return () => { stale = true; };
  }, [filter, q, page, notify]);

  async function patch(p: ProductRow, values: Partial<ProductRow>, okText: string) {
    const { error } = await supabase.from('products').update(values).eq('id', p.id);
    if (error) return notify('err', "That didn't save. Please try again.");
    setRows((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...values } : x)));
    notify('ok', okText);
  }

  async function remove(p: ProductRow) {
    const { error } = await supabase.from('products').delete().eq('id', p.id);
    if (error) return notify('err', "Couldn't delete it (it may be part of past orders). Hide it instead.");
    setRows((prev) => prev.filter((x) => x.id !== p.id));
    setTotal((t) => t - 1);
    notify('ok', `"${p.name}" was deleted.`);
  }

  return (
    <div className="mt-6">
      <SearchBox value={search} onChange={setSearch} placeholder="Search by product or seller email" />
      <div className="mt-3"><Chips options={FILTERS} value={filter} onChange={setFilter} /></div>
      {loading ? <ListSkeleton rows={4} className="mt-4" /> : rows.length === 0 ? <div className="mt-4"><Empty text="No products match." /></div> : (
        <div className="mt-4 flex flex-col gap-2">
          {rows.map((p) => (
            <Row key={p.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link to={`/products/${p.id}`} className="font-medium text-gray-900 hover:text-marigold">{p.name}</Link>
                  <p className="truncate text-xs text-gray-500">{p.seller_email} · {money(p.price)} · {p.sold_quantity ?? 0} sold</p>
                </div>
                {!p.is_active && <Badge tone="gray">hidden</Badge>}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button className={actionBtn} onClick={() => setEditing(p)}>Edit</button>
                <button className={actionBtn} onClick={() => patch(p, { is_active: !p.is_active }, p.is_active ? `"${p.name}" is hidden.` : `"${p.name}" is visible.`)}>{p.is_active ? 'Hide' : 'Show'}</button>
                <button className={dangerBtn} onClick={() => setDeleting(p)}>Delete</button>
              </div>
            </Row>
          ))}
        </div>
      )}
      <Pager page={page} total={total} onPage={setPage} />
      {editing && (
        <FormDialog title="Edit product" initial={{ name: editing.name, description: editing.description ?? '', price: String(editing.price) }} onClose={() => setEditing(null)}
          fields={[{ key: 'name', label: 'Name' }, { key: 'description', label: 'Description', multiline: true }, { key: 'price', label: 'Price ($)', number: true }]}
          onSave={async (v) => patch(editing, { name: v.name.trim() || editing.name, description: v.description.trim() || null, price: Math.max(parseFloat(v.price) || 0, 0) }, 'Saved.')} />
      )}
      {deleting && (
        <ConfirmDialog title="Delete this product?" confirmLabel="Delete" danger onClose={() => setDeleting(null)}
          body={<>"{deleting.name}" will be permanently deleted. If you only want to stop it selling, choose <strong>Hide</strong> instead.</>}
          onConfirm={async () => remove(deleting)} />
      )}
    </div>
  );
}
