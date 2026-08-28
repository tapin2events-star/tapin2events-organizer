import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import type { TapEvent, Ticket } from '../lib/types';
import PublicHeader from '../components/discover/PublicHeader';

export default function PublicEventDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState<TapEvent | null>(null);
  const [organizerName, setOrganizerName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [myTicket, setMyTicket] = useState<Ticket | null>(null);
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

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
    if (!id || !event || event.event_type !== 'free') return;
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
  }, [id, event, user?.email]);

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
  }

  if (loading) return (<><PublicHeader /><div className="p-10 text-center text-gray-500">Loading…</div></>);
  if (!event) return (<><PublicHeader /><div className="p-10 text-center text-magenta">Event not found.</div></>);

  const isFull = !!event.max_capacity && confirmedCount >= event.max_capacity && !myTicket;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white">
      <PublicHeader />
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Link to="/" className="text-sm text-marigold hover:underline">&larr; Back to Discover</Link>

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
          {event.event_type === 'free' ? (
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
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="text-xs uppercase tracking-widest text-gray-400">Organized by</p>
            <p className="mt-1 font-medium text-gray-900">{organizerName || event.organizer_email}</p>

            {event.event_type !== 'free' ? (
              <div className="mt-5 rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
                Online ticket purchasing is coming soon. Contact the organizer directly for now.
              </div>
            ) : myTicket ? (
              <div className="mt-5 rounded-xl bg-green-50 p-4 text-sm text-green-700">
                ✓ You're registered for this event.
              </div>
            ) : !user ? (
              <button
                onClick={() => navigate('/login')}
                className="mt-5 w-full rounded-lg bg-gradient-to-r from-marigold to-mint px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
              >
                Sign in to register
              </button>
            ) : isFull ? (
              <div className="mt-5 rounded-xl bg-gray-50 p-4 text-sm text-gray-500">This event is full.</div>
            ) : (
              <>
                <button
                  onClick={handleRegister}
                  disabled={registering}
                  className="mt-5 w-full rounded-lg bg-gradient-to-r from-marigold to-mint px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {registering ? 'Registering…' : 'Register — Free'}
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
