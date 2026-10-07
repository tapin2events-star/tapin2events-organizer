import { useEffect, useMemo, useState } from 'react';
import CancelRegistration, { canCancelRegistration } from '../components/CancelRegistration';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import MyProductOrders from '../components/products/MyProductOrders';
import MyVendorApplications from '../components/MyVendorApplications';
import BookingsSection from '../components/bookings/BookingsSection';
import MyTipsSent from '../components/MyTipsSent';
import { seatText } from '../lib/seats';
import { ListSkeleton, LoadingRegion, Skeleton } from '../components/ui/Skeleton';

interface MyTicket {
  id: string;
  event_id: string;
  ticket_type: string;
  status: string;
  price_paid: number;
  quantity: number;
  section_name: string | null;
  seat_assignment: string | null;
  attendee_email: string;
  event_title: string;
  event_start_date: string | null;
  event_poster_url: string | null;
  event_location_name: string | null;
  event_is_online: boolean;
}

const STATUS_STYLES: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  refunded: 'bg-gray-100 text-gray-800',
  pending: 'bg-orange-100 text-orange-800',
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// A plain <a download> isn't reliably honored across browsers for a
// cross-origin file. Fetching the bytes and downloading from a same-origin
// blob URL is the robust way to do this; if that ever fails for any reason,
// fall back to just opening it so the person isn't left with a dead end.
async function downloadBlob(url: string, filename: string, init?: RequestInit) {
  try {
    const res = await fetch(url, init);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(url, '_blank');
  }
}


