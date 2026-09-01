import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import PublicHeader from '../components/discover/PublicHeader';

interface PassData {
  ticket: {
    id: string;
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
  const [data, setData] = useState<PassData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) return (<><PublicHeader /><div className="p-10 text-center text-gray-500">Loading…</div></>);
  if (error || !data) return (<><PublicHeader /><div className="p-10 text-center text-magenta">{error || 'Ticket not found.'}</div></>);

  const { ticket, event, organizerName } = data;
  const passUrl = window.location.href;
  const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(passUrl)}&size=300&margin=2`;
  const isCancelled = ticket.status !== 'confirmed';

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white">
      <PublicHeader />
      <div className="mx-auto max-w-md px-4 py-10">
        <Link to="/" className="text-sm text-marigold hover:underline">&larr; Back to Discover</Link>

        <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
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
      </div>
    </div>
  );
}
