import { useEffect, useState } from 'react';
import TicketPerks from '../components/nearby/TicketPerks';
import { useBrandedTab, useEventWhiteLabel } from '../lib/whiteLabel';
import WhiteLabelHeader from '../components/events/WhiteLabelHeader';
import { useFeature } from '../lib/preview';
import TransferTicket, { canTransfer } from '../components/TransferTicket';
import EventCover from '../components/EventCover';
import { useAuth } from '../context/AuthContext';
import CancelRegistration, { canCancelRegistration } from '../components/CancelRegistration';
import BackButton from '../components/BackButton';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { seatGroups, seatText } from '../lib/seats';
import { TicketSkeleton } from '../components/ui/Skeleton';

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
    tier_name?: string | null;
  };
  event: {
    title: string;
    start_date: string | null;
    location_name: string | null;
    is_online: boolean;
    poster_url: string | null;
    category?: string | null;
    allow_transfers?: boolean;
    organizer_email: string;
  };
  organizerName: string | null;
  contactEmail?: string | null;
  // The rest of the same order: a group's seats at this event, and a series
  // pass's dates. One QR code covers all of them.
  group?: { id: string; section_name: string | null; seat_assignment: string | null; quantity: number; status: string; checked_in_at: string | null }[];
  dates?: { event_id: string; title: string; start_date: string | null; event_status: string; checked_in: boolean }[];
}

