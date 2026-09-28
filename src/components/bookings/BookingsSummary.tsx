import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';

// Compact card on the Organizer Dashboard that leads to the Bookings page.
export default function BookingsSummary() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<{ reply: number; waiting: number; booked: number; total: number } | null>(null);

  useEffect(() => {
    if (!user?.email) return;
    supabase.from('resource_bookings').select('status').eq('organizer_email', user.email).then(({ data }) => {
      const rows = data ?? [];
      setCounts({
        reply: rows.filter((r) => r.status === 'counter_offered').length,
        waiting: rows.filter((r) => r.status === 'pending').length,
        booked: rows.filter((r) => r.status === 'accepted' || r.status === 'confirmed').length,
        total: rows.length,
      });
    });
  }, [user?.email]);

  if (!counts) return null;
  return (
    <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-gray-900">Resource bookings</h2>
          {counts.total === 0 ? (
            <p className="mt-1 text-sm text-gray-500">Book artists, DJs, decorators, and more for your events.</p>
          ) : (
            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
              {counts.reply > 0 && <span className="font-semibold text-blue-700">{counts.reply} need{counts.reply === 1 ? 's' : ''} your reply</span>}
              <span>{counts.waiting} waiting</span>
              <span>{counts.booked} booked</span>
            </p>
          )}
        </div>
        <Link to={counts.total === 0 ? '/resources' : '/organizer/bookings'} className="rounded-lg bg-marigold px-4 py-2.5 text-sm font-semibold text-white hover:bg-marigold/90">
          {counts.total === 0 ? 'Browse resources' : 'Manage bookings'}
        </Link>
      </div>
    </div>
  );
}
