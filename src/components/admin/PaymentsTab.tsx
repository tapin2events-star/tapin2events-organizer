import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { money } from '../../lib/bookings';
import { ListSkeleton } from '../ui/Skeleton';
import { Badge, Chips, Empty, PAGE_SIZE, Pager, Row, SearchBox, fmtDate, safeSearch, useDebounced, type Notify } from './shared';

interface PaymentRow { kind: 'order' | 'vendor' | 'tip' | 'booking'; id: string; created_at: string; amount: number; fee: number; refunded: number; status: string; who: string | null; label: string | null; event_id: string | null }
type Filter = 'all' | 'order' | 'vendor' | 'tip' | 'booking';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'order', label: 'Tickets & merch' }, { id: 'vendor', label: 'Vendor fees' }, { id: 'tip', label: 'Tips' }, { id: 'booking', label: 'Bookings' },
];
const KIND_LABEL: Record<string, string> = { order: 'Order', vendor: 'Vendor fee', tip: 'Tip', booking: 'Booking' };

export default function PaymentsTab({ notify }: { notify: Notify }) {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const q = useDebounced(safeSearch(search));

  useEffect(() => { setPage(0); }, [filter, q]);

  useEffect(() => {
    let stale = false;
    setLoading(true);
    supabase.rpc('admin_payments', { p_kind: filter, p_search: q, p_limit: PAGE_SIZE, p_offset: page * PAGE_SIZE }).then(({ data, error }) => {
      if (stale) return;
      if (error) { console.error(error); notify('err', "Couldn't load payments."); }
      const d = data as { total: number; rows: PaymentRow[] } | null;
      setRows(d?.rows ?? []);
      setTotal(Number(d?.total ?? 0));
      setLoading(false);
    });
    return () => { stale = true; };
  }, [filter, q, page, notify]);

  return (
    <div className="mt-6">
      <SearchBox value={search} onChange={setSearch} placeholder="Search by email or item" />
      <div className="mt-3"><Chips options={FILTERS} value={filter} onChange={setFilter} /></div>
      {loading ? <ListSkeleton rows={5} className="mt-4" /> : rows.length === 0 ? <div className="mt-4"><Empty text="No payments match." /></div> : (
        <div className="mt-4 flex flex-col gap-2">
          {rows.map((r) => (
            <Row key={r.kind + r.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">{r.event_id ? <Link to={`/organizer/events/${r.event_id}`} className="hover:text-marigold">{r.label || KIND_LABEL[r.kind]}</Link> : (r.label || KIND_LABEL[r.kind])}</p>
                  <p className="truncate text-xs text-gray-500">{r.who ?? '—'} · {fmtDate(r.created_at, true)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-medium text-gray-900">{money(r.amount)}</p>
                  <p className="text-xs text-gray-400">{money(r.fee)} fees</p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge tone="gray">{KIND_LABEL[r.kind]}</Badge>
                <Badge tone={r.status === 'paid' || r.status === 'captured' || r.status === 'paid_out' ? 'green' : r.status === 'refunded' ? 'orange' : 'gray'}>{r.status}</Badge>
                {r.refunded > 0 && <span className="text-xs text-orange-700">{money(r.refunded)} refunded</span>}
              </div>
            </Row>
          ))}
        </div>
      )}
      <Pager page={page} total={total} onPage={setPage} />
    </div>
  );
}
