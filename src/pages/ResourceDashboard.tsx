import { useEffect, useRef, useState } from 'react';
import BackButton from '../components/BackButton';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import type { Resource, ResourceBooking } from '../lib/types';
import ProductManager from '../components/products/ProductManager';
import ProductOrdersPanel from '../components/products/ProductOrdersPanel';
import ResourceMediaManager from '../components/resources/ResourceMediaManager';
import BookingThread from '../components/bookings/BookingThread';
import { MessageButton, ThreadPreview } from '../components/bookings/ThreadEntry';
import { useThreadSummaries } from '../lib/bookingThreads';
import { LoadingRegion, Skeleton, ListSkeleton } from '../components/ui/Skeleton';
import PayoutsCard from '../components/PayoutsCard';
import BookingListing, { type Listing } from '../components/bookings/BookingListing';
import { money } from '../lib/bookings';

interface BookingRow extends ResourceBooking {
  event_title: string;
  event_start_date: string | null;
  organizer_name: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-orange-100 text-orange-800',
  accepted: 'bg-green-100 text-green-800',
  confirmed: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-red-100 text-red-800',
  counter_offered: 'bg-blue-100 text-blue-800',
  deleted: 'bg-gray-100 text-gray-800',
};

const STATUS_BORDER: Record<string, string> = {
  pending: 'border-l-orange-400',
  accepted: 'border-l-green-500',
  confirmed: 'border-l-green-500',
  completed: 'border-l-gray-300',
  rejected: 'border-l-red-300',
  cancelled: 'border-l-red-300',
  counter_offered: 'border-l-blue-400',
  deleted: 'border-l-gray-300',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  confirmed: 'Confirmed',
  completed: 'Completed',
  rejected: 'Declined',
  cancelled: 'Cancelled',
  counter_offered: 'Countered',
  deleted: 'Deleted',
};

const TABS = ['Bookings', 'Media', 'Products'] as const;
type Tab = (typeof TABS)[number];

