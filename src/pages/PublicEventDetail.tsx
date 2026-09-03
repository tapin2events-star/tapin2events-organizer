import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import type { TapEvent, Ticket } from '../lib/types';
import ShopSection from '../components/products/ShopSection';

export default function PublicEventDetail() {
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [event, setEvent] = useState<TapEvent | null>(null);
  const [organizerName, setOrganizerName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [myTicket, setMyTicket] = useState<Ticket | null>(null);
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const checkoutStatus = searchParams.get('checkout'); // 'success' | 'cancelled' | null

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase.from('events').select('*').eq('id', id).single();
      const ev = data as TapEvent | null;
      setEvent(ev);
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

  if (loading) return <div className="p-10 text-center text-gray-500">Loading…</div>;
  if (!event) return <div className="p-10 text-center text-magenta">Event not found.</div>;

  const isFull = !!event.max_capacity && confirmedCount >= event.max_capacity && !myTicket;
  const isFree = event.event_type === 'free';

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Link to="/" className="text-sm text-marigold hover:underline">&larr; Back to Discover</Link>

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

        {event.poster_url ? (
          <div className="mt-4 aspect-[21/9] w-full overflow-hidden rounded-2xl bg-gray-100">
            <img src={event.poster_url} alt="" className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="mt-4 flex aspect-[21/9] w-full items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-teal-100" />
        )}

        <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-gray-500">{event.category}</p>
            <h1 className="font-display text-3xl font-extrabold text-gray-900">{event.title}</h1>
            {event.start_date && (
              <p className="mt-1 text-gray-500">
                {new Date(event.start_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                {' at '}
                {new Date(event.start_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </p>
            )}
          </div>
          {isFree ? (
            <span className="rounded-full border border-green-600 px-3 py-1 text-sm font-medium text-green-600">Free</span>
          ) : (
            <span className="text-2xl font-bold text-gray-900">${event.ticket_price}</span>
          )}
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="md:col-span-2">
            <h2 className="font-display text-lg font-semibold text-gray-900">About this event</h2>
            <p className="mt-2 whitespace-pre-wrap text-gray-600">{event.description || 'No description provided.'}</p>

            <h2 className="mt-8 font-display text-lg font-semibold text-gray-900">Location</h2>
            <p className="mt-2 text-gray-600">
              {event.is_online ? 'Virtual event' : (event.location_name || 'Venue TBD')}
            </p>
            {event.location_address && !event.is_online && (
              <p className="text-sm text-gray-400">{event.location_address}</p>
            )}

            <ShopSection ownerType="event" ownerId={event.id} />
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="text-xs uppercase tracking-widest text-gray-400">Organized by</p>
            <p className="mt-1 font-medium text-gray-900">{organizerName || event.organizer_email}</p>

            {myTicket ? (
              <div className="mt-5 rounded-xl bg-green-50 p-4 text-sm text-green-700">
                <p>✓ You're registered for this event.</p>
                <Link to={`/pass/${myTicket.id}`} className="mt-2 inline-block font-medium underline">
                  View your ticket &amp; QR code
                </Link>
              </div>
            ) : !user ? (
              <button
                onClick={() => navigate('/login', { state: { from: location.pathname } })}
                className="mt-5 w-full rounded-lg bg-gradient-to-r from-marigold to-mint px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
              >
                Sign in to {isFree ? 'register' : 'buy a ticket'}
              </button>
            ) : isFull ? (
              <div className="mt-5 rounded-xl bg-gray-50 p-4 text-sm text-gray-500">This event is full.</div>
            ) : (
              <>
                <button
                  onClick={isFree ? handleRegister : handleBuyTicket}
                  disabled={registering}
                  className="mt-5 w-full rounded-lg bg-gradient-to-r from-marigold to-mint px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {registering ? 'Please wait…' : isFree ? 'Register — Free' : `Buy Ticket — $${event.ticket_price}`}
                </button>
                {registerError && <p className="mt-2 text-sm text-magenta">{registerError}</p>}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
