import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { ListSkeleton } from '../ui/Skeleton';
import { Badge, Chips, ConfirmDialog, Empty, PAGE_SIZE, Pager, Row, SearchBox, actionBtn, fmtDate, safeSearch, useDebounced, type Notify } from './shared';

interface EventRow { id: string; title: string; status: string; event_type: string | null; start_date: string | null; organizer_email: string | null; external_ticket_url: string | null }
type Filter = 'all' | 'published' | 'draft' | 'cancelled' | 'completed';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'published', label: 'Published' }, { id: 'draft', label: 'Drafts' }, { id: 'cancelled', label: 'Cancelled' }, { id: 'completed', label: 'Completed' },
];
const TONE: Record<string, 'green' | 'gray' | 'red' | 'blue'> = { published: 'green', draft: 'gray', cancelled: 'red', completed: 'blue' };

export default function EventsTab({ notify }: { notify: Notify }) {
  const [rows, setRows] = useState<EventRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [confirm, setConfirm] = useState<EventRow | null>(null);
  const q = useDebounced(safeSearch(search));

  useEffect(() => { setPage(0); }, [filter, q]);

  useEffect(() => {
    let stale = false;
    setLoading(true);
    let query = supabase.from('events').select('id, title, status, event_type, start_date, organizer_email, external_ticket_url', { count: 'exact' });
    if (filter !== 'all') query = query.eq('status', filter);
    if (q) query = query.or(`title.ilike.%${q}%,organizer_email.ilike.%${q}%`);
    query.order('start_date', { ascending: false, nullsFirst: false }).range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1).then(({ data, count, error }) => {
      if (stale) return;
      if (error) { console.error(error); notify('err', "Couldn't load events."); }
      setRows((data ?? []) as EventRow[]);
      setTotal(count ?? 0);
      setLoading(false);
    });
    return () => { stale = true; };
  }, [filter, q, page, notify]);

  async function toggle(e: EventRow) {
    const status = e.status === 'published' ? 'draft' : 'published';
    const { error } = await supabase.from('events').update({ status }).eq('id', e.id);
    if (error) return notify('err', `Couldn't ${status === 'draft' ? 'unpublish' : 'publish'} that event.`);
    setRows((prev) => prev.map((x) => (x.id === e.id ? { ...x, status } : x)));
    notify('ok', status === 'draft' ? `"${e.title}" is unpublished.` : `"${e.title}" is live.`);
  }

  return (
    <div className="mt-6">
      <SearchBox value={search} onChange={setSearch} placeholder="Search by title or organizer email" />
      <div className="mt-3"><Chips options={FILTERS} value={filter} onChange={setFilter} /></div>
      {loading ? <ListSkeleton rows={5} className="mt-4" /> : rows.length === 0 ? <div className="mt-4"><Empty text="No events match." /></div> : (
        <div className="mt-4 flex flex-col gap-2">
          {rows.map((e) => (
            <Row key={e.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link to={`/events/${e.id}`} className="font-medium text-gray-900 hover:text-marigold">{e.title}</Link>
                  <p className="truncate text-xs text-gray-500">{e.organizer_email ?? 'No organizer'} · {e.event_type ?? 'free'}{e.external_ticket_url ? ' · tickets elsewhere' : ''} · {fmtDate(e.start_date)}</p>
                </div>
                <Badge tone={TONE[e.status] ?? 'gray'}>{e.status}</Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link to={`/organizer/events/${e.id}`} className={actionBtn}>Manage</Link>
                <Link to={`/organizer/events/${e.id}/edit`} className={actionBtn}>Edit</Link>
                {(e.status === 'published' || e.status === 'draft') && (
                  <button className={actionBtn} onClick={() => (e.status === 'published' ? setConfirm(e) : toggle(e))}>{e.status === 'published' ? 'Unpublish' : 'Publish'}</button>
                )}
              </div>
            </Row>
          ))}
        </div>
      )}
      <Pager page={page} total={total} onPage={setPage} />
      {confirm && (
        <ConfirmDialog title="Unpublish this event?" confirmLabel="Unpublish" danger onClose={() => setConfirm(null)}
          body={<>"{confirm.title}" will disappear from Discover and its page will stop working. Existing tickets stay valid. You can publish it again any time.</>}
          onConfirm={async () => toggle(confirm)} />
      )}
    </div>
  );
}
