import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { earningsCsv, loadEarnings, money, monthly, RANGE_LABELS, summarize, type EarningsData, type Range } from '../lib/earnings';

function Stat({ label, value, sub, big = false }: { label: string; value: string; sub?: string; big?: boolean }) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-4 ${big ? 'col-span-2' : ''}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-1 font-display font-extrabold text-gray-900 ${big ? 'text-4xl' : 'text-2xl'}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

export default function Earnings() {
  const { user } = useAuth();
  const [data, setData] = useState<EarningsData | null>(null);
  const [range, setRange] = useState<Range>('all');

  useEffect(() => {
    if (!user?.id || !user.email) return;
    loadEarnings(user.id, user.email).then(setData);
  }, [user?.id, user?.email]);

  const summary = useMemo(() => (data ? summarize(data, range) : null), [data, range]);
  const months = useMemo(() => (data ? monthly(data) : []), [data]);

  function downloadCsv() {
    if (!data) return;
    const blob = new Blob([earningsCsv(data, range)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tapin-earnings-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  if (!data || !summary) return <div className="mx-auto max-w-5xl"><p className="text-muted">Loading your earnings…</p></div>;

  const { totals, tips, earned, checkInRate, byEvent } = summary;
  const maxMonth = Math.max(...months.map((m) => m.total), 1);
  const rows = data.events
    .filter((e) => byEvent.has(e.id) || (range === 'all' && e.status !== 'draft'))
    .map((e) => {
      const s = byEvent.get(e.id);
      return { e, s, total: s ? s.ticketRevenue + s.productRevenue + s.vendorRevenue : 0 };
    });
  const hasActivity = earned > 0 || totals.ticketsSold > 0;

  return (
    <div className="mx-auto max-w-5xl">
      <Link to="/organizer" className="-my-2 inline-block py-2 text-sm font-medium text-marigold">&larr; Organizer Dashboard</Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-bone">Earnings</h1>
          <p className="mt-1 text-muted">What you've earned across all your events.</p>
        </div>
        <button type="button" onClick={downloadCsv} disabled={!hasActivity} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-bone hover:border-marigold disabled:opacity-50">
          Download CSV
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
          <button key={r} type="button" onClick={() => setRange(r)} className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${range === r ? 'bg-marigold text-white' : 'bg-gray-100 text-muted hover:bg-gray-200'}`}>
            {RANGE_LABELS[r]}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat big label={`Total earned · ${RANGE_LABELS[range].toLowerCase()}`} value={money(earned)} sub="Before Stripe payouts. Buyer service fees aren't included." />
        <Stat label="Ticket sales" value={money(totals.ticketRevenue)} sub={`${totals.paidTickets} paid ticket${totals.paidTickets === 1 ? '' : 's'}`} />
        <Stat label="Merch & shipping" value={money(totals.productRevenue)} />
        <Stat label="Vendor fees" value={money(totals.vendorRevenue)} />
        <Stat label="Tips" value={money(tips)} sub="From your videos" />
        <Stat label="Tickets & registrations" value={String(totals.ticketsSold)} sub={`${totals.paidTickets} paid · ${totals.freeRegistrations} free`} />
        <Stat label="Check-in rate" value={checkInRate === null ? '—' : `${Math.round(checkInRate * 100)}%`} sub={checkInRate === null ? 'After your events start' : 'Ticket holders who showed up'} />
      </div>

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-sm font-semibold text-gray-900">Last 12 months</p>
        <div className="mt-3 flex h-40 items-end gap-1.5" role="img" aria-label="Earnings by month for the last 12 months">
          {months.map((m) => (
            <div key={m.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${m.label} ${m.year}: ${money(m.total)}`}>
              {m.total > 0 && <span className="text-[10px] font-medium text-gray-500">{money(m.total)}</span>}
              <div className={`w-full rounded-t ${m.total > 0 ? 'bg-gradient-to-t from-marigold to-teal' : 'bg-gray-100'}`} style={{ height: `${Math.max((m.total / maxMonth) * 100, 3)}%` }} />
              <span className="text-[11px] text-gray-500">{m.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <h2 className="font-display text-xl font-bold text-bone">By event</h2>
        {rows.length === 0 ? (
          <p className="mt-2 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-muted">No sales or registrations {range === 'all' ? 'yet' : 'in this period'}.</p>
        ) : (
          <>
            {/* Phones: cards. Wider screens: a table. */}
            <div className="mt-2 flex flex-col gap-2 md:hidden">
              {rows.map(({ e, s, total }) => (
                <Link key={e.id} to={`/organizer/events/${e.id}`} className="rounded-xl border border-gray-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 font-semibold text-gray-900">{e.title}</p>
                    <p className="shrink-0 font-display text-lg font-extrabold text-gray-900">{money(total)}</p>
                  </div>
                  <p className="text-xs text-gray-500">
                    {e.start_date ? new Date(e.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No date'}
                    {e.status === 'cancelled' && ' · Cancelled'}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    {s?.ticketsSold ?? 0}{e.max_capacity ? ` / ${e.max_capacity}` : ''} tickets · {s?.checkedIn ?? 0} checked in
                  </p>
                </Link>
              ))}
            </div>
            <div className="mt-2 hidden overflow-x-auto rounded-xl border border-gray-200 bg-white md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Event</th>
                    <th className="px-4 py-2.5 font-semibold">Tickets</th>
                    <th className="px-4 py-2.5 font-semibold">Checked in</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Tickets $</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Merch $</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Vendors $</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ e, s, total }) => (
                    <tr key={e.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <Link to={`/organizer/events/${e.id}`} className="font-medium text-gray-900 hover:text-marigold">{e.title}</Link>
                        <p className="text-xs text-gray-500">
                          {e.start_date ? new Date(e.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No date'}
                          {e.status === 'cancelled' && ' · Cancelled'}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-gray-700">{s?.ticketsSold ?? 0}{e.max_capacity ? ` / ${e.max_capacity}` : ''}</td>
                      <td className="px-4 py-2.5 text-gray-700">{s?.checkedIn ?? 0}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{money(s?.ticketRevenue ?? 0)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{money(s?.productRevenue ?? 0)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{money(s?.vendorRevenue ?? 0)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{money(total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      <p className="mt-4 text-xs text-muted">
        Earnings show what buyers paid for your tickets and products (including shipping), vendor fees, and tips. Stripe sends payouts to your bank on its own schedule. Only events you organize are included.
      </p>
    </div>
  );
}