export default function ResourceDashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('booking');
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [tab, setTab] = useState<Tab>(searchParams.get('tab') === 'media' ? 'Media' : 'Bookings');
  const [resource, setResource] = useState<Resource | null>(null);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reviewStats, setReviewStats] = useState({ count: 0, average: 0 });
  const [payouts, setPayouts] = useState<{ hasAccount: boolean; chargesEnabled: boolean } | null>(null);
  const [listings, setListings] = useState<Map<string, Listing>>(new Map());
  const [counteringId, setCounteringId] = useState<string | null>(null);
  const [counterRate, setCounterRate] = useState('');
  const [openThread, setOpenThread] = useState<Set<string>>(new Set(highlightId && searchParams.get('messages') ? [highlightId] : []));
  const { summaries, applyLocal } = useThreadSummaries(bookings.map((b) => b.id));
  const unreadTotal = [...summaries.values()].reduce((n, s) => n + s.unread_count, 0);
  function toggleThread(id: string, forceOpen = false) {
    setOpenThread((prev) => {
      const n = new Set(prev);
      if (n.has(id) && !forceOpen) n.delete(id); else n.add(id);
      return n;
    });
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    if (!user.email) return;
    (async () => {
      const { data: res, error: resError } = await supabase.from('resources').select('*').eq('email', user.email).maybeSingle();
      if (resError) console.error('Failed to load resource profile:', resError);
      setResource((res as Resource) ?? null);
      supabase.from('profiles').select('stripe_account_id, stripe_charges_enabled').eq('id', user.id).maybeSingle().then(({ data }) => {
        setPayouts({ hasAccount: !!data?.stripe_account_id, chargesEnabled: !!data?.stripe_charges_enabled });
      });
      if (!res) {
        setLoading(false);
        return;
      }

      const { data: bookingRows, error: bookingsError } = await supabase
        .from('resource_bookings')
        .select('*')
        .eq('resource_email', user.email)
        .order('created_at', { ascending: false });

      if (bookingsError) {
        console.error('Failed to load bookings:', bookingsError);
        setLoadError('Could not load your booking requests. Please refresh the page.');
        setLoading(false);
        return;
      }

      const eventIds = [...new Set((bookingRows ?? []).map((b) => b.event_id))];
      const { data: events } = eventIds.length
        ? await supabase.from('events').select('id, title, start_date').in('id', eventIds)
        : { data: [] };
      const eventsById = new Map((events ?? []).map((e) => [e.id, e]));
      const organizerEmails = [...new Set((bookingRows ?? []).map((b) => b.organizer_email))];
      const { data: organizers } = organizerEmails.length
        ? await supabase.from('public_profiles').select('email, full_name').in('email', organizerEmails)
        : { data: [] };
      const organizerNames = new Map((organizers ?? []).map((o) => [o.email as string, (o.full_name as string | null)?.trim() || null]));

      const mapped = (bookingRows ?? []).map((b: any) => ({
        ...b,
        event_title: eventsById.get(b.event_id)?.title ?? 'Untitled event',
        event_start_date: eventsById.get(b.event_id)?.start_date ?? null,
        organizer_name: organizerNames.get(b.organizer_email) ?? null,
      }));
      setBookings(mapped);
      if (mapped.length) {
        supabase.rpc('booking_listing', { p_booking_ids: mapped.map((b) => b.id) }).then(({ data }) => {
          setListings(new Map(((data ?? []) as ({ booking_id: string } & Listing)[]).map((l) => [l.booking_id, l])));
        });
      }

      // Stats computed live from real data rather than trusting stored
      // counters, which nothing currently keeps in sync.
      const { data: reviews } = await supabase.from('resource_reviews').select('rating').eq('resource_id', res.id);
      const ratings = (reviews ?? []).map((r) => r.rating);
      setReviewStats({
        count: ratings.length,
        average: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0,
      });

      setLoading(false);
    })();
  }, [user, authLoading, navigate, location.pathname]);

  useEffect(() => {
    if (highlightId && itemRefs.current[highlightId]) {
      itemRefs.current[highlightId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightId, bookings]);

  async function respond(booking: BookingRow, status: 'accepted' | 'rejected') {
    setBusyId(booking.id);
    const { error } = await supabase.from('resource_bookings').update({ status }).eq('id', booking.id);
    setBusyId(null);
    if (!error) {
      setBookings((prev) => prev.map((b) => (b.id === booking.id ? { ...b, status } : b)));

      supabase
        .from('notifications')
        .insert({
          user_email: booking.organizer_email,
          type: `booking_${status}`,
          message: `${resource?.display_name} has ${status} your booking request for ${booking.event_title}`,
          link: `/organizer/bookings?booking=${booking.id}`,
        })
        .then(() => {});

      // The server builds the email and checks you're the booked resource.
      supabase.functions
        .invoke('send-app-email', { body: { kind: 'booking_status', booking_id: booking.id } })
        .catch(() => {});
    }
  }

  async function markCompleted(booking: BookingRow) {
    setBusyId(booking.id);
    const { error } = await supabase.from('resource_bookings').update({ status: 'completed' }).eq('id', booking.id);
    setBusyId(null);
    if (!error) setBookings((prev) => prev.map((b) => (b.id === booking.id ? { ...b, status: 'completed' } : b)));
  }

  async function sendCounterOffer(booking: BookingRow) {
    if (!counterRate) return;
    setBusyId(booking.id);
    const rate = parseFloat(counterRate);
    const { error } = await supabase
      .from('resource_bookings')
      .update({ status: 'counter_offered', counter_offer_rate: rate })
      .eq('id', booking.id);
    setBusyId(null);
    if (!error) {
      setBookings((prev) => prev.map((b) => (b.id === booking.id ? { ...b, status: 'counter_offered', counter_offer_rate: rate } : b)));
      setCounteringId(null);
      setCounterRate('');

      supabase
        .from('notifications')
        .insert({
          user_email: booking.organizer_email,
          type: 'booking_counter_offered',
          message: `${resource?.display_name} proposed $${rate} instead of $${booking.offered_rate} for ${booking.event_title}`,
          link: `/organizer/bookings?booking=${booking.id}`,
        })
        .then(() => {});
    }
  }

  if (loading) {
    return (
      <LoadingRegion label="Loading your dashboard" className="mx-auto max-w-3xl px-4 py-10">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-40" />
        <Skeleton className="mt-4 h-10 w-28 rounded-lg" />
        <div className="mt-6 flex gap-6 border-b border-gray-200 pb-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-4 w-16" />)}</div>
        <div className="mt-6 grid grid-cols-3 gap-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
        <ListSkeleton rows={3} />
      </LoadingRegion>
    );
  }

  if (!resource) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-lg font-semibold text-gray-700">You don't have a resource profile yet.</p>
        <Link to="/resources/new" className="mt-3 inline-block text-marigold hover:underline">Create your resource profile &rarr;</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-3"><BackButton fallback="/profile" fallbackLabel="Profile" /></div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-gray-900">Resource Dashboard</h1>
            <p className="mt-1 text-gray-500">Booking requests for {resource.display_name}</p>
          </div>
          <Link to="/resources/new" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:border-marigold hover:text-marigold">
            Edit profile
          </Link>
        </div>

        {loadError && <p className="mt-4 text-sm text-magenta">{loadError}</p>}

        <div className="mt-6 flex gap-1 border-b border-gray-200">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium transition ${
                tab === t ? 'border-b-2 border-marigold text-marigold' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {t}
              {t === 'Bookings' && unreadTotal > 0 && (
                <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-magenta px-1.5 text-[11px] font-bold leading-5 text-white">{unreadTotal}</span>
              )}
            </button>
          ))}
        </div>

        {tab === 'Bookings' && (
          <>
        {payouts && (
          <div className="mt-6">
            <PayoutsCard hasAccount={payouts.hasAccount} chargesEnabled={payouts.chargesEnabled} variant="resource" />
          </div>
        )}
        <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
          <div className="flex flex-col items-center gap-1.5 rounded-xl border border-gray-200 bg-white p-3 text-center sm:gap-2 sm:p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-50">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
                <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="font-display text-2xl font-extrabold text-gray-900">
              {bookings.filter((b) => b.status === 'completed').length}
            </p>
            <p className="text-xs text-gray-500">Completed</p>
          </div>
          <div className="flex flex-col items-center gap-1.5 rounded-xl border border-gray-200 bg-white p-3 text-center sm:gap-2 sm:p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-50">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#fb923c" stroke="#fb923c" strokeWidth="1">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
            <p className="font-display text-2xl font-extrabold text-gray-900">
              {reviewStats.count > 0 ? reviewStats.average.toFixed(1) : '—'}
            </p>
            <p className="text-xs text-gray-500">{reviewStats.count > 0 ? `${reviewStats.count} review${reviewStats.count === 1 ? '' : 's'}` : 'No reviews yet'}</p>
          </div>
          <div className="flex flex-col items-center gap-1.5 rounded-xl border border-gray-200 bg-white p-3 text-center sm:gap-2 sm:p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-marigold/10">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2">
                <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="font-display text-2xl font-extrabold text-gray-900">
              {bookings.filter((b) => b.status === 'pending').length}
            </p>
            <p className="text-xs text-gray-500">Awaiting your response</p>
          </div>
        </div>

        {bookings.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-gray-300 bg-white/60 py-16 text-center">
            <p className="text-lg font-semibold text-gray-500">No booking requests yet</p>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-3">
            {bookings.map((b) => (
              <div
                key={b.id}
                ref={(el) => { itemRefs.current[b.id] = el; }}
                className={`rounded-xl border border-l-4 bg-white p-4 shadow-sm transition-colors ${STATUS_BORDER[b.status] ?? STATUS_BORDER.pending} ${
                  highlightId === b.id ? 'border-marigold ring-2 ring-marigold/40' : 'border-gray-200'
                } ${b.status === 'pending' ? 'bg-orange-50/30' : ''}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900">{b.event_title}</p>
                    <p className="text-sm text-gray-500">
                      {b.event_start_date ? new Date(b.event_start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date TBD'}
                      {' \u00b7 '}Offered ${b.offered_rate}
                    </p>
                  </div>
                  <span className="flex flex-wrap items-center gap-1.5">
                    {b.payment_status === 'paid' && <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">Paid</span>}
                    {b.payment_status === 'refunded' && <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">Refunded</span>}
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[b.status] ?? STATUS_STYLES.pending}`}>
                      {STATUS_LABELS[b.status] ?? b.status}
                    </span>
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-600">From <span className="font-medium text-gray-800">{b.organizer_name ?? b.organizer_email}</span></p>
                <BookingListing listing={listings.get(b.id)} audience="resource" />
                {b.payment_status === 'paid' && (
                  <p className="mt-1 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    You were paid <strong>{money(b.amount_paid ?? b.final_rate)}</strong>{b.paid_at ? ` on ${new Date(b.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}. It's on its way to your bank through Stripe.
                  </p>
                )}
                {b.payment_status === 'refunded' && (
                  <p className="mt-1 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">This booking was cancelled and the payment was returned to the organizer.</p>
                )}
                {['accepted', 'confirmed'].includes(b.status) && b.payment_status !== 'paid' && (
                  <p className="mt-1 rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-800">
                    {payouts?.chargesEnabled
                      ? 'Waiting for the organizer to pay. You\'ll be notified as soon as they do.'
                      : 'Connect payouts above so the organizer can pay you through TapIN.'}
                  </p>
                )}
                {b.message_from_organizer && (
                  <p className="mt-2 text-sm italic text-gray-600">"{b.message_from_organizer}"</p>
                )}

                {openThread.has(b.id) ? (
                  <div className="mt-3">
                    <BookingThread
                      bookingId={b.id}
                      otherPartyName={b.organizer_name ?? b.organizer_email}
                      starters={b.status === 'pending'
                        ? ['Thanks for the request! A couple of questions first:', 'What time should I arrive for setup?', 'Is equipment provided at the venue?']
                        : ['What time should I arrive for setup?', 'Is parking available at the venue?', 'Who is my day-of contact?']}
                      onChange={(info) => applyLocal(b.id, info)}
                    />
                  </div>
                ) : (
                  <ThreadPreview summary={summaries.get(b.id)} myEmail={user?.email ?? undefined} otherName={b.organizer_name ?? b.organizer_email} onOpen={() => toggleThread(b.id, true)} />
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {b.status === 'pending' && (
                    <>
                      <button onClick={() => respond(b, 'accepted')} disabled={busyId === b.id} className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                        Accept
                      </button>
                      <button onClick={() => setCounteringId(counteringId === b.id ? null : b.id)} disabled={busyId === b.id} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:border-marigold hover:text-marigold disabled:opacity-50">
                        Counter offer
                      </button>
                      <button onClick={() => respond(b, 'rejected')} disabled={busyId === b.id} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:border-magenta hover:text-magenta disabled:opacity-50">
                        Decline
                      </button>
                    </>
                  )}
                  {(b.status === 'accepted' || b.status === 'confirmed') && (
                    <button onClick={() => markCompleted(b)} disabled={busyId === b.id} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:border-marigold hover:text-marigold disabled:opacity-50">
                      Mark as completed
                    </button>
                  )}
                  <MessageButton summary={summaries.get(b.id)} open={openThread.has(b.id)} onToggle={() => toggleThread(b.id)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:border-marigold hover:text-marigold disabled:opacity-50" />
                </div>
                {b.status === 'pending' && counteringId === b.id && (
                  <div className="mt-2 rounded-lg bg-gray-50 p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">Propose $</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={counterRate}
                        onChange={(e) => setCounterRate(e.target.value)}
                        className="w-28 rounded-lg border border-gray-300 px-2 py-1.5 text-base text-gray-900"
                        placeholder={String(b.offered_rate)}
                      />
                      <button
                        onClick={() => sendCounterOffer(b)}
                        disabled={busyId === b.id || !counterRate}
                        className="rounded-lg bg-marigold px-3 py-2 text-sm font-semibold text-white hover:bg-marigold/90 disabled:opacity-50"
                      >
                        Send
                      </button>
                    </div>
                    <p className="mt-1.5 text-xs text-gray-500">Want to explain your rate? Open the conversation and add a note.</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
          </>
        )}

        {tab === 'Media' && <ResourceMediaManager resourceId={resource.id} />}

        {tab === 'Products' && (
          <>
            <ProductManager ownerType="resource" ownerId={resource.id} sellerEmail={resource.email} />
            <ProductOrdersPanel ownerType="resource" ownerId={resource.id} />
          </>
        )}
      </div>
    </div>
  );
}
