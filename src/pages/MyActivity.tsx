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

// A plain <a download> isn't reliably honored across browsers for a
// cross-origin image URL (some just open it instead of downloading it).
// Fetching the bytes and downloading from a same-origin blob URL is the
// robust way to do this; if that ever fails, fall back to just opening it.
async function downloadQr(qrUrl: string, filename: string) {
  try {
    const res = await fetch(qrUrl);
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
    window.open(qrUrl, '_blank');
  }
}

export default function MyActivity() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [tickets, setTickets] = useState<MyTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return; // don't judge auth state until it's actually finished checking
    if (!user) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    if (!user.email) return;
    (async () => {
      const { data } = await supabase
        .from('tickets')
        .select('id, event_id, ticket_type, status, price_paid, quantity, section_name, seat_assignment, events(title, start_date, poster_url, location_name, is_online)')
        .eq('attendee_email', user.email)
        .order('created_at', { ascending: false });

      const mapped = (data ?? []).map((t: any) => ({
        id: t.id,
        event_id: t.event_id,
        ticket_type: t.ticket_type,
        status: t.status,
        price_paid: t.price_paid,
        quantity: t.quantity,
        section_name: t.section_name,
        seat_assignment: t.seat_assignment,
        event_title: t.events?.title ?? 'Untitled event',
        event_start_date: t.events?.start_date ?? null,
        event_poster_url: t.events?.poster_url ?? null,
        event_location_name: t.events?.location_name ?? null,
        event_is_online: !!t.events?.is_online,
      }));
      setTickets(mapped);
      setLoading(false);
    })();
  }, [user, authLoading, navigate, location.pathname]);

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
                        <img src={qrUrl} width={110} height={110} alt="QR code" className="rounded-lg border border-gray-200 p-1" />
                        <button
                          onClick={() => downloadQr(qrUrl, `tapin-ticket-${t.id}.png`)}
                          className="text-center text-xs font-medium text-marigold hover:underline"
                        >
                          Download QR
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
