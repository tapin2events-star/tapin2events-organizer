import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import type { TapEvent, Ticket } from '../lib/types';
import ShopSection from '../components/products/ShopSection';
import VendorApplicationForm from '../components/VendorApplicationForm';

export default function PublicEventDetail() {
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [event, setEvent] = useState<TapEvent | null>(null);
  const [seriesEvents, setSeriesEvents] = useState<{ id: string; start_date: string }[]>([]);
  const [selectedSectionName, setSelectedSectionName] = useState<string | null>(null);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
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
          .from('profiles')
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
    supabase.from('profiles').select('interests').eq('email', user.email).single().then(({ data }) => {
      setSavedIds((data?.interests as string[]) ?? []);
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
    await supabase.from('profiles').update({ interests: next }).eq('email', user.email);
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
    if (!id || !event || !user?.email) return;
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
    const eventDate = event.start_date
      ? new Date(event.start_date).toLocaleString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
        })
      : 'Date to be announced';
    const passUrl = `${window.location.origin}${import.meta.env.BASE_URL}pass/${ticket.id}`;
    const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(passUrl)}&size=300&margin=2`;
    const html = `
      <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#4f46e5,#14b8a6);padding:24px;color:white;">
          <div style="font-size:20px;font-weight:800;">TapIN</div>
          <div style="margin-top:8px;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;opacity:0.9;">You're registered</div>
        </div>
        ${event.poster_url ? `<img src="${event.poster_url}" style="width:100%;display:block;max-height:200px;object-fit:cover;" />` : ''}
        <div style="padding:24px;">
          <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">${event.title}</h1>
          <table style="width:100%;font-size:14px;color:#374151;">
            <tr><td style="padding:4px 0;color:#6b7280;width:80px;">When</td><td style="padding:4px 0;font-weight:600;">${eventDate}</td></tr>
            <tr><td style="padding:4px 0;color:#6b7280;">Where</td><td style="padding:4px 0;font-weight:600;">${event.is_online ? 'Virtual event' : (event.location_name || 'Venue TBD')}</td></tr>
            <tr><td style="padding:4px 0;color:#6b7280;">Holder</td><td style="padding:4px 0;font-weight:600;">${user.email}</td></tr>
          </table>
          <div style="text-align:center;margin:24px 0 16px;">
            <img src="${qrUrl}" width="180" height="180" alt="QR code" style="border:1px solid #e5e7eb;border-radius:16px;padding:8px;background:#ffffff;" />
            <p style="margin:10px 0 0;font-size:12px;color:#9ca3af;">Scan this code at the entrance</p>
          </div>
          <a href="${passUrl}" style="display:block;text-align:center;background:linear-gradient(135deg,#4f46e5,#14b8a6);color:#ffffff;padding:12px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px;">View Your Ticket Online</a>
        </div>
      </div>`;
    supabase.functions
      .invoke('send-ticket-confirmation', { body: { to: user.email, subject: `You're registered: ${event.title}`, html } })
      .catch(() => { /* registration already succeeded; email is best-effort */ });
  }

  async function handleBuyTicket() {
    if (!id || !event) return;
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
    if (!id || !event || !selectedSectionName) return;
    setRegistering(true);
    setRegisterError(null);

    const base = window.location.origin + import.meta.env.BASE_URL;
    const { data, error } = await supabase.functions.invoke('create-seated-checkout', {
      body: {
        event_id: id,
        section_name: selectedSectionName,
        quantity: selectedQuantity,
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

  if (loading) return <div className="p-10 text-center text-gray-500">Loading…</div>;
  if (!event) return <div className="p-10 text-center text-magenta">Event not found.</div>;

  const isFull = !!event.max_capacity && confirmedCount >= event.max_capacity && !myTicket;
  const isFree = event.event_type === 'free';

  return (
    <div className="min-h-screen bg-white">
      {/* Hero: title and key facts live directly on the image, editorial-style,
          instead of a separate text block below a plain picture frame. */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-gray-900 sm:aspect-[21/9]">
        {event.poster_url ? (
          <img src={event.poster_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-indigo-600 via-indigo-500 to-teal-500" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        <Link
          to="/"
          className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 sm:left-6 sm:top-6"
        >
          &larr;
        </Link>

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
            <button onClick={handleShare} className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-marigold">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
              {shareCopied ? 'Copied!' : 'Share'}
            </button>
            <button onClick={toggleSave} className={`flex items-center gap-1.5 text-sm font-medium ${id && savedIds.includes(id) ? 'text-marigold' : 'text-gray-500 hover:text-marigold'}`}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill={id && savedIds.includes(id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" strokeLinejoin="round" /></svg>
              {id && savedIds.includes(id) ? 'Saved' : 'Save'}
            </button>
          </span>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
          <div>
            <span className="text-gray-400">Organized by </span>
            <span className="font-medium text-gray-700">{organizerName || event.organizer_email}</span>
          </div>
          <a href={`mailto:${event.organizer_email}`} className="font-medium text-marigold hover:underline">
            Contact organizer
          </a>
        </div>

        {user?.email === event.organizer_email && (
          <div className="mt-3 flex flex-wrap gap-2 rounded-xl bg-gray-50 p-4">
            <Link to={`/organizer/events/${event.id}`} className="rounded-lg bg-marigold px-3 py-1.5 text-xs font-semibold text-white hover:bg-marigold/90">
              Dashboard
            </Link>
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
        {event.is_seating_enabled && event.seating_sections && event.seating_sections.length > 0 ? (
          <div className="mt-6 rounded-2xl bg-gray-900 p-5 sm:p-6">
            <p className="text-sm text-gray-400">Reserved seating — choose a section</p>
            {myTicket ? (
              <div className="mt-3">
                <p className="text-sm font-medium text-mint">✓ You're registered</p>
                <Link to={`/pass/${myTicket.id}`} className="text-sm font-medium text-white underline underline-offset-2">
                  View your ticket &amp; QR code
                </Link>
              </div>
            ) : !user ? (
              <button
                onClick={() => navigate('/login', { state: { from: location.pathname } })}
                className="mt-3 rounded-xl bg-gradient-to-r from-marigold to-mint px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
              >
                Sign in to choose seats
              </button>
            ) : (
              <>
                <div className="mt-3 flex flex-col gap-2">
                  {event.seating_sections.map((section) => {
                    const bookedInSection = (event.booked_seats ?? []).filter((s) => s.startsWith(`${section.name}-`)).length;
                    const available = section.total_seats - bookedInSection;
                    const isSelected = selectedSectionName === section.name;
                    return (
                      <button
                        key={section.name}
                        disabled={available <= 0}
                        onClick={() => { setSelectedSectionName(section.name); setSelectedQuantity(1); }}
                        className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left disabled:cursor-not-allowed disabled:opacity-40 ${
                          isSelected ? 'border-marigold bg-marigold/10' : 'border-gray-700 hover:border-marigold'
                        }`}
                      >
                        <span>
                          <span className="block text-sm font-semibold text-white">{section.name}</span>
                          <span className="block text-xs text-gray-400">{available > 0 ? `${available} seat${available === 1 ? '' : 's'} left` : 'Sold out'}</span>
                        </span>
                        <span className="font-display text-lg font-bold text-white">${section.price}</span>
                      </button>
                    );
                  })}
                </div>

                {selectedSectionName && (
                  <div className="mt-4 flex flex-col gap-3 border-t border-gray-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <label className="flex items-center gap-2 text-sm text-gray-300">
                      Quantity
                      <input
                        type="number"
                        min="1"
                        max={(event.seating_sections.find((s) => s.name === selectedSectionName)?.total_seats ?? 1)}
                        value={selectedQuantity}
                        onChange={(e) => setSelectedQuantity(Math.max(1, Number(e.target.value) || 1))}
                        className="w-20 rounded-lg border border-gray-700 bg-gray-800 px-2 py-1 text-white"
                      />
                    </label>
                    <button
                      onClick={handleBuySeats}
                      disabled={registering}
                      className="rounded-xl bg-gradient-to-r from-marigold to-mint px-6 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {registering ? 'Please wait…' : `Buy ${selectedQuantity} seat${selectedQuantity === 1 ? '' : 's'} in ${selectedSectionName}`}
                    </button>
                  </div>
                )}
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
              </div>
            ) : !user ? (
              <button
                onClick={() => navigate('/login', { state: { from: location.pathname } })}
                className="rounded-xl bg-gradient-to-r from-marigold to-mint px-6 py-3 text-sm font-semibold text-white hover:opacity-90 sm:w-auto"
              >
                Sign in to {isFree ? 'register' : 'buy a ticket'}
              </button>
            ) : isFull ? (
              <p className="text-sm font-medium text-gray-400">This event is full.</p>
            ) : (
              <div className="flex flex-col items-stretch gap-2 sm:items-end">
                <button
                  onClick={isFree ? handleRegister : handleBuyTicket}
                  disabled={registering}
                  className="rounded-xl bg-gradient-to-r from-marigold to-mint px-6 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {registering ? 'Please wait…' : isFree ? 'Register — Free' : `Buy Ticket — $${event.ticket_price}`}
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
          </div>
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
                  <div key={f.title} className="flex items-start gap-2.5 rounded-xl bg-gray-50 p-3">
                    <span className="text-xl leading-none">{f.icon}</span>
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
            <VendorApplicationForm
              eventId={event.id}
              feeTiers={event.vendor_fees ?? []}
              groups={event.vendors ?? []}
            />
          </div>
        )}

        {/* Extras: lighter-weight, lower on the page since they support the
            event rather than define it. */}
        {((event.sponsors && event.sponsors.some((t) => t.sponsors?.length > 0)) ||
          (event.social_links && (event.social_links.instagram || event.social_links.facebook || event.social_links.website))) && (
          <div className="mt-10 border-t border-gray-100 pt-8">
            {event.sponsors && event.sponsors.some((t) => t.sponsors?.length > 0) && (
              <div>
                <p className="text-sm font-medium text-gray-500">Sponsors</p>
                <div className="mt-2 flex flex-col gap-3">
                  {event.sponsors
                    .filter((t) => t.sponsors?.length > 0)
                    .map((tier) => (
                      <div key={tier.tier_name} className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-gray-400">{tier.tier_name}:</span>
                        {tier.sponsors.map((s) => (
                          s.website ? (
                            <a key={s.name} href={s.website} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-gray-700 underline-offset-2 hover:text-marigold hover:underline">
                              {s.name}
                            </a>
                          ) : (
                            <span key={s.name} className="text-sm font-medium text-gray-700">{s.name}</span>
                          )
                        ))}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {event.social_links && (event.social_links.instagram || event.social_links.facebook || event.social_links.website) && (
              <div className="mt-4 flex flex-wrap gap-3">
                {event.social_links.instagram && (
                  <a href={event.social_links.instagram} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:border-marigold hover:text-marigold">Instagram</a>
                )}
                {event.social_links.facebook && (
                  <a href={event.social_links.facebook} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:border-marigold hover:text-marigold">Facebook</a>
                )}
                {event.social_links.website && (
                  <a href={event.social_links.website} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:border-marigold hover:text-marigold">Website</a>
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