export default function TicketPass() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const nearbyOn = useFeature('nearby');
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [data, setData] = useState<PassData | null>(null);
  const whiteLabel = useEventWhiteLabel((data as { event?: { id?: string } } | null)?.event?.id ?? null);
  useBrandedTab(whiteLabel, (data as { event?: { title?: string } } | null)?.event?.title ? `Your ticket: ${(data as { event: { title: string } }).event.title}` : 'Your ticket');
  const { user } = useAuth();
  const invoicesOn = useFeature('invoices');
  const networkingOn = useFeature('networking');
  const galaOn = useFeature('gala');
  const [net, setNet] = useState<{ enabled: boolean; members: number; me: object | null; requests: number } | null>(null);
  const [cancelledNow, setCancelledNow] = useState(false);
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
    const { data: result, error: fnError } = await supabase.functions.invoke('send-app-email', {
      body: { kind: 'ticket_copy', ticket_id: ticketId },
    });
    if (fnError?.context?.status === 401 || result?.error === 'Unauthorized' || result?.error === 'Please sign in.') {
      setEmailState('signin_required');
    } else if (fnError || result?.error) {
      setEmailState('error');
    } else {
      setEmailState('sent');
    }
  }

  if (loading) return <TicketSkeleton />;
  if (error || !data) return <div className="p-10 text-center text-magenta">{error || 'Ticket not found.'}</div>;

  const { ticket, event, organizerName, contactEmail } = data;
  const group = (data.group ?? []).filter((t) => t.status !== 'cancelled');
  const people = group.reduce((n, t) => n + (Number(t.quantity) || 1), 0);
  const seated = group.some((t) => t.seat_assignment);
  const dates = data.dates ?? [];
  const passUrl = window.location.origin + import.meta.env.BASE_URL + 'pass/' + ticket.id;
  const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(passUrl)}&size=300&margin=2`;
  const isCancelled = ticket.status !== 'confirmed';

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white print:bg-white">
      <div className="print:hidden">
      </div>
      <div className="mx-auto max-w-md px-4 py-10 print:py-0">
        {!whiteLabel && <BackButton fallback="/activity" fallbackLabel="My tickets" />}

        {whiteLabel && <WhiteLabelHeader brand={whiteLabel} />}
        {whiteLabel?.slug && <Link to={`/tickets/${whiteLabel.slug}`} className="mt-2 inline-block text-sm font-semibold print:hidden" style={{ color: whiteLabel.primary }}>All my {whiteLabel.name} tickets &rarr;</Link>}
        <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm print:mt-0 print:shadow-none">
          {cancelledNow && (
            <p role="status" className="bg-green-50 px-4 py-3 text-center text-sm text-green-800">Your registration is cancelled. Thanks for letting the organizer know.</p>
          )}
          {event.poster_url ? (
            <img src={event.poster_url} alt="" className="h-40 w-full object-cover" />
          ) : (
            <EventCover category={event.category} className="h-40 w-full" />
          )}
          <div className="p-6">
            <p className="text-xs uppercase tracking-widest text-gray-400">
              {ticket.ticket_type === 'series_pass' ? 'Series Pass' : ticket.tier_name ? ticket.tier_name : 'Event Ticket'}
            </p>
            <h1 className="mt-1 font-display text-xl font-bold text-gray-900">{event.title}</h1>

            {isCancelled ? (
              <div className="mt-4 rounded-xl bg-red-50 p-4 text-center text-sm font-medium text-magenta">
                {ticket.status === 'transferred'
                  ? 'This ticket was transferred to someone else and is no longer valid. The new holder has their own ticket.'
                  : `This ticket is ${ticket.status} and is not valid for entry.`}
              </div>
            ) : (
              <>
                <div className="mt-6 flex justify-center">
                  <img src={qrUrl} width={200} height={200} alt="QR code" className="rounded-2xl border border-gray-200 p-2" />
                </div>
                <p className="mt-2 text-center text-xs text-gray-400">
                  {dates.length > 1 ? 'Show this same code at every date' : people > 1 ? `One code checks in your whole group (${people} ${seated ? 'seats' : 'tickets'})` : 'Scan this code at the entrance'}
                </p>
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
              {seated && people > 1 ? (
                <div>
                  <span className="text-gray-400">Seats</span>
                  {seatGroups(group).map((g) => (
                    <div key={g.label} className="mt-1">
                      <p className="text-xs font-semibold text-gray-700">{g.label}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {g.seats.map((s) => <span key={s} className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">Seat {s}</span>)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (ticket.section_name || ticket.seat_assignment) ? (
                <div className="flex justify-between">
                  <span className="text-gray-400">Seat</span>
                  <span className="font-medium text-gray-900">{seatText(ticket.section_name, ticket.seat_assignment)}</span>
                </div>
              ) : people > 1 ? (
                <div className="flex justify-between">
                  <span className="text-gray-400">Tickets</span>
                  <span className="font-medium text-gray-900">{people}</span>
                </div>
              ) : null}
              {dates.length > 1 && (
                <div>
                  <span className="text-gray-400">Series pass · {dates.length} dates</span>
                  <ul className="mt-1 flex flex-col gap-1">
                    {dates.map((d) => (
                      <li key={d.event_id} className="flex justify-between text-xs">
                        <span className={`font-medium ${d.event_status === 'cancelled' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                          {d.start_date ? new Date(d.start_date).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Date TBA'}
                        </span>
                        <span className={d.checked_in ? 'font-semibold text-green-700' : 'text-gray-400'}>{d.checked_in ? '✓ Attended' : d.event_status === 'cancelled' ? 'Cancelled' : ''}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-400">Holder</span>
                <span className="font-medium text-gray-900">{ticket.attendee_email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Organized by</span>
                <span className="text-right font-medium text-gray-900">{organizerName || event.organizer_email}</span>
              </div>
              {(contactEmail || event.organizer_email) && (
                <div className="flex justify-end print:hidden">
                  <a href={`mailto:${contactEmail || event.organizer_email}`} className="text-xs font-medium" style={{ color: whiteLabel?.primary ?? '#4F46E5' }}>Contact organizer</a>
                </div>
              )}
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
        {galaOn && <GalaInfo eventId={ticket.event_id} />}
        <NetworkingButton on={networkingOn} eventId={ticket.event_id} net={net} setNet={setNet} />
        {invoicesOn && user?.email?.toLowerCase() === ticket.attendee_email.toLowerCase() && Number(ticket.price_paid ?? 0) > 0 && (
          <div className="mt-3 text-center print:hidden">
            <Link to={`/receipt?ticket=${ticket.id}`} className="text-sm font-medium text-marigold">🧾 Receipt (for expense reports)</Link>
          </div>
        )}
        {!isCancelled && user?.email?.toLowerCase() === ticket.attendee_email.toLowerCase() && canTransfer(ticket, event.start_date, ticket.ticket_type === 'series_pass') && event.allow_transfers !== false && (
          <div className="mt-4 text-center print:hidden">
            <TransferTicket ticketId={ticket.id} eventTitle={event.title} isSeriesPass={ticket.ticket_type === 'series_pass'}
              className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:border-marigold" />
          </div>
        )}
        {!isCancelled && nearbyOn && <div className="print:hidden"><TicketPerks ticketId={ticket.id} /></div>}
        {!isCancelled && user?.email === ticket.attendee_email && canCancelRegistration(ticket, event.start_date) && (
          <div className="mt-5 text-center print:hidden">
            <CancelRegistration ticketId={ticket.id} eventTitle={event.title}
              onCancelled={() => { setCancelledNow(true); setData((d) => d && { ...d, ticket: { ...d.ticket, status: 'cancelled' } }); }} />
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

// Ticket pass (Preview): jump into the event's networking list.
function NetworkingButton({ on, eventId, net, setNet }: { on: boolean; eventId: string; net: { enabled: boolean; members: number; me: object | null; requests: number } | null; setNet: (n: { enabled: boolean; members: number; me: object | null; requests: number } | null) => void }) {
  useEffect(() => { if (on && eventId) supabase.rpc('networking_status', { p_event_id: eventId }).then(({ data }) => setNet((data ?? null) as typeof net)); }, [on, eventId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!on || !net?.enabled) return null;
  return (
    <div className="mt-3 text-center print:hidden">
      <Link to={`/events/${eventId}/network`} className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">
        🤝 Networking · {net.members} {net.members === 1 ? 'person' : 'people'}{net.requests ? ` · ${net.requests} new` : ''}{!net.me ? ' · Join' : ''}
      </Link>
    </div>
  );
}

// Gala (Preview): the guest's table and paddle number.
function GalaInfo({ eventId }: { eventId: string }) {
  const [info, setInfo] = useState<{ table: string | null; paddle: number | null } | null>(null);
  useEffect(() => { supabase.rpc('my_gala_info', { p_event_id: eventId }).then(({ data }) => setInfo((data ?? null) as typeof info)); }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!info || (!info.table && !info.paddle)) return null;
  return (
    <div className="mt-3 flex justify-center gap-2 print:hidden">
      {info.table && <span className="rounded-2xl bg-gray-900 px-4 py-2 text-center text-white"><span className="block text-[10px] uppercase tracking-widest opacity-75">Table</span><span className="block text-lg font-extrabold">{info.table}</span></span>}
      {info.paddle && <span className="rounded-2xl bg-emerald-600 px-4 py-2 text-center text-white"><span className="block text-[10px] uppercase tracking-widest opacity-80">Paddle</span><span className="block text-lg font-extrabold">#{info.paddle}</span></span>}
    </div>
  );
}
