import { useEffect, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import PublicHeader from '../components/discover/PublicHeader';

interface PassData {
  ticket: {
    id: string;
    event_id: string;
    ticket_type: string;
    quantity: number;
    price_paid: number;
    status: string;
    attendee_email: string;
    section_name: string | null;
    seat_assignment: string | null;
  };
  event: {
    title: string;
    start_date: string | null;
    location_name: string | null;
    is_online: boolean;
    poster_url: string | null;
    organizer_email: string;
  };
  organizerName: string | null;
}

export default function TicketPass() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [data, setData] = useState<PassData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emailState, setEmailState] = useState<'idle' | 'sending' | 'sent' | 'signin_required' | 'error'>('idle');

  useEffect(() => {
    if (!ticketId) return;
    (async () => {
      const { data: result, error: fnError } = await supabase.functions.invoke('get-ticket-pass', {
        body: { ticket_id: ticketId },
      });
      if (fnError || !result || result.error) {
        setError('This ticket could not be found.');
      } else {
        setData(result as PassData);
      }
      setLoading(false);
    })();
  }, [ticketId]);

  // Support a one-click "download" from elsewhere in the app: opening this
  // page with ?print=1 auto-triggers the browser's print/Save-as-PDF dialog
  // once the ticket has actually loaded.
  useEffect(() => {
    if (!data || searchParams.get('print') !== '1') return;
    const t = setTimeout(() => window.print(), 500);
    return () => clearTimeout(t);
  }, [data, searchParams]);

  async function handleEmailTicket() {
    if (!ticketId) return;
    setEmailState('sending');
    const { data: result, error: fnError } = await supabase.functions.invoke('email-ticket', {
      body: { ticket_id: ticketId },
    });
    if (fnError?.context?.status === 401 || result?.error === 'Unauthorized') {
      setEmailState('signin_required');
    } else if (fnError || result?.error) {
      setEmailState('error');
    } else {
      setEmailState('sent');
    }
  }

  if (loading) return (<><PublicHeader /><div className="p-10 text-center text-gray-500">Loading…</div></>);
  if (error || !data) return (<><PublicHeader /><div className="p-10 text-center text-magenta">{error || 'Ticket not found.'}</div></>);

  const { ticket, event, organizerName } = data;
  const passUrl = window.location.origin + import.meta.env.BASE_URL + 'pass/' + ticket.id;
  const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(passUrl)}&size=300&margin=2`;
  const isCancelled = ticket.status !== 'confirmed';

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white print:bg-white">
      <div className="print:hidden">
        <PublicHeader />
      </div>
      <div className="mx-auto max-w-md px-4 py-10 print:py-0">
        <Link to={`/events/${ticket.event_id}`} className="text-sm text-marigold hover:underline print:hidden">&larr; Back to event</Link>

        <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm print:mt-0 print:shadow-none">
          {event.poster_url && (
            <img src={event.poster_url} alt="" className="h-40 w-full object-cover" />
          )}
          <div className="p-6">
            <p className="text-xs uppercase tracking-widest text-gray-400">
              {ticket.ticket_type === 'series_pass' ? 'Series Pass' : 'Event Ticket'}
            </p>
            <h1 className="mt-1 font-display text-xl font-bold text-gray-900">{event.title}</h1>

            {isCancelled ? (
              <div className="mt-4 rounded-xl bg-red-50 p-4 text-center text-sm font-medium text-magenta">
                This ticket is {ticket.status} and is not valid for entry.
              </div>
            ) : (
              <>
                <div className="mt-6 flex justify-center">
                  <img src={qrUrl} width={200} height={200} alt="QR code" className="rounded-2xl border border-gray-200 p-2" />
                </div>
                <p className="mt-2 text-center text-xs text-gray-400">Scan this code at the entrance</p>
              </>
            )}

            <div className="mt-6 space-y-2 border-t border-gray-100 pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">When</span>
                <span className="font-medium text-gray-900">
                  {event.start_date
                    ? new Date(event.start_date).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                    : 'TBD'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Where</span>
                <span className="font-medium text-gray-900">{event.is_online ? 'Virtual event' : (event.location_name || 'TBD')}</span>
              </div>
              {(ticket.section_name || ticket.seat_assignment) && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Seat</span>
                  <span className="font-medium text-gray-900">
                    {[ticket.section_name, ticket.seat_assignment].filter(Boolean).join(' · ')}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-400">Holder</span>
                <span className="font-medium text-gray-900">{ticket.attendee_email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Organized by</span>
                <span className="font-medium text-gray-900">{organizerName || event.organizer_email}</span>
              </div>
            </div>
          </div>
        </div>

        {!isCancelled && (
          <div className="mt-4 flex gap-2 print:hidden">
            <button
              onClick={() => window.print()}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:border-marigold hover:text-marigold"
            >
              Download ticket (PDF)
            </button>
            <button
              onClick={handleEmailTicket}
              disabled={emailState === 'sending'}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:border-marigold hover:text-marigold disabled:opacity-50"
            >
              {emailState === 'sending' ? 'Sending…' : emailState === 'sent' ? 'Sent \u2713' : 'Email me this ticket'}
            </button>
          </div>
        )}
        {emailState === 'signin_required' && (
          <p className="mt-2 text-center text-sm text-gray-500 print:hidden">
            <Link to="/login" state={{ from: location.pathname }} className="text-marigold hover:underline">Sign in</Link> to email yourself a copy.
          </p>
        )}
        {emailState === 'error' && (
          <p className="mt-2 text-center text-sm text-magenta print:hidden">Something went wrong sending that. Please try again.</p>
        )}
      </div>
    </div>
  );
}
