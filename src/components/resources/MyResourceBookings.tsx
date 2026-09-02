import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import type { ResourceBooking } from '../../lib/types';

interface BookingRow extends ResourceBooking {
  resource_display_name: string;
  event_title: string;
  has_review: boolean;
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

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} className="text-2xl leading-none">
          <span className={n <= value ? 'text-orange-400' : 'text-gray-300'}>★</span>
        </button>
      ))}
    </div>
  );
}

export default function MyResourceBookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  async function load() {
    if (!user?.email) return;
    const { data: bookingRows, error } = await supabase
      .from('resource_bookings')
      .select('*')
      .eq('organizer_email', user.email)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to load my bookings:', error);
      setLoading(false);
      return;
    }

    const resourceIds = [...new Set((bookingRows ?? []).map((b) => b.resource_id))];
    const eventIds = [...new Set((bookingRows ?? []).map((b) => b.event_id))];
    const bookingIds = (bookingRows ?? []).map((b) => b.id);

    const [{ data: resources }, { data: events }, { data: reviews }] = await Promise.all([
      resourceIds.length ? supabase.from('resources').select('id, display_name').in('id', resourceIds) : Promise.resolve({ data: [] }),
      eventIds.length ? supabase.from('events').select('id, title').in('id', eventIds) : Promise.resolve({ data: [] }),
      bookingIds.length ? supabase.from('resource_reviews').select('booking_id').in('booking_id', bookingIds) : Promise.resolve({ data: [] }),
    ]);

    const resourcesById = new Map((resources ?? []).map((r) => [r.id, r]));
    const eventsById = new Map((events ?? []).map((e) => [e.id, e]));
    const reviewedBookingIds = new Set((reviews ?? []).map((r) => r.booking_id));

    setBookings(
      (bookingRows ?? []).map((b: any) => ({
        ...b,
        resource_display_name: resourcesById.get(b.resource_id)?.display_name ?? 'Unknown resource',
        event_title: eventsById.get(b.event_id)?.title ?? 'Untitled event',
        has_review: reviewedBookingIds.has(b.id),
      }))
    );
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [user?.email]);

  async function markCompleted(booking: BookingRow) {
    setBusyId(booking.id);
    const { error } = await supabase.from('resource_bookings').update({ status: 'completed' }).eq('id', booking.id);
    setBusyId(null);
    if (!error) setBookings((prev) => prev.map((b) => (b.id === booking.id ? { ...b, status: 'completed' } : b)));
  }

  async function respondToCounter(booking: BookingRow, accept: boolean) {
    setBusyId(booking.id);
    const newStatus = accept ? 'accepted' : 'rejected';
    const updates: any = { status: newStatus };
    if (accept) updates.final_rate = booking.counter_offer_rate;
    const { error } = await supabase.from('resource_bookings').update(updates).eq('id', booking.id);
    setBusyId(null);
    if (!error) {
      setBookings((prev) => prev.map((b) => (b.id === booking.id ? { ...b, status: newStatus } : b)));
      supabase
        .from('notifications')
        .insert({
          user_email: booking.resource_email,
          type: `counter_offer_${newStatus}`,
          message: `${user!.email} has ${accept ? 'accepted' : 'declined'} your counter offer for ${booking.event_title}`,
          link: '/resources/dashboard',
        })
        .then(() => {});
    }
  }

  async function submitReview(booking: BookingRow) {
    setBusyId(booking.id);
    const { error } = await supabase.from('resource_reviews').insert({
      resource_id: booking.resource_id,
      booking_id: booking.id,
      reviewer_email: user!.email,
      rating,
      comment: comment || null,
    });
    setBusyId(null);
    if (!error) {
      setBookings((prev) => prev.map((b) => (b.id === booking.id ? { ...b, has_review: true } : b)));
      setReviewingId(null);
      setRating(5);
      setComment('');
    }
  }

  if (loading) return <p className="text-sm text-gray-400">Loading…</p>;
  if (bookings.length === 0) return null;

  return (
    <div className="mt-10">
      <h2 className="font-display text-xl font-bold text-gray-900">My Resource Bookings</h2>
      <p className="mt-1 text-sm text-gray-500">Requests you've sent to artists and vendors.</p>
      <div className="mt-4 flex flex-col gap-3">
        {bookings.map((b) => (
          <div key={b.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <Link to={`/resources/${b.resource_id}`} className="font-semibold text-gray-900 hover:text-marigold">
                  {b.resource_display_name}
                </Link>
                <p className="text-sm text-gray-500">For {b.event_title} &middot; Offered ${b.offered_rate}</p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[b.status] ?? STATUS_STYLES.pending}`}>
                {b.status}
              </span>
            </div>

            {b.status === 'counter_offered' && (
              <div className="mt-3 rounded-lg bg-blue-50 p-3">
                <p className="text-sm text-blue-800">
                  {b.resource_display_name} proposed <strong>${b.counter_offer_rate}</strong> instead of ${b.offered_rate}.
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => respondToCounter(b, true)}
                    disabled={busyId === b.id}
                    className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    Accept ${b.counter_offer_rate}
                  </button>
                  <button
                    onClick={() => respondToCounter(b, false)}
                    disabled={busyId === b.id}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-magenta hover:text-magenta disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </div>
            )}

            {b.status === 'accepted' && (
              <button
                onClick={() => markCompleted(b)}
                disabled={busyId === b.id}
                className="mt-3 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-marigold hover:text-marigold disabled:opacity-50"
              >
                Mark as completed
              </button>
            )}

            {b.status === 'completed' && !b.has_review && (
              reviewingId === b.id ? (
                <div className="mt-3 rounded-lg bg-gray-50 p-3">
                  <StarPicker value={rating} onChange={setRating} />
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="How was your experience? (optional)"
                    rows={2}
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => submitReview(b)}
                      disabled={busyId === b.id}
                      className="rounded-lg bg-marigold px-3 py-1.5 text-xs font-semibold text-ink hover:bg-marigold/90 disabled:opacity-50"
                    >
                      Submit review
                    </button>
                    <button onClick={() => setReviewingId(null)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setReviewingId(b.id)}
                  className="mt-3 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-marigold hover:text-marigold"
                >
                  Leave a review
                </button>
              )
            )}
            {b.status === 'completed' && b.has_review && (
              <p className="mt-3 text-xs text-gray-400">✓ Review submitted</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
