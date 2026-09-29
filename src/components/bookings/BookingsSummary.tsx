import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { RowSkeleton } from '../../components/ui/Skeleton';

// Compact row on the Organizer Dashboard (styled like the Earnings and Vendor
// Applications rows around it) that leads to the Bookings page.
export default function BookingsSummary({ show = true, onReady }: { show?: boolean; onReady?: () => void }) {
  const { user } = useAuth();
  const onReadyRef = useRef(onReady);
  useEffect(() => { onReadyRef.current = onReady; });
  const [counts, setCounts] = useState<{ reply: number; waiting: number; booked: number; total: number; unread: number } | null>(null);

  useEffect(() => {
    if (!user?.email) return;
    (async () => {
      const [{ data }, { data: unread }] = await Promise.all([
        supabase.from('resource_bookings').select('status').eq('organizer_email', user.email),
        supabase.rpc('booking_unread_total', { p_role: 'organizer' }),
      ]);
      const rows = data ?? [];
      setCounts({
        reply: rows.filter((r) => r.status === 'counter_offered').length,
        waiting: rows.filter((r) => r.status === 'pending').length,
        booked: rows.filter((r) => r.status === 'accepted' || r.status === 'confirmed').length,
        total: rows.length,
        unread: typeof unread === 'number' ? unread : 0,
      });
    })();
  }, [user?.email]);

  useLayoutEffect(() => { if (counts) onReadyRef.current?.(); }, [counts]);

  if (!counts || !show) return <RowSkeleton twoLine />;
  const empty = counts.total === 0;
  return (
    <Link
      to={empty ? '/resources' : '/organizer/bookings'}
      className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 hover:border-marigold"
    >
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Resource bookings</p>
        {empty ? (
          <p className="mt-0.5 text-sm text-gray-600">Book artists, DJs, decorators, and more for your events.</p>
        ) : (
          <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-600">
            {counts.unread > 0 && <span className="font-semibold text-magenta">💬 {counts.unread} unread message{counts.unread === 1 ? '' : 's'}</span>}
            {counts.reply > 0 && <span className="font-semibold text-blue-700">{counts.reply} need{counts.reply === 1 ? 's' : ''} your reply</span>}
            <span>{counts.waiting} waiting</span>
            <span>{counts.booked} booked</span>
          </p>
        )}
      </div>
      <span className="shrink-0 text-sm font-semibold text-marigold">{empty ? 'Browse resources' : 'Manage'} &rarr;</span>
    </Link>
  );
}
