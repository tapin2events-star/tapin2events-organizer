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
  created_at: string;
  event_title: string;
  event_start_date: string | null;
  event_poster_url: string | null;
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
        .select('id, event_id, ticket_type, status, created_at, events(title, start_date, poster_url)')
        .eq('attendee_email', user.email)
        .order('created_at', { ascending: false });

      const mapped = (data ?? []).map((t: any) => ({
        id: t.id,
        event_id: t.event_id,
        ticket_type: t.ticket_type,
        status: t.status,
        created_at: t.created_at,
        event_title: t.events?.title ?? 'Untitled event',
        event_start_date: t.events?.start_date ?? null,
        event_poster_url: t.events?.poster_url ?? null,
      }));
      setTickets(mapped);
      setLoading(false);
    })();
  }, [user, authLoading, navigate]);

  const statusStyles: Record<string, string> = {
    confirmed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    refunded: 'bg-gray-100 text-gray-800',
    pending: 'bg-orange-100 text-orange-800',
  };

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
          <div className="mt-6 flex flex-col gap-3">
            {tickets.map((t) => (
              <Link
                key={t.id}
                to={`/pass/${t.id}`}
                className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md"
              >
                {t.event_poster_url ? (
                  <img src={t.event_poster_url} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="h-16 w-16 shrink-0 rounded-lg bg-gradient-to-br from-indigo-100 to-teal-100" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-gray-900">{t.event_title}</p>
                  <p className="text-sm text-gray-500">
                    {t.event_start_date
                      ? new Date(t.event_start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : 'Date TBD'}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[t.status] ?? statusStyles.pending}`}>
                  {t.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
