import { useEffect, useState } from 'react';
import { ListSkeleton } from '../components/ui/Skeleton';
import BackButton from '../components/BackButton';
import BookingsSection from '../components/bookings/BookingsSection';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

// Bookings: the same view as My Activity > Bookings: the bookings you made
// ("I booked") and the ones where you were booked ("Booked me").
export default function OrganizerBookings() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<{ mine: number; received: number; pending: number } | null>(null);

  useEffect(() => {
    if (!user?.email) return;
    const email = user.email;
    Promise.all([
      supabase.from('resource_bookings').select('id', { count: 'exact', head: true }).eq('organizer_email', email).neq('status', 'deleted'),
      supabase.from('resource_bookings').select('id', { count: 'exact', head: true }).eq('resource_email', email).neq('status', 'deleted'),
      supabase.from('resource_bookings').select('id', { count: 'exact', head: true }).eq('resource_email', email).eq('status', 'pending'),
    ]).then(([m, r, p]) => setCounts({ mine: m.count ?? 0, received: r.count ?? 0, pending: p.count ?? 0 }));
  }, [user?.email]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-3"><BackButton fallback="/organizer" fallbackLabel="Organizer Dashboard" /></div>
      <h1 className="mb-4 font-display text-3xl font-extrabold text-bone">Bookings</h1>
      {counts ? <BookingsSection mine={counts.mine} received={counts.received} pending={counts.pending} standalone /> : <ListSkeleton rows={4} className="mt-4" />}
    </div>
  );
}
