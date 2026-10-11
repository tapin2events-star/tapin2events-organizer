import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadBookingMoney, summarizeBookings } from '../../lib/bookingEarnings';
import { money } from '../../lib/earnings';

// Resource Dashboard: what you've earned from bookings (all time) and what's coming up.
export default function BookingEarningsCard() {
  const [s, setS] = useState<{ earned: number; count: number; upcoming: number; upcomingCount: number } | null>(null);
  useEffect(() => {
    loadBookingMoney().then(({ earnings, costs }) => {
      const b = summarizeBookings(earnings, costs, 'all');
      setS({ earned: b.earned, count: b.paidCount, upcoming: b.upcomingTotal, upcomingCount: b.upcoming.length });
    });
  }, []);
  if (!s || (s.count === 0 && s.upcomingCount === 0)) return null;
  return (
    <Link to="/organizer/earnings#bookings" className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 hover:border-marigold">
      <span>
        <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500">Earned from bookings</span>
        <span className="block font-display text-2xl font-extrabold text-gray-900">{money(s.earned)}</span>
        <span className="block text-xs text-gray-500">{s.count} paid{s.upcomingCount > 0 ? ` · ${money(s.upcoming)} coming up` : ''}</span>
      </span>
      <span className="text-sm font-medium text-marigold">See details &rarr;</span>
    </Link>
  );
}
