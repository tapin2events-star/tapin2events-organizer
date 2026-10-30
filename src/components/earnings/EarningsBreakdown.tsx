import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

// Earnings breakdown (preview: earnings_v2), from one record of every way money reaches someone (earnings_summary):
// the period's total, all time, waiting to be paid (held until payouts are connected), a bar per source, each
// member's share (groups), and every transaction. Used on the Earnings page and when tapping a dashboard's Earned tile.
export type EarningsScope = 'me' | 'resource' | 'group' | 'organizer' | 'org';
interface Summary {
  total: number; all_time: number; held: number;
  by_source: { source: string; amount: number; count: number }[];
  items: { source: string; title: string; amount: number; status: 'sent' | 'held'; at: string; who: string | null }[];
  members?: { email: string; name: string | null; amount: number; held: number }[] | null;
}
const SOURCES: Record<string, { label: string; icon: string; color: string }> = {
  bookings: { label: 'Bookings', icon: '📅', color: 'bg-indigo-500' },
  music: { label: 'Music', icon: '💿', color: 'bg-violet-500' },
  tips: { label: 'Tips', icon: '💛', color: 'bg-amber-500' },
  merch: { label: 'Merch & shop', icon: '🛍️', color: 'bg-pink-500' },
  group_shares: { label: 'Group shares', icon: '🎤', color: 'bg-teal-500' },
  org_shares: { label: 'Organization shares', icon: '🏢', color: 'bg-cyan-600' },
  ticket_splits: { label: 'Ticket splits', icon: '🎟️', color: 'bg-sky-500' },
  commissions: { label: 'Promoter commissions', icon: '📣', color: 'bg-orange-500' },
  tickets: { label: 'Tickets', icon: '🎟️', color: 'bg-indigo-500' },
  donations: { label: 'Donations', icon: '🤲', color: 'bg-emerald-500' },
  vendor_fees: { label: 'Vendor fees', icon: '🧾', color: 'bg-rose-500' },
};
const RANGES = [
  { key: 'month', label: 'This month' }, { key: 'last', label: 'Last month' }, { key: 'year', label: 'This year' }, { key: 'all', label: 'All time' },
] as const;
type RangeKey = (typeof RANGES)[number]['key'];
function bounds(k: RangeKey): [string | null, string | null] {
  const now = new Date(), m0 = new Date(now.getFullYear(), now.getMonth(), 1);
  if (k === 'month') return [m0.toISOString(), null];
  if (k === 'last') return [new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString(), m0.toISOString()];
  if (k === 'year') return [new Date(now.getFullYear(), 0, 1).toISOString(), null];
  return [null, null];
}
const usd = (n: number) => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function EarningsBreakdown({ scope, scopeId, showConnect = true }: { scope: EarningsScope; scopeId?: string | null; showConnect?: boolean }) {
  const [range, setRange] = useState<RangeKey>('month');
  const [s, setS] = useState<Summary | null>(null);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    const [from, to] = bounds(range);
    setS(null);
    supabase.rpc('earnings_summary', { p_scope: scope, p_scope_id: scopeId ?? null, p_from: from, p_to: to })
      .then(({ data }) => setS((data ?? { total: 0, all_time: 0, held: 0, by_source: [], items: [] }) as Summary));
  }, [scope, scopeId, range]);
  const max = Math.max(1, ...(s?.by_source ?? []).map((b) => Number(b.amount)));
  const items = s ? (showAll ? s.items : s.items.slice(0, 8)) : [];
  return (
    <div className="flex flex-col gap-5">
      {s && Number(s.held) > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div><p className="text-xs font-bold uppercase tracking-wide text-amber-800">Waiting to be paid</p>
            <p className="text-2xl font-extrabold text-amber-950">{usd(s.held)}</p>
            <p className="text-xs text-amber-900">Held until payouts are connected. Everything waiting is sent automatically once they are.</p></div>
          {showConnect && <Link to="/profile#payouts" className="min-h-[44px] rounded-full bg-[#0F1B3D] px-4 py-3 text-sm font-semibold text-white">Connect payouts</Link>}
        </div>
      )}
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Period">
        {RANGES.map((r) => (
          <button key={r.key} role="tab" aria-selected={range === r.key} onClick={() => setRange(r.key)}
            className={`min-h-[36px] shrink-0 rounded-full px-3.5 text-sm font-semibold ${range === r.key ? 'bg-[#0F1B3D] text-white' : 'border border-gray-300 bg-white text-gray-700'}`}>{r.label}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-indigo-50 p-4"><p className="text-xs font-bold text-indigo-700">{RANGES.find((r) => r.key === range)!.label}</p><p className="mt-1 text-2xl font-extrabold text-indigo-950">{s ? usd(s.total) : '—'}</p></div>
        <div className="rounded-2xl bg-teal-50 p-4"><p className="text-xs font-bold text-teal-800">All time</p><p className="mt-1 text-2xl font-extrabold text-teal-950">{s ? usd(s.all_time) : '—'}</p></div>
      </div>
      <section aria-label="By source">
        <h3 className="text-[15px] font-extrabold text-gray-900">Where it came from</h3>
        {s && s.by_source.length === 0 ? <p className="mt-2 text-sm text-gray-500">Nothing yet for this period.</p> : (
          <ul className="mt-3 flex flex-col gap-3">
            {(s?.by_source ?? []).map((b) => { const meta = SOURCES[b.source] ?? { label: b.source, icon: '•', color: 'bg-gray-400' }; const pct = s && Number(s.total) > 0 ? Math.round((Number(b.amount) / Number(s.total)) * 100) : 0; return (
              <li key={b.source}>
                <div className="flex items-center justify-between text-sm"><span className="font-semibold text-gray-900">{meta.icon} {meta.label} <span className="font-normal text-gray-500">· {b.count}</span></span><span className="font-bold text-gray-900">{usd(b.amount)} <span className="text-xs font-normal text-gray-500">{pct}%</span></span></div>
                <div className="mt-1.5 h-2 overflow-hidden rounded bg-gray-100"><div className={`h-full rounded ${meta.color}`} style={{ width: `${Math.max(3, (Number(b.amount) / max) * 100)}%` }} /></div>
              </li>
            ); })}
          </ul>
        )}
      </section>
      {s?.members && s.members.length > 0 && (
        <section aria-label="Members' shares">
          <h3 className="text-[15px] font-extrabold text-gray-900">Members&apos; shares</h3>
          <ul className="mt-2 divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
            {s.members.map((m) => (
              <li key={m.email} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0 truncate text-gray-900">{m.name || m.email}</span>
                <span className="shrink-0 text-right"><span className="font-bold text-gray-900">{usd(m.amount)}</span>{Number(m.held) > 0 && <span className="block text-xs text-amber-700">{usd(m.held)} held</span>}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section aria-label="Transactions">
        <h3 className="text-[15px] font-extrabold text-gray-900">Transactions</h3>
        {s && s.items.length === 0 ? <p className="mt-2 text-sm text-gray-500">No transactions for this period.</p> : (
          <ul className="mt-2 divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
            {items.map((it, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-lg" aria-hidden="true">{SOURCES[it.source]?.icon ?? '•'}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-gray-900">{it.title}</span>
                  <span className="block text-xs text-gray-500">{new Date(it.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}{it.who ? ` · ${it.who}` : ''}</span></span>
                <span className="shrink-0 text-right"><span className="block text-sm font-bold text-gray-900">{usd(it.amount)}</span>
                  <span className={`text-[11px] font-semibold ${it.status === 'held' ? 'text-amber-700' : 'text-green-700'}`}>{it.status === 'held' ? 'Held' : 'Sent'}</span></span>
              </li>
            ))}
          </ul>
        )}
        {s && s.items.length > 8 && !showAll && <button onClick={() => setShowAll(true)} className="mt-2 text-sm font-semibold text-indigo-600">Show all {s.items.length}</button>}
      </section>
    </div>
  );
}

// Full-screen sheet for a dashboard's Earned tile.
export function EarningsSheet({ scope, scopeId, title, onClose }: { scope: EarningsScope; scopeId?: string | null; title: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-[#F4F3FA] p-5 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] sm:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-gray-900">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-700 shadow">✕</button>
        </div>
        <EarningsBreakdown scope={scope} scopeId={scopeId} />
      </div>
    </div>
  );
}
