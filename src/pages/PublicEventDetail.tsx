import { useEffect, useState } from 'react';
import HostedBy from '../components/HostedBy';
import CancelRegistration, { canCancelRegistration } from '../components/CancelRegistration';
import BackButton from '../components/BackButton';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import type { TapEvent, Ticket } from '../lib/types';
import ShopSection from '../components/products/ShopSection';
import EventLinks from '../components/EventLinks';
import EventProgram from '../components/EventProgram';
import { visibleLinks } from '../lib/socialLinks';
import { safeTicketUrl, ticketSiteName } from '../lib/externalTickets';
import VendorApplicationForm from '../components/VendorApplicationForm';
import SeatPicker from '../components/SeatPicker';
import { resolveFeatureIcon } from '../lib/featureIconMap';
import CommunityPosts from '../components/discover/CommunityPosts';
import { EventPageSkeleton } from '../components/ui/Skeleton';

export default function PublicEventDetail() {
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [event, setEvent] = useState<TapEvent | null>(null);
  const [seriesEvents, setSeriesEvents] = useState<{ id: string; start_date: string }[]>([]);
  const [selectedSectionName, setSelectedSectionName] = useState<string | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [useBundle, setUseBundle] = useState(false);
  const [organizerName, setOrganizerName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [myTicket, setMyTicket] = useState<Ticket | null>(null);
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [shareCopied, setShareCopied] = useState(false);
  const checkoutStatus = searchParams.get('checkout'); // 'success' | 'cancelled' | null

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase.from('events').select('*').eq('id', id).single();
      const ev = data as TapEvent | null;
      setEvent(ev);
      const seriesId = ev?.parent_event_id || ev?.id;
      if (ev?.is_recurring && seriesId) {
        supabase
          .from('events')
          .select('id, start_date')
          .or(`id.eq.${seriesId},parent_event_id.eq.${seriesId}`)
          .eq('status', 'published')
          .order('start_date', { ascending: true })
          .then(({ data: siblings }) => setSeriesEvents(siblings ?? []));
      }
      if (ev?.organizer_email) {
        const { data: org } = await supabase
          .from('public_profiles')
          .select('full_name')
          .eq('email', ev.organizer_email)
          .single();
        setOrganizerName(org?.full_name ?? null);
      }
      setLoading(false);
    })();
  }, [id]);

  useEffect(() => {
    if (!id || !event) return;
    (async () => {
      // Capacity check (best-effort: not race-condition-proof against
      // simultaneous last-second signups, but sufficient for typical use).
      if (event.max_capacity) {
        const { data: confirmed } = await supabase
          .from('tickets')
          .select('quantity')
          .eq('event_id', id)
          .eq('status', 'confirmed');
        setConfirmedCount((confirmed ?? []).reduce((sum, t) => sum + (t.quantity || 1), 0));
      }
      if (user?.email) {
        const { data: existing } = await supabase
          .from('tickets')
          .select('*')
          .eq('event_id', id)
          .eq('attendee_email', user.email)
          .neq('status', 'cancelled')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        setMyTicket((existing as Ticket) ?? null);
      }
    })();
  }, [id, event, user?.email, checkoutStatus]);

  useEffect(() => {
    if (!user?.email) {
      setSavedIds([]);
      return;
    }
    supabase.from('profiles').select('saved_event_ids').eq('email', user.email).single().then(({ data }) => {
      setSavedIds((data?.saved_event_ids as string[]) ?? []);
    });
  }, [user?.email]);

  async function toggleSave() {
    if (!id) return;
    if (!user?.email) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    const next = savedIds.includes(id) ? savedIds.filter((x) => x !== id) : [...savedIds, id];
    setSavedIds(next);
    await supabase.from('profiles').update({ saved_event_ids: next }).eq('email', user.email);
  }

  async function handleShare() {
    const shareUrl = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: event?.title, url: shareUrl });
      } catch {
        /* user cancelled the native share sheet — not an error */
      }
      return;
    }
    await navigator.clipboard.writeText(shareUrl);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  }

  async function handleRegister() {
    if (!id || !event || !user?.email || event.status === 'draft' || hasEnded) return;
    setRegistering(true);
    setRegisterError(null);

    const { data: profile } = await supabase.from('profiles').select('full_name').eq('email', user.email).single();

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: `TAPIN-${Date.now()}`,
        event_id: id,
        customer_email: user.email,
        customer_name: profile?.full_name ?? user.email,
        items: [{ type: 'ticket', item_id: id, item_name: event.title, quantity: 1, unit_price: 0, total_price: 0 }],
        subtotal: 0,
        platform_fee: 0,
        total_amount: 0,
        payment_status: 'paid',
      })
      .select()
      .single();

    if (orderError || !order) {
      setRegisterError('Something went wrong. Please try again.');
      setRegistering(false);
      return;
    }

    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .insert({
        event_id: id,
        attendee_email: user.email,
        order_id: order.id,
        ticket_type: 'general',
        price_paid: 0,
        quantity: 1,
        status: 'confirmed',
      })
      .select()
      .single();

    setRegistering(false);
    if (ticketError || !ticket) {
      setRegisterError('Something went wrong. Please try again.');
      return;
    }
    setMyTicket(ticket as Ticket);

    // Best-effort: the registration itself has already succeeded regardless
    // of whether this email actually goes out, so failures here are swallowed.
    // The server builds the confirmation email and only sends it to the ticket holder.
    supabase.functions
      .invoke('send-app-email', { body: { kind: 'registration_confirmation', ticket_id: ticket.id } })
      .catch(() => {});
  }

  async function handleBuyTicket() {
    if (!id || !event || event.status === 'draft' || hasEnded) return;
    setRegistering(true);
    setRegisterError(null);

    const base = window.location.origin + import.meta.env.BASE_URL;
    const { data, error } = await supabase.functions.invoke('create-stripe-checkout', {
      body: {
        event_id: id,
        successUrl: `${base}events/${id}?checkout=success`,
        cancelUrl: `${base}events/${id}?checkout=cancelled`,
      },
    });

    setRegistering(false);
    if (error || !data?.url) {
      setRegisterError('Something went wrong starting checkout. Please try again.');
      return;
    }
    window.location.href = data.url;
  }

  async function handleBuySeats() {
    if (!id || !event || !selectedSectionName || selectedSeats.length === 0 || event.status === 'draft' || hasEnded) return;
    setRegistering(true);
    setRegisterError(null);

    const base = window.location.origin + import.meta.env.BASE_URL;
    const { data, error } = await supabase.functions.invoke('create-seated-checkout', {
      body: {
        event_id: id,
        section_name: selectedSectionName,
        seat_labels: selectedSeats,
        use_bundle: useBundle,
        successUrl: `${base}events/${id}?checkout=success`,
        cancelUrl: `${base}events/${id}?checkout=cancelled`,
      },
    });

    setRegistering(false);
    if (error || !data?.url) {
      setRegisterError(error?.message || 'Something went wrong starting checkout. Please try again.');
      return;
    }
    window.location.href = data.url;
  }

  function toggleSeat(seatLabel: string) {
    setSelectedSeats((prev) => (prev.includes(seatLabel) ? prev.filter((s) => s !== seatLabel) : [...prev, seatLabel]));
  }

  async function handleBuySeriesPass() {
    if (!id || !event || event.status === 'draft' || hasEnded) return;
    setRegistering(true);
    setRegisterError(null);

    const base = window.location.origin + import.meta.env.BASE_URL;
    const { data, error } = await supabase.functions.invoke('create-series-pass-checkout', {
      body: {
        event_id: id,
        successUrl: `${base}events/${id}?checkout=success`,
        cancelUrl: `${base}events/${id}?checkout=cancelled`,
      },
    });

    setRegistering(false);
    if (error || !data?.url) {
      setRegisterError(error?.message || 'Something went wrong starting checkout. Please try again.');
      return;
    }
    window.location.href = data.url;
  }

  if (loading) return <EventPageSkeleton />;
  if (!event) return <div className="p-10 text-center text-magenta">Event not found.</div>;

  const isFull = !!event.max_capacity && confirmedCount >= event.max_capacity && !myTicket;
  const isFree = event.event_type === 'free';
  // Drafts are only visible to their organizer and team (enforced by the
  // database), so viewing one is a preview: ticket buttons are switched off.
  const isPreview = event.status === 'draft';
  const canPublish = isPreview && user?.id === event.organizer_id;
  // Mirrors public.event_has_ended() in the database, which is what actually
  // blocks registration -- this just keeps the page honest about it without
  // waiting on a page refresh after the event flips to 'completed'.
  const effectiveEnd = event.end_date ?? event.start_date;
  const hasEnded = !event.date_tbd && !!effectiveEnd && new Date(effectiveEnd).getTime() < Date.now();

  async function publishFromPreview() {
    if (!event) return;
    const { error } = await supabase.from('events').update({ status: 'published' }).eq('id', event.id);
    if (!error) setEvent({ ...event, status: 'published' });
  }

  return (
    <div className="min-h-screen bg-ink">
      {isPreview && (
        <div className="sticky top-0 z-40 border-b border-amber-300 bg-amber-100 px-4 py-2.5 sm:px-6">
          <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-amber-900">
              <span className="font-semibold">Draft preview.</span> Only you and your team can see this page. Ticket buttons turn on once it's published.
            </p>
            <div className="flex shrink-0 gap-2">
              <Link to={`/organizer/events/${event.id}/edit`} className="rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-sm font-semibold text-amber-900 hover:bg-amber-50">
                Keep editing
              </Link>
              {canPublish && (
                <button type="button" onClick={publishFromPreview} className="rounded-lg bg-mint px-3 py-1.5 text-sm font-semibold text-white hover:bg-mint/90">
                  Publish
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {!isPreview && hasEnded && event.status !== 'cancelled' && (
        <div className="sticky top-0 z-40 border-b border-gray-300 bg-gray-100 px-4 py-2.5 sm:px-6">
          <p className="mx-auto max-w-3xl text-sm text-gray-700">
            <span className="font-semibold">This event has ended.</span> New registrations and ticket purchases are closed.
          </p>
        </div>
      )}
      {/* Hero: title and key facts live directly on the image, editorial-style,
          instead of a separate text block below a plain picture frame. */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-gray-900 sm:aspect-[21/9]">
        {event.poster_url ? (
          <img src={event.poster_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-indigo-600 via-indigo-500 to-teal-500" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        <BackButton variant="overlay" fallback="/" fallbackLabel="Back to Discover" className="absolute left-4 top-4 sm:left-6 sm:top-6" />

        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
          <div className="mx-auto max-w-4xl">
            {event.category && (
              <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                {event.category}
              </span>
            )}
            <h1 className="mt-2 font-display text-2xl font-extrabold leading-tight text-white sm:text-4xl">
              {event.title}
            </h1>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 pb-16 sm:px-6">
        {checkoutStatus === 'success' && (
          <div className="mt-4 rounded-xl bg-green-50 p-4 text-sm text-green-700">
            ✓ Payment received! Your ticket is confirmed — check your email.
          </div>
        )}
        {checkoutStatus === 'cancelled' && (
          <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
            Checkout was cancelled — no charge was made.
          </div>
        )}

        {/* Key facts strip: fast orientation without hunting through prose. */}
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-gray-100 pb-5 text-[15px] text-gray-700">
          {event.start_date && (
            <span className="flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
              {new Date(event.start_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              {' · '}
              {new Date(event.start_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
          <span className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400"><path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 1 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
            {event.is_online ? 'Virtual event' : (event.location_name || 'Venue TBD')}
          </span>
          <span className="ml-auto flex items-center gap-3">
            {!isPreview && <button onClick={handleShare} className="-my-2 flex items-center gap-1.5 py-2 text-sm font-medium text-gray-500 hover:text-marigold">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
              {shareCopied ? 'Copied!' : 'Share'}
            </button>}
            {!isPreview && (<button onClick={toggleSave} className={`-my-2 flex items-center gap-1.5 py-2 text-sm font-medium ${id && savedIds.includes(id) ? 'text-marigold' : 'text-gray-500 hover:text-marigold'}`}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill={id && savedIds.includes(id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" strokeLinejoin="round" /></svg>
              {id && savedIds.includes(id) ? 'Saved' : 'Save'}
            </button>)}
          </span>
        </div>

        {event.organizer_email && <HostedBy organizerEmail={event.organizer_email} fallbackName={organizerName} />}
        <div className="mt-2 text-right text-sm">
          <a href={`mailto:${event.organizer_email}`} className="font-medium text-marigold hover:underline">
            Contact organizer
          </a>
        </div>

        {user?.email === event.organizer_email && (
          <div className="mt-3 flex flex-wrap gap-2 rounded-xl bg-gray-50 p-4">
            <Link to={`/organizer/events/${event.id}`} className="rounded-lg bg-marigold px-3 py-1.5 text-xs font-semibold text-white hover:bg-marigold/90">
              Dashboard
            </Link>
            {event.status === 'completed' ? (
              <span className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-500">Ended</span>
            ) : (
              <button
                onClick={async () => {
                  const nextStatus = event.status === 'published' ? 'draft' : 'published';
                  const { error } = await supabase.from('events').update({ status: nextStatus }).eq('id', event.id);
                  if (!error) setEvent({ ...event, status: nextStatus });
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  event.status === 'published' ? 'border border-gray-300 text-gray-700 hover:border-magenta hover:text-magenta' : 'bg-mint text-white hover:bg-mint/90'
                }`}
              >
                {event.status === 'published' ? 'Unpublish' : 'Publish event'}
              </button>
            )}
            <Link to={`/organizer/events/${event.id}/edit`} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-marigold hover:text-marigold">
              Edit
            </Link>
            <Link to={`/resources?for_event=${event.id}`} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-marigold hover:text-marigold">
              Book Resources
            </Link>
          </div>
        )}

        {/* The CTA is the lead of the page — everything above just orients
            the visitor, everything below is supporting detail. */}
        {safeTicketUrl(event.external_ticket_url) ? (
          // Tickets are sold on another site: send people there.
          <div className="mt-6 flex flex-col gap-4 rounded-2xl bg-gray-900 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <p className="text-sm text-gray-400">{isFree ? 'Free to attend' : 'Tickets'}</p>
              <p className="font-display text-2xl font-extrabold text-white">
                {isFree ? 'Free' : event.ticket_price > 0 ? `From $${event.ticket_price}` : 'See ticket options'}
              </p>
              <p className="mt-0.5 text-xs text-gray-400">{isFree ? 'RSVP' : 'Sold'} on {ticketSiteName(event.external_ticket_url!)}</p>
            </div>
            {isPreview ? (
              <span className="rounded-xl bg-gradient-to-r from-marigold to-teal px-6 py-3 text-center text-sm font-semibold text-white opacity-50">Available once published</span>
            ) : hasEnded ? (
              <span className="rounded-xl bg-gray-700 px-6 py-3 text-center text-sm font-semibold text-white opacity-70">Event has ended</span>
            ) : (
              <a
                href={safeTicketUrl(event.external_ticket_url)!}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-gradient-to-r from-marigold to-teal px-6 py-3 text-center text-sm font-semibold text-white hover:opacity-90"
              >
                {isFree ? 'RSVP' : 'Get tickets'} on {ticketSiteName(event.external_ticket_url!)} ↗
              </a>
            )}
          </div>
        ) : event.is_seating_enabled && event.seating_sections && event.seating_sections.length > 0 ? (
          <div className="mt-6 rounded-2xl bg-gray-900 p-5 sm:p-6">
            <p className="text-sm font-semibold text-white">Select Your Seats</p>
            {myTicket ? (
              <div className="mt-3">
                <p className="text-sm font-medium text-mint">✓ You're registered</p>
                <Link to={`/pass/${myTicket.id}`} className="text-sm font-medium text-white underline underline-offset-2">
                  View your ticket &amp; QR code
                </Link>
                {canCancelRegistration(myTicket, event.start_date) && (
                  <CancelRegistration ticketId={myTicket.id} eventTitle={event.title} variant="light" className="mt-1"
                    onCancelled={() => { setMyTicket(null); setConfirmedCount((n) => Math.max(n - (myTicket.quantity || 1), 0)); }} />
                )}
              </div>
            ) : !user ? (
              <button
                onClick={() => navigate('/login', { state: { from: location.pathname } })}
                className="mt-3 rounded-xl bg-gradient-to-r from-marigold to-teal px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
              >
                Sign in to choose seats
              </button>
            ) : (
              <>
                <div className="mt-3 flex flex-col gap-3">
                  {event.seating_sections.map((section) => (
                    <SeatPicker
                      key={section.name}
                      section={section}
                      bookedSeats={event.booked_seats ?? []}
                      selectedSeats={selectedSeats.filter((s) => s.startsWith(`${section.name}-`))}
                      onToggleSeat={(seatLabel) => {
                        // Seats from only one section can be selected at a time,
                        // since checkout is submitted per-section.
                        if (selectedSectionName && selectedSectionName !== section.name && selectedSeats.length > 0) {
                          setSelectedSeats([seatLabel]);
                          setUseBundle(false);
                        } else {
                          toggleSeat(seatLabel);
                        }
                        setSelectedSectionName(section.name);
                      }}
                    />
                  ))}
                </div>

                {selectedSeats.length > 0 && (() => {
                  const section = event.seating_sections!.find((s) => s.name === selectedSectionName);
                  const perSeatPrice = useBundle && section ? section.bundle_price! : section?.price ?? 0;
                  const total = selectedSeats.length * (perSeatPrice ?? 0);
                  return (
                    <div className="mt-4 flex flex-col gap-3 border-t border-gray-800 pt-4">
                      <p className="text-sm text-gray-300">
                        {selectedSeats.length} seat{selectedSeats.length === 1 ? '' : 's'} selected: <span className="text-white">
                          {selectedSeats
                            .map((label) => {
                              const match = label.match(/-T(\d+)-(\d+)$/);
                              return match ? `Table ${match[1]}, Seat ${match[2]}` : label;
                            })
                            .join(' · ')}
                        </span>
                      </p>

                      {section?.bundle_enabled && (
                        <label className="flex items-start gap-2 rounded-lg bg-gray-800/70 p-3 text-sm text-gray-200">
                          <input type="checkbox" checked={useBundle} onChange={(e) => setUseBundle(e.target.checked)} className="mt-0.5" />
                          <span>
                            Add bundle upgrade — <span className="font-medium text-white">+${((section.bundle_price ?? 0) - section.price).toFixed(2)}/seat</span>
                            {section.bundle_description && <span className="block text-xs text-gray-400">{section.bundle_description}</span>}
                          </span>
                        </label>
                      )}

                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <span />
                        <button
                          onClick={() => handleBuySeats()}
                          disabled={registering || isPreview || hasEnded}
                          className="rounded-xl bg-gradient-to-r from-marigold to-teal px-6 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                        >
                          {isPreview ? 'Available once published' : hasEnded ? 'Event has ended' : registering ? 'Please wait…' : `Buy ${selectedSeats.length} seat${selectedSeats.length === 1 ? '' : 's'} — $${total.toFixed(2)}`}
                        </button>
                      </div>
                    </div>
                  );
                })()}
                {registerError && <p className="mt-2 text-sm text-magenta">{registerError}</p>}
              </>
            )}
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-4 rounded-2xl bg-gray-900 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <p className="text-sm text-gray-400">{isFree ? 'Free to attend' : 'Ticket price'}</p>
              <p className="font-display text-2xl font-extrabold text-white">{isFree ? 'Free' : `$${event.ticket_price}`}</p>
            </div>
            {myTicket ? (
              <div className="flex flex-col gap-1 sm:items-end">
                <p className="text-sm font-medium text-mint">✓ You're registered</p>
                <Link to={`/pass/${myTicket.id}`} className="text-sm font-medium text-white underline underline-offset-2">
                  View your ticket &amp; QR code
                </Link>
                {canCancelRegistration(myTicket, event.start_date) && (
                  <CancelRegistration ticketId={myTicket.id} eventTitle={event.title} variant="light" className="mt-1"
                    onCancelled={() => { setMyTicket(null); setConfirmedCount((n) => Math.max(n - (myTicket.quantity || 1), 0)); }} />
                )}
              </div>
            ) : !user ? (
              <button
                onClick={() => navigate('/login', { state: { from: location.pathname } })}
                className="rounded-xl bg-gradient-to-r from-marigold to-teal px-6 py-3 text-sm font-semibold text-white hover:opacity-90 sm:w-auto"
              >
                Sign in to {isFree ? 'register' : 'buy a ticket'}
              </button>
            ) : hasEnded ? (
              <p className="text-sm font-medium text-gray-400">This event has ended.</p>
            ) : isFull ? (
              <p className="text-sm font-medium text-gray-400">This event is full.</p>
            ) : (
              <div className="flex flex-col items-stretch gap-2 sm:items-end">
                <button
                  onClick={isFree ? handleRegister : handleBuyTicket}
                  disabled={registering || isPreview || hasEnded}
                  className="rounded-xl bg-gradient-to-r from-marigold to-teal px-6 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {isPreview ? 'Available once published' : hasEnded ? 'Event has ended' : registering ? 'Please wait…' : isFree ? 'Register — Free' : `Buy Ticket — $${event.ticket_price}`}
                </button>
                {registerError && <p className="text-sm text-magenta">{registerError}</p>}
              </div>
            )}
          </div>
        )}

        {event.is_recurring && seriesEvents.length > 1 && (
          <div className="mt-6">
            <p className="text-sm font-medium text-gray-700">Recurring event — choose a date</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {seriesEvents.map((e) => (
                <Link
                  key={e.id}
                  to={`/events/${e.id}`}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                    e.id === event.id ? 'border-marigold bg-marigold/10 text-marigold' : 'border-gray-200 text-gray-700 hover:border-marigold hover:text-marigold'
                  }`}
                >
                  {new Date(e.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Link>
              ))}
            </div>

            {event.series_pass_enabled && !myTicket && (() => {
              const fullPrice = (event.ticket_price ?? 0) * seriesEvents.length;
              const discount = event.series_pass_discount ?? 0;
              const passPrice = Math.round(fullPrice * (1 - discount / 100) * 100) / 100;
              return (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-indigo-50 p-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      Series pass — all {seriesEvents.length} dates for ${passPrice.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {discount}% off the ${fullPrice.toFixed(2)} price of buying each date separately
                    </p>
                  </div>
                  {!user ? (
                    <button
                      onClick={() => navigate('/login', { state: { from: location.pathname } })}
                      className="rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-white hover:bg-marigold/90"
                    >
                      Sign in to buy
                    </button>
                  ) : (
                    <button
                      onClick={handleBuySeriesPass}
                      disabled={registering || isPreview || hasEnded}
                      className="rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-white hover:bg-marigold/90 disabled:opacity-50"
                    >
                      {isPreview ? 'Available once published' : hasEnded ? 'Event has ended' : registering ? 'Please wait…' : 'Buy series pass'}
                    </button>
                  )}
                </div>
              );
            })()}
            {registerError && <p className="mt-2 text-sm text-magenta">{registerError}</p>}
          </div>
        )}
        {event.event_type === 'paid' && !event.external_ticket_url && (
          <p className="mt-2 text-xs text-gray-500">Service and processing fees are non-refundable. If the organizer cancels, you'll be refunded the ticket price. <Link to="/refund-policy" className="underline hover:text-gray-700">Refund policy</Link></p>
        )}

        {/* What to expect: description and features together, since both
            answer the same question ("what is this actually like?"). */}
        {(event.description || (event.features && event.features.length > 0)) && (
          <div className="mt-10">
            <h2 className="font-display text-xl font-bold text-gray-900">What to expect</h2>
            {event.description && (
              <p className="mt-3 whitespace-pre-wrap leading-relaxed text-gray-600">{event.description}</p>
            )}
            {event.features && event.features.length > 0 && (
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {event.features.map((f) => (
                  <div key={f.title} className="flex items-start gap-3 rounded-xl bg-gray-50 p-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-lg leading-none">
                      {resolveFeatureIcon(f.icon)}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-gray-900">{f.title}</span>
                      {f.description && <span className="block text-xs text-gray-500">{f.description}</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <EventProgram eventId={event.id} />

        <CommunityPosts eventId={event.id} />

        {/* Logistics: everything about actually getting there. */}
        {!event.is_online && (
          <div className="mt-10">
            <h2 className="font-display text-xl font-bold text-gray-900">Location</h2>
            <p className="mt-2 font-medium text-gray-900">{event.location_name || 'Venue TBD'}</p>
            {event.location_address && <p className="text-sm text-gray-500">{event.location_address}</p>}

            {(() => {
              const mapQuery = event.latitude && event.longitude
                ? `${event.latitude},${event.longitude}`
                : event.location_address || event.location_name;
              if (!mapQuery) return null;
              const encoded = encodeURIComponent(mapQuery);
              return (
                <div className="mt-3">
                  <div className="overflow-hidden rounded-2xl border border-gray-200">
                    <iframe
                      title="Event location map"
                      src={`https://maps.google.com/maps?q=${encoded}&z=15&output=embed`}
                      className="h-64 w-full"
                      loading="lazy"
                    />
                  </div>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encoded}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-center text-sm font-medium text-gray-700 hover:border-marigold hover:text-marigold"
                    >
                      Get Directions
                    </a>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encoded}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 rounded-lg px-4 py-2 text-center text-sm font-medium text-marigold hover:underline"
                    >
                      View on Google Maps ↗
                    </a>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        <ShopSection ownerType="event" ownerId={event.id} />

        {event.vendor_applications_enabled && (
          <div className="mt-10">
            <h2 className="font-display text-xl font-bold text-gray-900">Become a Vendor</h2>
            <div className="mt-3">
              <VendorApplicationForm
                eventId={event.id}
                feeTiers={event.vendor_fees ?? []}
                groups={event.vendors ?? []}
              />
            </div>
          </div>
        )}

        {/* Extras: lower on the page since they support the event rather than define it. */}
        {event.sponsors && event.sponsors.some((t) => t.sponsors?.length > 0) && (
          <div className="mt-10">
            <h2 className="font-display text-xl font-bold text-gray-900">Sponsors</h2>
            <div className="mt-3 flex flex-col gap-3">
              {event.sponsors
                .filter((t) => t.sponsors?.length > 0)
                .map((tier) => (
                  <div key={tier.tier_name} className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">{tier.tier_name}</span>
                    {tier.sponsors.map((s) => (
                      s.website ? (
                        <a key={s.name} href={s.website} target="_blank" rel="noopener noreferrer" className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-marigold hover:text-marigold">
                          {s.name}
                        </a>
                      ) : (
                        <span key={s.name} className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700">{s.name}</span>
                      )
                    ))}
                  </div>
                ))}
            </div>
          </div>
        )}

        {visibleLinks(event.social_links).length > 0 && (
          <div className="mt-10">
            <EventLinks links={event.social_links} subtitle="Updates, photos, and more from the organizer." />
          </div>
        )}

      </div>
    </div>
  );
}
