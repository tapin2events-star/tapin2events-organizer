import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import type { Resource, ResourceBooking } from '../lib/types';
import PublicHeader from '../components/discover/PublicHeader';

interface BookingRow extends ResourceBooking {
  event_title: string;
  event_start_date: string | null;
  organizer_name: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-orange-100 text-orange-800',
  accepted: 'bg-green-100 text-green-800',
  confirmed: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-red-100 text-red-800',
  counter_offered: 'bg-blue-100 text-blue-800',
  deleted: 'bg-gray-100 text-gray-800',
};

export default function ResourceDashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [resource, setResource] = useState<Resource | null>(null);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    if (!user.email) return;
    (async () => {
      const { data: res } = await supabase.from('resources').select('*').eq('email', user.email).maybeSingle();
      setResource((res as Resource) ?? null);
      if (!res) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('resource_bookings')
        .select('*, events(title, start_date)')
        .eq('resource_email', user.email)
        .order('created_at', { ascending: false });

      const mapped = (data ?? []).map((b: any) => ({
        ...b,
        event_title: b.events?.title ?? 'Untitled event',
        event_start_date: b.events?.start_date ?? null,
        organizer_name: null,
      }));
      setBookings(mapped);
      setLoading(false);
    })();
  }, [user, authLoading, navigate, location.pathname]);

  async function respond(booking: BookingRow, status: 'accepted' | 'rejected') {
    setBusyId(booking.id);
    const { error } = await supabase.from('resource_bookings').update({ status }).eq('id', booking.id);
    setBusyId(null);
    if (!error) {
      setBookings((prev) => prev.map((b) => (b.id === booking.id ? { ...b, status } : b)));

      const html = `
        <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#4f46e5,#14b8a6);padding:24px;color:white;">
            <div style="font-size:20px;font-weight:800;">TapIN</div>
            <div style="margin-top:8px;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;opacity:0.9;">Booking ${status}</div>
          </div>
          <div style="padding:24px;">
            <p style="margin:0;color:#374151;">${resource?.display_name} has ${status} your booking request for <strong>${booking.event_title}</strong>.</p>
          </div>
        </div>`;
      supabase.functions
        .invoke('send-ticket-confirmation', { body: { to: booking.organizer_email, subject: `Booking ${status}: ${booking.event_title}`, html } })
        .catch(() => {});
    }
  }

  if (loading) return (<><PublicHeader /><div className="p-10 text-center text-gray-500">Loading…</div></>);

  if (!resource) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white">
        <PublicHeader />
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <p className="text-lg font-semibold text-gray-700">You don't have a resource profile yet.</p>
          <Link to="/resources/new" className="mt-3 inline-block text-marigold hover:underline">Create your resource profile &rarr;</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white">
      <PublicHeader />
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-gray-900">Resource Dashboard</h1>
            <p className="mt-1 text-gray-500">Booking requests for {resource.display_name}</p>
          </div>
          <Link to="/resources/new" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:border-marigold hover:text-marigold">
            Edit profile
          </Link>
        </div>

        {bookings.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-gray-300 bg-white/60 py-16 text-center">
            <p className="text-lg font-semibold text-gray-500">No booking requests yet</p>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-3">
            {bookings.map((b) => (
              <div key={b.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900">{b.event_title}</p>
                    <p className="text-sm text-gray-500">
                      {b.event_start_date ? new Date(b.event_start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date TBD'}
                      {' \u00b7 '}Offered ${b.offered_rate}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[b.status] ?? STATUS_STYLES.pending}`}>
                    {b.status}
                  </span>
                </div>
                {b.message_from_organizer && (
                  <p className="mt-2 text-sm italic text-gray-600">"{b.message_from_organizer}"</p>
                )}
                <p className="mt-1 text-xs text-gray-400">From {b.organizer_email}</p>

                {b.status === 'pending' && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => respond(b, 'accepted')}
                      disabled={busyId === b.id}
                      className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => respond(b, 'rejected')}
                      disabled={busyId === b.id}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-magenta hover:text-magenta disabled:opacity-50"
                    >
                      Decline
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
