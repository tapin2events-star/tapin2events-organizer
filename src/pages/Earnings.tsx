import { useEffect, useMemo, useState } from 'react';
import { MySplitEarnings } from '../components/business/RevenueSplits';
import { useFeature } from '../lib/preview';
import BackButton from '../components/BackButton';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { earningsRows, eventTotal, loadEarnings, money, shopAmount, monthly, RANGE_LABELS, summarize, type EarningsData, type Range } from '../lib/earnings';
import { downloadCsv } from '../lib/csv';
import { loadBookingMoney, summarizeBookings, type BookingCost, type BookingEarning } from '../lib/bookingEarnings';

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
  const splitsOn = useFeature('splits');
  const { user } = useAuth();
  const [data, setData] = useState<EarningsData | null>(null);
  const [range, setRange] = useState<Range>('all');
  const [bookingMoney, setBookingMoney] = useState<{ earnings: BookingEarning[]; costs: BookingCost[] } | null>(null);
  const [evQuery, setEvQuery] = useState('');
  const [evWhen, setEvWhen] = useState<'all' | 'upcoming' | 'past'>('all');
  const [evSort, setEvSort] = useState<'newest' | 'earned' | 'tickets'>('newest');
  const [evEarningOnly, setEvEarningOnly] = useState(false);
  useEffect(() => { if (user?.email) loadBookingMoney().then(setBookingMoney); }, [user?.email]);
  const bk = useMemo(() => (bookingMoney ? summarizeBookings(bookingMoney.earnings, bookingMoney.costs, range) : null), [bookingMoney, range]);

  useEffect(() => {
    if (!user?.id || !user.email) return;
    loadEarnings(user.id, user.email).then(setData);
  }, [user?.id, user?.email]);

  const summary = useMemo(() => (data ? summarize(data, range) : null), [data, range]);
  const months = useMemo(() => (data ? monthly(data) : []), [data]);

  function exportCsv() {
    if (!data) return;
    downloadCsv(`tapin-earnings-${range}-${new Date().toISOString().slice(0, 10)}.csv`, earningsRows(data, range));
  }

  if (!data || !summary) return <div className="mx-auto max-w-5xl"><p className="text-muted">Loading your earnings…</p></div>;

  const { totals, tips, shop, shopOrders, eventsEarned, earned, checkInRate, byEvent } = summary;
  const maxMonth = Math.max(...months.map((m) => m.total), 1);
  const allRows = data.events
    .filter((e) => byEvent.has(e.id) || (range === 'all' && e.status !== 'draft'))
    .map((e) => {
      const s = byEvent.get(e.id);
      return { e, s, total: eventTotal(s) };
    });
  // By event filters
  const nowMs = Date.now();
  const q = evQuery.trim().toLowerCase();
  const rows = allRows
    .filter(({ e }) => !q || e.title.toLowerCase().includes(q) || (e.location_name ?? '').toLowerCase().includes(q))
    .filter(({ e }) => {
      if (evWhen === 'all') return true;
      const end = new Date(e.end_date || e.start_date || 0).getTime();
      return evWhen === 'upcoming' ? end >= nowMs : end < nowMs;
    })
    .filter(({ total, s }) => !evEarningOnly || total > 0 || (s?.ticketsSold ?? 0) > 0)
    .sort((a, b) => evSort === 'earned' ? b.total - a.total : evSort === 'tickets' ? (b.s?.ticketsSold ?? 0) - (a.s?.ticketsSold ?? 0) : new Date(b.e.start_date || 0).getTime() - new Date(a.e.start_date || 0).getTime());
  const hasActivity = earned > 0 || totals.ticketsSold > 0 || shopOrders.length > 0;
  const hasBookings = !!bk && (bk.paid.length > 0 || bk.upcoming.length > 0);
  const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');

  return (
    <div className="mx-auto max-w-5xl">
      <BackButton fallback="/organizer" fallbackLabel="Organizer Dashboard" />
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-bone">Earnings</h1>
          <p className="mt-1 text-muted">What you've earned on TapIN, from your events and from being booked.</p>
        </div>
        <button type="button" onClick={exportCsv} disabled={!hasActivity} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-bone hover:border-marigold disabled:opacity-50">
          Download CSV
        </button>
      </div>
      {splitsOn && <MySplitEarnings />}

      <div className="mt-4 flex flex-wrap gap-1.5">
        {(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
          <button key={r} type="button" onClick={() => setRange(r)} className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${range === r ? 'bg-marigold text-white' : 'bg-gray-100 text-muted hover:bg-gray-200'}`}>
            {RANGE_LABELS[r]}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-2xl bg-gradient-to-br from-marigold to-teal p-5 text-white">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-90">Total earned on TapIN · {RANGE_LABELS[range].toLowerCase()}</p>
        <p className="mt-1 font-display text-4xl font-extrabold">{money(earned + (bk?.earned ?? 0))}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          {[['Events', eventsEarned, '#events'], ['Bookings', bk?.earned ?? 0, '#bookings'], ['Shop', shop, '#shop'], ['Tips', tips, '#events']].map(([label, value, href]) => (
            <a key={label as string} href={href as string} className="rounded-xl bg-white/15 px-3 py-2 hover:bg-white/25">
              <span className="block text-xs opacity-90">{label as string}</span>
              <span className="block font-semibold">{money(value as number)}</span>
            </a>
          ))}
        </div>
        {bk && bk.upcomingTotal > 0 && <p className="mt-2 text-xs opacity-90">Plus {money(bk.upcomingTotal)} in accepted bookings not paid yet.</p>}
      </div>

      <h2 id="events" className="mt-6 scroll-mt-20 font-display text-xl font-bold text-bone">From your events</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat big label={`Earned from events · ${RANGE_LABELS[range].toLowerCase()}`} value={money(eventsEarned)} sub="Before Stripe payouts. Buyer service fees aren't included." />
        <Stat label="Ticket sales" value={money(totals.ticketRevenue)} sub={`${totals.paidTickets} paid ticket${totals.paidTickets === 1 ? '' : 's'}`} />
        <Stat label="Merch & shipping" value={money(totals.productRevenue)} />
        <Stat label="Vendor fees" value={money(totals.vendorRevenue)} />
        <Stat label="Donations & support" value={money(totals.donationRevenue)} sub="What you receive, after refunds" />
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

      {bk && hasBookings && (
        <section id="bookings" className="mt-8 scroll-mt-20">
          <h2 className="font-display text-xl font-bold text-bone">From being booked</h2>
          <p className="text-sm text-muted">Bookings paid through TapIN, including your share of group bookings.</p>
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat big label={`Earned from bookings · ${RANGE_LABELS[range].toLowerCase()}`} value={money(bk.earned)} sub={`${bk.paidCount} paid booking${bk.paidCount === 1 ? '' : 's'} · sent to your bank through Stripe`} />
            <Stat label="Coming up" value={money(bk.upcomingTotal)} sub={`${bk.upcoming.length} accepted, not paid yet`} />
          </div>
          <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr><th className="px-4 py-2.5 font-semibold">Event</th><th className="px-4 py-2.5 font-semibold">Booked by</th><th className="px-4 py-2.5 font-semibold">As</th><th className="px-4 py-2.5 text-right font-semibold">Amount</th><th className="px-4 py-2.5 font-semibold">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[...bk.upcoming, ...bk.paid].map((r) => (
                  <tr key={`${r.booking_id}-${r.source}`}>
                    <td className="px-4 py-2.5"><span className="block font-medium text-gray-900">{r.event_title ?? 'Event'}</span><span className="text-xs text-gray-500">{fmtDate(r.event_date)}</span></td>
                    <td className="px-4 py-2.5 text-gray-700">{r.organizer_name ?? '—'}</td>
                    <td className="px-4 py-2.5 text-gray-700">{r.source === 'group' ? <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">{r.group_name ?? 'Group'} share</span> : 'You'}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{money(r.amount - r.refunded)}{r.refunded > 0 && r.status !== 'refunded' ? <span className="block text-xs font-normal text-gray-500">{money(r.refunded)} refunded</span> : null}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.status === 'paid' ? 'bg-green-100 text-green-800' : r.status === 'refunded' ? 'bg-gray-100 text-gray-600' : 'bg-amber-100 text-amber-800'}`}>
                        {r.status === 'paid' ? `Paid ${fmtDate(r.paid_at)}` : r.status === 'refunded' ? 'Refunded' : 'Awaiting payment'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {shopOrders.length > 0 && (
        <section id="shop" className="mt-8 scroll-mt-20">
          <h2 className="font-display text-xl font-bold text-bone">From your shop</h2>
          <p className="text-sm text-muted">Products sold from your artist or resource profile (including shipping).</p>
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat big label={`Shop sales · ${RANGE_LABELS[range].toLowerCase()}`} value={money(shop)} sub={`${shopOrders.length} order${shopOrders.length === 1 ? '' : 's'}`} />
          </div>
          <ul className="mt-3 flex flex-col gap-2">
            {shopOrders.slice(0, 20).map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3 text-sm">
                <span className="min-w-0"><span className="block truncate font-medium text-gray-900">{(o.items ?? []).map((i) => i.item_name).filter(Boolean).join(', ') || 'Order'}</span><span className="text-xs text-gray-500">{o.customer_name || o.customer_email} · {fmtDate(o.created_at)}</span></span>
                <span className="shrink-0 font-semibold text-gray-900">{money(shopAmount(o))}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {bk && bk.costRows.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl font-bold text-bone">Booking costs</h2>
          <p className="text-sm text-muted">What you've paid artists and resources for your events (booking price plus TapIN fees, minus refunds).</p>
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat big label={`Paid for bookings · ${RANGE_LABELS[range].toLowerCase()}`} value={money(bk.costTotal)} sub={`${bk.costRows.length} booking${bk.costRows.length === 1 ? '' : 's'}`} />
          </div>
          <ul className="mt-3 flex flex-col gap-2">
            {bk.costRows.map((c) => {
              const eventEarned = c.event_id ? eventTotal(byEvent.get(c.event_id)) : 0;
              const eventCosts = c.event_id ? bk.costByEvent.get(c.event_id) ?? 0 : 0;
              return (
                <li key={c.booking_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white p-3 text-sm">
                  <span className="min-w-0">
                    <span className="block font-medium text-gray-900">{c.resource_name ?? 'Booking'} · {c.event_title ?? 'Event'}</span>
                    <span className="text-xs text-gray-500">{money(c.price)} + {money(c.fees)} fees{c.refunded > 0 ? ` · ${money(c.refunded)} refunded` : ''} · {fmtDate(c.paid_at)}</span>
                  </span>
                  <span className="text-right">
                    <span className="block font-semibold text-gray-900">{money(c.price + c.fees - c.refunded)}</span>
                    {c.event_id && <span className="text-xs text-gray-500">Event net: {money(eventEarned - eventCosts)}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="mt-6">
        <h2 className="font-display text-xl font-bold text-bone">By event</h2>
        {allRows.length > 0 && (
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <input value={evQuery} onChange={(e) => setEvQuery(e.target.value)} placeholder="Search events" aria-label="Search events"
              className="min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 sm:w-56 sm:text-sm" />
            <div className="flex flex-wrap gap-1.5">
              {([['all', 'All'], ['upcoming', 'Upcoming'], ['past', 'Past']] as const).map(([k, l]) => (
                <button key={k} onClick={() => setEvWhen(k)} className={`rounded-full px-3 py-1.5 text-sm font-medium ${evWhen === k ? 'bg-marigold text-white' : 'bg-gray-100 text-muted hover:bg-gray-200'}`}>{l}</button>
              ))}
            </div>
            <select value={evSort} onChange={(e) => setEvSort(e.target.value as typeof evSort)} aria-label="Sort events" className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-700">
              <option value="newest">Newest first</option>
              <option value="earned">Highest earned</option>
              <option value="tickets">Most tickets</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={evEarningOnly} onChange={(e) => setEvEarningOnly(e.target.checked)} className="h-4 w-4 accent-marigold" /> With sales only</label>
          </div>
        )}
        {rows.length === 0 ? (
          <p className="mt-2 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-muted">{allRows.length > 0 ? 'No events match these filters.' : `No sales or registrations ${range === 'all' ? 'yet' : 'in this period'}.`}</p>
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
                    {s?.ticketsSold ?? 0}{e.max_capacity ? ` / ${e.max_capacity}` : ''} tickets · {s?.checkedIn ?? 0} checked in{(s?.donationRevenue ?? 0) > 0 ? ` · ${money(s!.donationRevenue)} gifts` : ''}
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
                    <th className="px-4 py-2.5 text-right font-semibold">Gifts $</th>
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
                      <td className="px-4 py-2.5 text-right text-gray-700">{money(s?.donationRevenue ?? 0)}</td>
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
        Earnings show what you keep from tickets and products (including shipping), vendor fees, donations and support (after refunds and any fees deducted), bookings, shop sales from your artist or resource profile, and tips. Buyer service fees aren't included. Stripe sends payouts to your bank on its own schedule.
      </p>
    </div>
  );
}
