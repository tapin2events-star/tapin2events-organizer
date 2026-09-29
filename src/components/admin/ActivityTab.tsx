import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { ListSkeleton } from '../ui/Skeleton';
import { Badge, Empty, PAGE_SIZE, Pager, Row, fmtDate, type Notify } from './shared';

interface LogRow { id: number; admin_email: string | null; action: string; target_type: string; target_label: string | null; details: Record<string, unknown> | null; created_at: string }

const TARGETS: Record<string, string> = { profiles: 'user', events: 'event', resources: 'resource', products: 'product', posts: 'post', post_comments: 'comment' };

function short(v: unknown): string {
  if (v === null || v === undefined || v === '') return 'empty';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return s.length > 60 ? s.slice(0, 57) + '…' : s;
}

function describe(r: LogRow): string[] {
  const d = r.details;
  if (!d) return [];
  if ('reason' in d || 'sign_in_blocked' in d) return [d.reason ? `Reason: ${short(d.reason)}` : 'No reason given'];
  return Object.entries(d).map(([k, v]) => {
    const change = v as { from?: unknown; to?: unknown };
    return `${k.replace(/_/g, ' ')}: ${short(change.from)} → ${short(change.to)}`;
  });
}

// Every change an admin makes to someone else's account, event, resource, product, or post.
export default function ActivityTab({ notify }: { notify: Notify }) {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  useEffect(() => {
    let stale = false;
    setLoading(true);
    supabase.from('admin_audit_log').select('id, admin_email, action, target_type, target_label, details, created_at', { count: 'exact' })
      .order('created_at', { ascending: false }).range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1).then(({ data, count, error }) => {
        if (stale) return;
        if (error) { console.error(error); notify('err', "Couldn't load the activity log."); }
        setRows((data ?? []) as LogRow[]);
        setTotal(count ?? 0);
        setLoading(false);
      });
    return () => { stale = true; };
  }, [page, notify]);

  return (
    <div className="mt-6">
      <p className="mb-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">A record of what admins change on other people's accounts and content. Edits to your own things aren't listed.</p>
      {loading ? <ListSkeleton rows={5} className="mt-4" /> : rows.length === 0 ? <Empty text="No admin activity yet." /> : (
        <div className="flex flex-col gap-2">
          {rows.map((r) => {
            const lines = describe(r);
            return (
              <Row key={r.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="min-w-0 text-sm text-gray-900">
                    <strong className="capitalize">{r.action === 'ban' || r.action === 'unban' ? r.action : r.action === 'delete' ? 'Deleted' : 'Edited'}</strong>{' '}
                    {TARGETS[r.target_type] ?? r.target_type} <span className="font-medium">{r.target_label ?? ''}</span>
                  </p>
                  <Badge tone={r.action === 'delete' || r.action === 'ban' ? 'red' : 'gray'}>{r.action}</Badge>
                </div>
                <p className="text-xs text-gray-500">{r.admin_email ?? 'An admin'} · {fmtDate(r.created_at, true)}</p>
                {lines.length > 0 && <ul className="mt-1 list-inside list-disc text-xs text-gray-600">{lines.map((l) => <li key={l} className="break-words">{l}</li>)}</ul>}
              </Row>
            );
          })}
        </div>
      )}
      <Pager page={page} total={total} onPage={setPage} />
    </div>
  );
}