export default function MyActivity() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [tickets, setTickets] = useState<MyTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [emailedId, setEmailedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'pending' | 'cancelled' | 'refunded'>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'upcoming' | 'past'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'general' | 'seated' | 'series_pass'>('all');
  const [search, setSearch] = useState('');
  // One place for everything you've done on TapIN, filtered by chips. The view
  // lives in the URL hash so email links (e.g. /activity#orders) open it.
  type View = 'all' | 'tickets' | 'orders' | 'bookings' | 'vendor' | 'tips';
  const viewFromHash = (): View => {
    const h = window.location.hash.replace('#', '');
    return (['tickets', 'orders', 'bookings', 'vendor', 'tips'] as string[]).includes(h) ? (h as View) : 'all';
  };
  const [view, setViewState] = useState<View>(viewFromHash);
  const [counts, setCounts] = useState<{ orders: number; bookings: number; vendor: number; tips: number } | null>(null);
  const [bookingSplit, setBookingSplit] = useState({ mine: 0, received: 0, pending: 0 });
  function setView(v: View) {
    setViewState(v);
    window.history.replaceState(null, '', v === 'all' ? window.location.pathname : `${window.location.pathname}#${v}`);
  }
  useEffect(() => {
    const onHash = () => setViewState(viewFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    if (!user?.email) return;
    const email = user.email;
    Promise.all([
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('customer_email', email).contains('items', JSON.stringify([{ type: 'product' }])),
      supabase.from('resource_bookings').select('id', { count: 'exact', head: true }).eq('organizer_email', email),
      supabase.from('event_vendor_applications').select('id', { count: 'exact', head: true }).eq('resource_email', email),
      supabase.from('tips').select('id', { count: 'exact', head: true }).eq('tipper_email', email).in('payment_status', ['paid', 'refunded']),
      supabase.from('resource_bookings').select('id', { count: 'exact', head: true }).eq('resource_email', email).neq('status', 'deleted'),
      supabase.from('resource_bookings').select('id', { count: 'exact', head: true }).eq('resource_email', email).eq('status', 'pending'),
    ]).then(([o, b, v, t, r, rp]) => {
      setBookingSplit({ mine: b.count ?? 0, received: r.count ?? 0, pending: rp.count ?? 0 });
      setCounts({ orders: o.count ?? 0, bookings: (b.count ?? 0) + (r.count ?? 0), vendor: v.count ?? 0, tips: t.count ?? 0 });
    })
      .catch(() => setCounts({ orders: 0, bookings: 0, vendor: 0, tips: 0 }));
  }, [user?.email]);

  useEffect(() => {
    if (authLoading) return; // don't judge auth state until it's actually finished checking
    if (!user) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    if (!user.email) return;
    (async () => {
      const { data: ticketRows, error: ticketsError } = await supabase
        .from('tickets')
        .select('id, event_id, ticket_type, status, price_paid, quantity, section_name, seat_assignment, attendee_email')
        .eq('attendee_email', user.email)
        .order('created_at', { ascending: false });

      if (ticketsError) {
        console.error('Failed to load tickets:', ticketsError);
        setLoading(false);
        return;
      }

      const eventIds = [...new Set((ticketRows ?? []).map((t) => t.event_id))];
      const { data: events } = eventIds.length
        ? await supabase.from('events').select('id, title, start_date, poster_url, location_name, is_online').in('id', eventIds)
        : { data: [] };
      const eventsById = new Map((events ?? []).map((e) => [e.id, e]));

      const mapped = (ticketRows ?? []).map((t: any) => ({
        id: t.id,
        event_id: t.event_id,
        ticket_type: t.ticket_type,
        status: t.status,
        price_paid: t.price_paid,
        quantity: t.quantity,
        section_name: t.section_name,
        seat_assignment: t.seat_assignment,
        attendee_email: t.attendee_email,
        event_title: eventsById.get(t.event_id)?.title ?? 'Untitled event',
        event_start_date: eventsById.get(t.event_id)?.start_date ?? null,
        event_poster_url: eventsById.get(t.event_id)?.poster_url ?? null,
        event_location_name: eventsById.get(t.event_id)?.location_name ?? null,
        event_is_online: !!eventsById.get(t.event_id)?.is_online,
      }));
      setTickets(mapped);
      setLoading(false);
    })();
  }, [user, authLoading, navigate, location.pathname]);

  const filteredTickets = useMemo(() => {
    const now = new Date();
    return tickets
      .filter((t) => statusFilter === 'all' || t.status === statusFilter)
      .filter((t) => typeFilter === 'all' || t.ticket_type === typeFilter)
      .filter((t) => {
        if (timeFilter === 'all' || !t.event_start_date) return true;
        const isUpcoming = new Date(t.event_start_date) >= now;
        return timeFilter === 'upcoming' ? isUpcoming : !isUpcoming;
      })
      .filter((t) => {
        // Every word typed must appear somewhere: event name, venue, seat,
        // or date (e.g. "raleigh october" narrows to both).
        const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
        if (words.length === 0) return true;
        const haystack = [
          t.event_title,
          t.event_is_online ? 'virtual online' : t.event_location_name,
          t.section_name,
          t.seat_assignment,
          t.event_start_date
            ? new Date(t.event_start_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
            : '',
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return words.every((w) => haystack.includes(w));
      });
  }, [tickets, statusFilter, typeFilter, timeFilter, search]);

  async function handleDownload(t: MyTicket) {
    setBusyId(t.id);
    await downloadBlob(
      `${SUPABASE_URL}/functions/v1/generate-ticket-pdf`,
      `tapin-ticket-${t.id}.pdf`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ ticket_id: t.id }),
      }
    );
    setBusyId(null);
  }

  async function handleEmail(t: MyTicket) {
    setBusyId(t.id);
    const { error } = await supabase.functions.invoke('send-app-email', { body: { kind: 'ticket_copy', ticket_id: t.id } });
    setBusyId(null);
    if (!error) {
      setEmailedId(t.id);
      setTimeout(() => setEmailedId((id) => (id === t.id ? null : id)), 3000);
    }
  }

  const holdTop = loading || counts === null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-display text-3xl font-extrabold text-gray-900">My Activity</h1>
        <p className="mt-1 text-gray-500">Your tickets, orders, bookings, and more, all in one place.</p>

        {/* The filter chips and your tickets appear together, so the chips
            can't push the tickets down when their counts arrive. */}
        {holdTop && (
          <LoadingRegion label="Loading your activity">
            <div className="mt-5 flex flex-wrap gap-2">
              {['w-14', 'w-24', 'w-20', 'w-24'].map((w, i) => <Skeleton key={i} className={`h-9 rounded-full ${w}`} />)}
            </div>
            <ListSkeleton />
          </LoadingRegion>
        )}

        {!holdTop && (() => {
          const chips: { key: View; label: string; count: number }[] = [
            { key: 'tickets', label: 'Tickets', count: tickets.length },
            { key: 'orders', label: 'Orders', count: counts?.orders ?? 0 },
            { key: 'bookings', label: 'Bookings', count: counts?.bookings ?? 0 },
            { key: 'vendor', label: 'Vendor spots', count: counts?.vendor ?? 0 },
            { key: 'tips', label: 'Tips', count: counts?.tips ?? 0 },
          ];
          const shown = chips.filter((c) => c.key === 'tickets' || c.count > 0 || view === c.key);
          if (shown.length < 2) return null;
          return (
            <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Filter your activity">
              {[{ key: 'all' as View, label: 'All', count: -1 }, ...shown].map((c) => (
                <button
                  key={c.key}
                  type="button"
                  role="tab"
                  aria-selected={view === c.key}
                  onClick={() => setView(c.key)}
                  className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${view === c.key ? 'bg-marigold text-white' : 'border border-gray-200 bg-white text-gray-700 hover:border-marigold'}`}
                >
                  {c.label}
                  {c.count >= 0 && <span className={`ml-1.5 ${view === c.key ? 'text-white/80' : 'text-gray-400'}`}>{c.count}</span>}
                  {c.key === 'bookings' && bookingSplit.pending > 0 && (
                    <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-orange-500 align-middle" aria-label={`${bookingSplit.pending} booking request${bookingSplit.pending === 1 ? '' : 's'} need your reply`} />
                  )}
                </button>
              ))}
            </div>
          );
        })()}

        {!holdTop && (view === 'all' || view === 'tickets') && (
        <div id="tickets">
        {view === 'all' && tickets.length > 0 && (counts?.orders || counts?.bookings || counts?.vendor || counts?.tips) ? (
          <h2 className="mt-8 font-display text-xl font-bold text-gray-900">Tickets</h2>
        ) : null}
        {loading ? (
          <ListSkeleton />
        ) : tickets.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-white/60 py-16 text-center">
            <p className="text-lg font-semibold text-gray-500">No tickets yet</p>
            <Link to="/" className="mt-3 inline-block text-marigold hover:underline">Browse events to get started &rarr;</Link>
          </div>
        ) : (
          <>
            <div className="relative mt-6">
              <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" strokeLinecap="round" />
              </svg>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by event, venue, seat, or date"
                aria-label="Search your tickets"
                className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-10 text-base text-gray-900 outline-none placeholder:text-gray-400 focus-visible:border-marigold"
              />
              {search && (
                <button onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
                  ✕
                </button>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900">
                <option value="all">All statuses</option>
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
                <option value="cancelled">Cancelled</option>
                <option value="refunded">Refunded</option>
              </select>
              <select value={timeFilter} onChange={(e) => setTimeFilter(e.target.value as typeof timeFilter)} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900">
                <option value="all">Any date</option>
                <option value="upcoming">Upcoming</option>
                <option value="past">Past</option>
              </select>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900">
                <option value="all">All ticket types</option>
                <option value="general">General admission</option>
                <option value="seated">Reserved seating</option>
                <option value="series_pass">Series pass</option>
              </select>
            </div>

            {filteredTickets.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-white/60 py-10 text-center">
                <p className="text-gray-500">
                  {search.trim() ? `No tickets match "${search.trim()}"` : 'No tickets match these filters.'}
                </p>
                {search.trim() && (
                  <button onClick={() => setSearch('')} className="mt-2 text-sm font-medium text-marigold hover:underline">
                    Clear search
                  </button>
                )}
              </div>
            ) : (
          <div className="mt-4 flex flex-col gap-4">
            {filteredTickets.map((t) => {
              const passUrl = `${window.location.origin}${import.meta.env.BASE_URL}pass/${t.id}`;
              const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(passUrl)}&size=300&margin=1`;
              return (
                <div key={t.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                  <div className="flex flex-col gap-4 p-5 sm:flex-row md:flex-col lg:flex-row">
                    {t.event_poster_url ? (
                      <div className="h-32 w-full shrink-0 overflow-hidden rounded-lg sm:w-32 md:w-full lg:w-32">
                        <img src={t.event_poster_url} alt="" className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <div className="h-32 w-full shrink-0 rounded-lg bg-gradient-to-br from-indigo-100 to-teal-100 sm:w-32 md:w-full lg:w-32" />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <Link to={`/events/${t.event_id}`} className="truncate font-display text-lg font-bold text-gray-900 hover:text-marigold">
                          {t.event_title}
                        </Link>
                        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[t.status] ?? STATUS_STYLES.pending}`}>
                          {t.status}
                        </span>
                      </div>
                      <div className="mt-2 space-y-1 text-sm text-gray-500">
                        <p>
                          {t.event_start_date
                            ? new Date(t.event_start_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                            : 'Date TBD'}
                        </p>
                        <p>{t.event_is_online ? 'Virtual event' : (t.event_location_name || 'Venue TBD')}</p>
                        <p>
                          {t.ticket_type === 'series_pass' ? 'Series pass' : t.ticket_type === 'seated' ? 'Reserved seat' : t.ticket_type === 'vip' ? 'VIP' : t.ticket_type === 'early_bird' ? 'Early bird' : 'General admission'} &middot; Qty {t.quantity}
                          {t.price_paid > 0 ? ` \u00b7 $${t.price_paid}` : ' \u00b7 Free'}
                          {(t.section_name || t.seat_assignment) && ` \u00b7 ${seatText(t.section_name, t.seat_assignment)}`}
                        </p>
                      </div>
                      <Link to={`/pass/${t.id}`} className="mt-3 inline-block text-sm font-medium text-marigold hover:underline">
                        View full ticket &rarr;
                      </Link>
                    </div>

                    {t.status === 'confirmed' && (
                      <div className="flex shrink-0 flex-col items-center gap-2 border-t border-gray-100 pt-4 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
                        <img src={qrUrl} width={100} height={100} alt="QR code" className="rounded-lg border border-gray-200 p-1" />
                        <button
                          onClick={() => handleDownload(t)}
                          disabled={busyId === t.id}
                          className="w-32 rounded-lg bg-marigold px-2 py-1.5 text-center text-xs font-semibold text-ink hover:bg-marigold/90 disabled:opacity-50"
                        >
                          {busyId === t.id ? 'Working…' : 'Download ticket'}
                        </button>
                        <button
                          onClick={() => handleEmail(t)}
                          disabled={busyId === t.id}
                          className="w-32 rounded-lg border border-gray-300 px-2 py-1.5 text-center text-xs font-medium text-gray-700 hover:border-marigold hover:text-marigold disabled:opacity-50"
                        >
                          {emailedId === t.id ? 'Sent!' : 'Email ticket'}
                        </button>
                        {canCancelRegistration(t, t.event_start_date) && (
                          <CancelRegistration ticketId={t.id} eventTitle={t.event_title} variant="button"
                            onCancelled={() => setTickets((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: 'cancelled' } : x)))} />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
            )}
          </>
        )}
        </div>
        )}
        {/* On "All", these wait for your tickets so they don't get pushed down when the tickets arrive. */}
        {!(holdTop && view === 'all') && (
          <>
            {(view === 'all' || view === 'orders') && <MyProductOrders title="Orders" />}
            {(view === 'all' || view === 'vendor') && <div id="vendor" className="scroll-mt-20"><MyVendorApplications title="Vendor Spots" /></div>}
            {(view === 'all' || view === 'bookings') && <div id="bookings" className="scroll-mt-20"><BookingsSection mine={bookingSplit.mine} received={bookingSplit.received} pending={bookingSplit.pending} /></div>}
            {(view === 'all' || view === 'tips') && <MyTipsSent />}
          </>
        )}
        {view !== 'all' && view !== 'tickets' && counts && counts[view] === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-white/60 py-12 text-center text-gray-500">Nothing here yet.</div>
        )}
      </div>
    </div>
  );
}
