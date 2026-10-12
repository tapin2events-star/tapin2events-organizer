import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { loadBookingMoney, type BookingEarning } from '../../lib/bookingEarnings';
import { money, rangeStart, RANGE_LABELS, type Range } from '../../lib/earnings';

interface ShopOrder { id: string; subtotal: number | null; created_at: string; items: { item_name?: string; total_price?: number; unit_price?: number; quantity?: number }[] | null }

// Resource Dashboard > Overview: what you've earned as an artist/resource, altogether and per event.
export default function ResourceEarningsOverview({ resourceId }: { resourceId: string }) {
  const { user } = useAuth();
  const [range, setRange] = useState<Range>('all');
  const [bookings, setBookings] = useState<BookingEarning[] | null>(null);
  const [shop, setShop] = useState<ShopOrder[]>([]);
  const [tips, setTips] = useState<{ amount: number; created_at: string }[]>([]);
  const [query, setQuery] = useState('');
  const [when, setWhen] = useState<'all' | 'upcoming' | 'past'>('all');

  useEffect(() => {
    loadBookingMoney().then((m) => setBookings(m.earnings));
    supabase.from('orders').select('id, subtotal, created_at, items').eq('resource_id', resourceId).is('event_id', null).eq('payment_status', 'paid').order('created_at', { ascending: false }).limit(500)
      .then(({ data }) => setShop((data ?? []) as ShopOrder[]));
    if (user?.email) supabase.from('tips').select('amount, created_at').eq('creator_email', user.email).eq('payment_status', 'paid').limit(1000)
      .then(({ data }) => setTips(((data ?? []) as { amount: number; created_at: string }[]).map((t) => ({ ...t, amount: Number(t.amount) || 0 }))));
  }, [resourceId, user?.email]);

  const start = rangeStart(range);
  const inRange = (iso: string | null) => !start || (!!iso && new Date(iso) >= start);
  const shopAmt = (o: ShopOrder) => (o.subtotal !== null && Number.isFinite(Number(o.subtotal)) ? Number(o.subtotal) : (o.items ?? []).reduce((n, i) => n + (Number(i.total_price ?? Number(i.unit_price ?? 0) * Number(i.quantity ?? 1)) || 0), 0));

  const s = useMemo(() => {
    const b = bookings ?? [];
    const paid = b.filter((r) => r.status !== 'upcoming' && inRange(r.paid_at));
    const bookingsEarned = paid.reduce((n, r) => n + r.amount - r.refunded, 0);
    const upcoming = b.filter((r) => r.status === 'upcoming');
    const shopRows = shop.filter((o) => inRange(o.created_at));
    const shopEarned = shopRows.reduce((n, o) => n + shopAmt(o), 0);
    const tipsEarned = tips.filter((t) => inRange(t.created_at)).reduce((n, t) => n + t.amount, 0);
    // Per event: everything you earned (or have coming) for each event.
    const byEvent = new Map<string, { title: string; date: string | null; paid: number; coming: number; count: number; group: string | null; refunded: number }>();
    for (const r of b) {
      if (r.status !== 'upcoming' && !inRange(r.paid_at)) continue;
      const key = r.event_id ?? r.booking_id;
      const cur = byEvent.get(key) ?? { title: r.event_title ?? 'Event', date: r.event_date, paid: 0, coming: 0, count: 0, group: null, refunded: 0 };
      if (r.status === 'upcoming') cur.coming += r.amount; else cur.paid += r.amount - r.refunded;
      cur.refunded += r.refunded;
      cur.count++;
      if (r.source === 'group') cur.group = r.group_name ?? 'Group';
      byEvent.set(key, cur);
    }
    return { bookingsEarned, paidCount: paid.filter((r) => r.status === 'paid').length, upcomingTotal: upcoming.reduce((n, r) => n + r.amount, 0), upcomingCount: upcoming.length, shopEarned, shopCount: shopRows.length, tipsEarned, byEvent };
  }, [bookings, shop, tips, range]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = s.bookingsEarned + s.shopEarned + s.tipsEarned;
  const nowMs = Date.now();
  const q = query.trim().toLowerCase();
  const eventRows = [...s.byEvent.entries()]
    .map(([id, v]) => ({ id, ...v }))
    .filter((r) => !q || r.title.toLowerCase().includes(q))
    .filter((r) => when === 'all' || (r.date ? (when === 'upcoming' ? new Date(r.date).getTime() >= nowMs : new Date(r.date).getTime() < nowMs) : when === 'upcoming'))
    .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

  if (bookings === null) return <div className="mt-6 h-40 animate-pulse rounded-2xl bg-gray-100" aria-busy="true" />;

  return (
    <div className="mt-6 flex flex-col gap-6">
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
          <button key={r} type="button" onClick={() => setRange(r)} className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${range === r ? 'bg-marigold text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{RANGE_LABELS[r]}</button>
        ))}
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-marigold to-teal p-5 text-white">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-90">Earned as an artist / resource · {RANGE_LABELS[range].toLowerCase()}</p>
        <p className="mt-1 font-display text-4xl font-extrabold">{money(total)}</p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
          {[['Bookings', s.bookingsEarned, `${s.paidCount} paid`], ['Shop', s.shopEarned, `${s.shopCount} order${s.shopCount === 1 ? '' : 's'}`], ['Tips', s.tipsEarned, 'From your videos']].map(([l, v, sub]) => (
            <div key={l as string} className="rounded-xl bg-white/15 px-3 py-2">
              <span className="block text-xs opacity-90">{l as string}</span>
              <span className="block font-semibold">{money(v as number)}</span>
              <span className="block text-[11px] opacity-80">{sub as string}</span>
            </div>
          ))}
        </div>
        {s.upcomingTotal > 0 && <p className="mt-3 text-sm opacity-95">+ {money(s.upcomingTotal)} coming up from {s.upcomingCount} accepted booking{s.upcomingCount === 1 ? '' : 's'} not paid yet.</p>}
      </div>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h3 className="font-display text-lg font-bold text-gray-900">By event</h3>
          <Link to="/organizer/earnings" className="text-sm font-medium text-marigold">All your earnings ›</Link>
        </div>
        {s.byEvent.size > 0 && (
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search events" aria-label="Search events" className="min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 sm:w-56 sm:text-sm" />
            <div className="flex gap-1.5">
              {([['all', 'All'], ['upcoming', 'Upcoming'], ['past', 'Past']] as const).map(([k, l]) => (
                <button key={k} onClick={() => setWhen(k)} className={`rounded-full px-3 py-1.5 text-sm font-medium ${when === k ? 'bg-marigold text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{l}</button>
              ))}
            </div>
          </div>
        )}
        {eventRows.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">{s.byEvent.size ? 'No events match.' : `No paid bookings ${range === 'all' ? 'yet' : 'in this period'}. When organizers book and pay you, each event shows up here.`}</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {eventRows.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-gray-900">{r.title}</span>
                  <span className="text-xs text-gray-500">
                    {r.date ? new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No date'}
                    {r.group ? ` · ${r.group} share` : ''}{r.count > 1 ? ` · ${r.count} bookings` : ''}{r.refunded > 0 ? ` · ${money(r.refunded)} refunded` : ''}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-semibold text-gray-900">{money(r.paid)}</span>
                  {r.coming > 0 && <span className="block text-xs font-medium text-amber-700">+ {money(r.coming)} coming</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="text-xs text-gray-400">Bookings include your share of group bookings. Stripe sends payouts to your bank on its own schedule.</p>
    </div>
  );
}
