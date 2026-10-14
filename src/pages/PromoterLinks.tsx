import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import BackButton from '../components/BackButton';
import ShareQR from '../components/ShareQR';
import { ListSkeleton } from '../components/ui/Skeleton';
import { shortUrl } from '../components/promote/PromoteTab';

interface Row { id: string; code: string; label: string; event_id: string; event_title: string; start_date: string | null; commission_pct: number | null; active: boolean; visits: number; tickets: number; revenue: number }
const money = (n: number) => `$${(Number(n) || 0).toFixed(2).replace(/\.00$/, '')}`;

// My promoter links: links organizers gave you, with your visits, ticket sales and commission.
export default function PromoterLinks() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    supabase.rpc('my_promoter_links').then(({ data }) => setRows(((data ?? []) as Row[]).map((r) => ({ ...r, visits: Number(r.visits), tickets: Number(r.tickets), revenue: Number(r.revenue), commission_pct: r.commission_pct === null ? null : Number(r.commission_pct) }))));
  }, []);
  const earned = (rows ?? []).reduce((n, r) => n + (r.commission_pct ? (r.revenue * r.commission_pct) / 100 : 0), 0);
  return (
    <div className="mx-auto max-w-3xl">
      <BackButton fallback="/profile" fallbackLabel="Profile" />
      <h1 className="mt-3 font-display text-3xl font-extrabold text-bone">📣 My promoter links</h1>
      <p className="mt-1 text-sm text-muted">Share your links. Tickets bought within 7 days of someone tapping your link count for you.</p>
      {msg && <p role="status" className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">{msg}</p>}
      {rows === null ? <ListSkeleton rows={3} className="mt-4" /> : rows.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-muted">No promoter links yet. When an organizer gives you one, it shows up here.</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-gray-200 bg-surface p-3"><p className="text-xl font-extrabold text-bone">{rows.reduce((n, r) => n + r.tickets, 0)}</p><p className="text-xs text-muted">tickets sold</p></div>
            <div className="rounded-xl border border-gray-200 bg-surface p-3"><p className="text-xl font-extrabold text-bone">{money(rows.reduce((n, r) => n + r.revenue, 0))}</p><p className="text-xs text-muted">in sales</p></div>
            <div className="rounded-xl border border-gray-200 bg-surface p-3"><p className="text-xl font-extrabold text-green-700">{money(earned)}</p><p className="text-xs text-muted">commission</p></div>
          </div>
          <ul className="mt-4 flex flex-col gap-2">
            {rows.map((r) => (
              <li key={r.id} className={`rounded-2xl border border-gray-200 bg-surface p-3 ${r.active ? '' : 'opacity-60'}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link to={`/events/${r.event_id}`} className="block truncate font-semibold text-bone hover:text-marigold">{r.event_title}</Link>
                    <p className="text-xs text-muted">{r.start_date ? new Date(r.start_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : ''}{r.commission_pct ? ` · ${r.commission_pct}% commission` : ''}{!r.active ? ' · paused by the organizer' : ''}</p>
                  </div>
                  <p className="shrink-0 text-right text-sm"><span className="font-bold text-bone">{r.tickets} ticket{r.tickets === 1 ? '' : 's'}</span><span className="block text-xs text-muted">{r.visits} visits{r.commission_pct ? ` · ${money((r.revenue * r.commission_pct) / 100)} earned` : ''}</span></p>
                </div>
                {r.active && (
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <button onClick={() => { navigator.clipboard?.writeText(shortUrl(r.code)); setMsg('Link copied.'); setTimeout(() => setMsg(null), 2000); }} className="font-medium text-marigold">Copy my link</button>
                    <ShareQR path={`/p/${r.code}`} title={r.event_title} subtitle="Scan for tickets" label="QR" className="font-medium text-marigold" />
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">Commission is paid by the organizer.</p>
        </>
      )}
    </div>
  );
}
