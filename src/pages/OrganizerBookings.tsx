import BookingsManager from '../components/bookings/BookingsManager';
import BackButton from '../components/BackButton';

// One place for an organizer to manage every resource booking across their events.
export default function OrganizerBookings() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-3"><BackButton fallback="/organizer" fallbackLabel="Organizer Dashboard" /></div>
      <h1 className="font-display text-3xl font-extrabold text-bone">Bookings</h1>
      <div className="mt-3">
        <BookingsManager />
      </div>
    </div>
  );
}
