import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

// Dashboard tile details (preview: earnings_v2): a 30-day chart plus a breakdown, from dashboard_detail.
export type DetailKind = 'plays' | 'views' | 'org_tickets' | 'org_views' | 'org_checkins';
interface Detail { series?: { day: string; value: number }[]; month: number; total: number; rows?: Record<string, string | number | null>[] }
const META: Record<DetailKind, { title: string; month: string; total: string; empty: string }> = {
  plays: { title: 'Plays', month: 'This month', total: 'All time', empty: 'No plays yet. Share your music to get it heard.' },
  views: { title: 'Profile views', month: 'This month', total: 'All time', empty: 'No views yet. Share your profile link to bring people in.' },
  org_tickets: { title: 'Tickets sold', month: 'This month', total: 'All time', empty: 'No tickets sold yet.' },
  org_views: { title: 'Event page views', month: 'This month', total: 'All time', empty: 'No event page views yet this month.' },
  org_checkins: { title: 'Checked in', month: 'Checked in', total: 'Tickets', empty: 'No events in the last 30 days.' },
};

function Chart({ series }: { series: { day: string; value: number }[] }) {
  const max = Math.max(1, ...series.map((s) => Number(s.value)));
  return (
    <div>
      <div className="flex h-28 items-end gap-[3px]" role="img" aria-label={`Last 30 days: ${series.reduce((n, s) => n + Number(s.value), 0)} total`}>
        {series.map((s) => (
          <div key={s.day} className="flex-1 rounded-t bg-gradient-to-t from-indigo-600 to-teal-400" style={{ height: `${Math.max(Number(s.value) ? 6 : 2, (Number(s.value) / max) * 100)}%`, opacity: Number(s.value) ? 1 : 0.25 }} title={`${new Date(s.day + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${s.value}`} />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-gray-500"><span>30 days ago</span><span>Today</span></div>
    </div>
  );
}

export default function DetailSheet({ kind, scopeId, title, onClose }: { kind: DetailKind; scopeId?: string | null; title?: string; onClose: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const meta = META[kind];
  useEffect(() => { supabase.rpc('dashboard_detail', { p_kind: kind, p_scope_id: scopeId ?? null }).then(({ data }) => setD((data ?? { month: 0, total: 0 }) as Detail)); }, [kind, scopeId]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  const rows = d?.rows ?? [];
  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-modal="true" aria-label={title ?? meta.title} onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-[#F4F3FA] p-5 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] sm:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-gray-900">{title ?? meta.title}</h2>
          <button onClick={onClose} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-700 shadow">✕</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-indigo-50 p-4"><p className="text-xs font-bold text-indigo-700">{meta.month}</p><p className="mt-1 text-2xl font-extrabold text-indigo-950">{d ? Number(d.month).toLocaleString() : '—'}</p></div>
          <div className="rounded-2xl bg-teal-50 p-4"><p className="text-xs font-bold text-teal-800">{meta.total}</p><p className="mt-1 text-2xl font-extrabold text-teal-950">{d ? Number(d.total).toLocaleString() : '—'}</p></div>
        </div>
        {d?.series && <section className="mt-5 rounded-2xl bg-white p-4"><h3 className="mb-3 text-[15px] font-extrabold text-gray-900">Last 30 days</h3><Chart series={d.series} /></section>}
        {d && (kind !== 'views') && (
          <section className="mt-5">
            <h3 className="text-[15px] font-extrabold text-gray-900">{kind === 'plays' ? 'By song' : kind === 'org_checkins' ? 'Events in the last 30 days' : 'By event'}</h3>
            {rows.length === 0 ? <p className="mt-2 text-sm text-gray-500">{meta.empty}</p> : (
              <ul className="mt-2 divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
                {rows.map((r, i) => {
                  const right = kind === 'plays' ? `${Number(r.total).toLocaleString()} plays` : kind === 'org_checkins' ? `${r.checked_in} of ${r.tickets}` : kind === 'org_tickets' ? (r.capacity ? `${r.total} of ${r.capacity}` : `${r.total} sold`) : `${r.month} views`;
                  const sub = kind === 'plays' ? `${r.month} this month` : kind === 'org_tickets' ? `${r.month} this month` : kind === 'org_views' ? `${r.total} all time` : r.start ? new Date(String(r.start)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
                  const pct = kind === 'org_checkins' && Number(r.tickets) ? Math.round((Number(r.checked_in) / Number(r.tickets)) * 100) : kind === 'org_tickets' && r.capacity ? Math.min(100, Math.round((Number(r.total) / Number(r.capacity)) * 100)) : null;
                  return (
                    <li key={i} className="px-4 py-2.5">
                      <div className="flex items-center justify-between gap-3"><span className="min-w-0"><span className="block truncate text-sm font-medium text-gray-900">{String(r.title)}</span><span className="block text-xs text-gray-500">{sub}</span></span><span className="shrink-0 text-sm font-bold text-gray-900">{right}</span></div>
                      {pct !== null && <div className="mt-1.5 h-1.5 overflow-hidden rounded bg-gray-100"><div className="h-full rounded bg-gradient-to-r from-indigo-600 to-teal-500" style={{ width: `${pct}%` }} /></div>}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
        {d && kind === 'views' && Number(d.total) === 0 && <p className="mt-4 text-sm text-gray-500">{meta.empty}</p>}
      </div>
    </div>
  );
}
