import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { ListSkeleton } from '../ui/Skeleton';
import { Badge, Chips, ConfirmDialog, Empty, FormDialog, PAGE_SIZE, Pager, Row, SearchBox, actionBtn, dangerBtn, fmtDate, safeSearch, useDebounced, type Notify } from './shared';

interface ResourceRow { id: string; display_name: string; bio: string | null; email: string; verification_status: string; status: string; created_at: string; average_rating: number | null; review_count: number | null; total_bookings: number | null; kind?: string }
type Filter = 'all' | 'verified' | 'pending' | 'rejected' | 'suspended' | 'inactive';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'verified', label: 'Approved' }, { id: 'pending', label: 'Pending' }, { id: 'rejected', label: 'Rejected' }, { id: 'suspended', label: 'Suspended' }, { id: 'inactive', label: 'Paused' },
];

export default function ResourcesTab({ notify }: { notify: Notify }) {
  const [rows, setRows] = useState<ResourceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<ResourceRow | null>(null);
  const [suspending, setSuspending] = useState<ResourceRow | null>(null);
  const q = useDebounced(safeSearch(search));

  useEffect(() => { setPage(0); }, [filter, q]);

  useEffect(() => {
    let stale = false;
    setLoading(true);
    let query = supabase.from('resources').select('id, display_name, bio, email, verification_status, status, created_at, average_rating, review_count, total_bookings, kind', { count: 'exact' });
    if (filter === 'verified' || filter === 'pending' || filter === 'rejected') query = query.eq('verification_status', filter);
    if (filter === 'suspended' || filter === 'inactive') query = query.eq('status', filter);
    if (q) query = query.or(`display_name.ilike.%${q}%,email.ilike.%${q}%`);
    query.order('created_at', { ascending: false }).range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1).then(({ data, count, error }) => {
      if (stale) return;
      if (error) { console.error(error); notify('err', "Couldn't load resources."); }
      setRows((data ?? []) as ResourceRow[]);
      setTotal(count ?? 0);
      setLoading(false);
    });
    return () => { stale = true; };
  }, [filter, q, page, notify]);

  async function patch(r: ResourceRow, values: Partial<ResourceRow>, okText: string) {
    const { error } = await supabase.from('resources').update(values).eq('id', r.id);
    if (error) return notify('err', "That didn't save. Please try again.");
    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, ...values } : x)));
    notify('ok', okText);
  }

  return (
    <div className="mt-6">
      <p className="mb-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">New resources are approved automatically. Suspend a resource to hide it from the directory and stop new bookings; the owner can't undo a suspension.</p>
      <SearchBox value={search} onChange={setSearch} placeholder="Search by name or email" />
      <div className="mt-3"><Chips options={FILTERS} value={filter} onChange={setFilter} /></div>
      {loading ? <ListSkeleton rows={4} className="mt-4" /> : rows.length === 0 ? <div className="mt-4"><Empty text="No resources match." /></div> : (
        <div className="mt-4 flex flex-col gap-2">
          {rows.map((r) => (
            <Row key={r.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link to={`/resources/${r.id}`} className="font-medium text-gray-900 hover:text-marigold">{r.display_name}</Link>
                  <p className="truncate text-xs text-gray-500">{r.kind === 'group' ? 'Group' : r.email} · joined {fmtDate(r.created_at)}</p>
                  <p className="text-xs text-gray-400">{r.total_bookings ?? 0} booking{r.total_bookings === 1 ? '' : 's'}{r.review_count ? ` · ${Number(r.average_rating).toFixed(1)}★ (${r.review_count})` : ''}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge tone={r.verification_status === 'verified' ? 'green' : r.verification_status === 'rejected' ? 'red' : 'orange'}>{r.verification_status === 'verified' ? 'approved' : r.verification_status}</Badge>
                  {r.status !== 'active' && <Badge tone={r.status === 'suspended' ? 'red' : 'gray'}>{r.status === 'inactive' ? 'paused' : r.status}</Badge>}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {r.verification_status !== 'verified' && <button className={actionBtn} onClick={() => patch(r, { verification_status: 'verified' }, `${r.display_name} is approved.`)}>Approve</button>}
                {r.verification_status !== 'rejected' && <button className={actionBtn} onClick={() => patch(r, { verification_status: 'rejected' }, `${r.display_name} is rejected.`)}>Reject</button>}
                <button className={actionBtn} onClick={() => setEditing(r)}>Edit</button>
                {r.status === 'suspended'
                  ? <button className={actionBtn} onClick={() => patch(r, { status: 'active' }, `${r.display_name} is reinstated.`)}>Reinstate</button>
                  : <button className={dangerBtn} onClick={() => setSuspending(r)}>Suspend</button>}
              </div>
            </Row>
          ))}
        </div>
      )}
      <Pager page={page} total={total} onPage={setPage} />
      {editing && (
        <FormDialog title="Edit resource" initial={{ display_name: editing.display_name, bio: editing.bio ?? '' }} onClose={() => setEditing(null)}
          fields={[{ key: 'display_name', label: 'Name' }, { key: 'bio', label: 'Bio', multiline: true }]}
          onSave={async (v) => patch(editing, { display_name: v.display_name.trim() || editing.display_name, bio: v.bio.trim() || null }, 'Saved.')} />
      )}
      {suspending && (
        <ConfirmDialog title={`Suspend ${suspending.display_name}?`} confirmLabel="Suspend" danger onClose={() => setSuspending(null)}
          body="They'll disappear from the resource directory and can't receive new booking requests. Existing bookings aren't cancelled. You can reinstate them at any time."
          onConfirm={async () => patch(suspending, { status: 'suspended' }, `${suspending.display_name} is suspended.`)} />
      )}
    </div>
  );
}
