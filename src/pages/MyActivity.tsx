import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import PublicHeader from '../components/discover/PublicHeader';

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

function buildTicketEmailHtml(t: MyTicket, qrUrl: string, passUrl: string) {
  const eventDate = t.event_start_date
    ? new Date(t.event_start_date).toLocaleString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
      })
    : 'Date to be announced';
  return `
    <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#4f46e5,#14b8a6);padding:24px;color:white;">
        <div style="font-size:20px;font-weight:800;">TapIN</div>
        <div style="margin-top:8px;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;opacity:0.9;">Your ticket</div>
      </div>
      ${t.event_poster_url ? `<img src="${t.event_poster_url}" style="width:100%;display:block;max-height:200px;object-fit:cover;" />` : ''}
      <div style="padding:24px;">
        <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">${t.event_title}</h1>
        <table style="width:100%;font-size:14px;color:#374151;">
          <tr><td style="padding:4px 0;color:#6b7280;width:80px;">When</td><td style="padding:4px 0;font-weight:600;">${eventDate}</td></tr>
          <tr><td style="padding:4px 0;color:#6b7280;">Where</td><td style="padding:4px 0;font-weight:600;">${t.event_is_online ? 'Virtual event' : (t.event_location_name || 'Venue TBD')}</td></tr>
          <tr><td style="padding:4px 0;color:#6b7280;">Holder</td><td style="padding:4px 0;font-weight:600;">${t.attendee_email}</td></tr>
        </table>
        <div style="text-align:center;margin:24px 0 16px;">
          <img src="${qrUrl}" width="180" height="180" alt="QR code" style="border:1px solid #e5e7eb;border-radius:16px;padding:8px;background:#ffffff;" />
          <p style="margin:10px 0 0;font-size:12px;color:#9ca3af;">Scan this code at the entrance</p>
        </div>
        <a href="${passUrl}" style="display:block;text-align:center;background:linear-gradient(135deg,#4f46e5,#14b8a6);color:#ffffff;padding:12px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px;">View Your Ticket Online</a>
      </div>
    </div>`;
}

export default function MyActivity() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [tickets, setTickets] = useState<MyTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [emailedId, setEmailedId] = useState<string | null>(null);

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
    const passUrl = `${window.location.origin}${import.meta.env.BASE_URL}pass/${t.id}`;
    const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(passUrl)}&size=300&margin=1`;
    const html = buildTicketEmailHtml(t, qrUrl, passUrl);
    const { error } = await supabase.functions.invoke('send-ticket-confirmation', {
      body: { to: t.attendee_email, subject: `Your ticket: ${t.event_title}`, html },
    });
    setBusyId(null);
    if (!error) {
      setEmailedId(t.id);
      setTimeout(() => setEmailedId((id) => (id === t.id ? null : id)), 3000);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white">
      <PublicHeader />
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-display text-3xl font-extrabold text-gray-900">My Activity</h1>
        <p className="mt-1 text-gray-500">Every event you've registered for or bought a ticket to.</p>

        {loading ? (
          <p className="mt-6 text-gray-500">Loading…</p>
        ) : tickets.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-white/60 py-16 text-center">
            <p className="text-lg font-semibold text-gray-500">No tickets yet</p>
            <Link to="/" className="mt-3 inline-block text-marigold hover:underline">Browse events to get started &rarr;</Link>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-4">
            {tickets.map((t) => {
              const passUrl = `${window.location.origin}${import.meta.env.BASE_URL}pass/${t.id}`;
              const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(passUrl)}&size=300&margin=1`;
              return (
                <div key={t.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                  <div className="flex flex-col gap-4 p-5 sm:flex-row">
                    {t.event_poster_url ? (
                      <img src={t.event_poster_url} alt="" className="h-32 w-full shrink-0 rounded-lg object-cover sm:w-32" />
                    ) : (
                      <div className="h-32 w-full shrink-0 rounded-lg bg-gradient-to-br from-indigo-100 to-teal-100 sm:w-32" />
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
                          {t.ticket_type === 'series_pass' ? 'Series Pass' : 'General admission'} &middot; Qty {t.quantity}
                          {t.price_paid > 0 ? ` \u00b7 $${t.price_paid}` : ' \u00b7 Free'}
                          {(t.section_name || t.seat_assignment) && ` \u00b7 ${[t.section_name, t.seat_assignment].filter(Boolean).join(' ')}`}
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
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
