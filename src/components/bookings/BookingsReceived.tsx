import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { BOOKING_STATUS_LABELS, BOOKING_STATUS_STYLES, agreedRate, formatServiceDate, money } from '../../lib/bookings';
import { ListSkeleton } from '../ui/Skeleton';
import type { ResourceBooking } from '../../lib/types';

type Row = ResourceBooking & { event_title: string; event_start: string | null; organizer_name: string | null };

// "Booked me": bookings where you're the resource being booked. Read-only here;
// responding (accept, decline, counter, complete) happens in the Resource Dashboard.
export default function BookingsReceived() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (!user?.email) return;
    (async () => {
      const { data: bookings } = await supabase.from('resource_bookings').select('*')
        .eq('resource_email', user.email).neq('status', 'deleted').order('created_at', { ascending: false });
      const list = (bookings ?? []) as ResourceBooking[];
      const eventIds = [...new Set(list.map((b) => b.event_id).filter(Boolean))];
      const orgEmails = [...new Set(list.map((b) => b.organizer_email))];
      const [{ data: events }, { data: people }] = await Promise.all([
        eventIds.length ? supabase.from('events').select('id, title, start_date').in('id', eventIds) : Promise.resolve({ data: [] as { id: string; title: string; start_date: string | null }[] }),
        orgEmails.length ? supabase.from('public_profiles').select('email, full_name').in('email', orgEmails) : Promise.resolve({ data: [] as { email: string; full_name: string | null }[] }),
      ]);
      const ev = new Map((events ?? []).map((e) => [e.id, e]));
      const names = new Map((people ?? []).map((p) => [p.email, p.full_name]));
      const mapped = list.map((b) => ({
        ...b,
        event_title: ev.get(b.event_id)?.title ?? 'Untitled event',
        event_start: ev.get(b.event_id)?.start_date ?? null,
        organizer_name: names.get(b.organizer_email) ?? null,
      }));
      // Requests waiting on you first, then by event date.
      mapped.sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending') || String(b.event_start ?? '').localeCompare(String(a.event_start ?? '')));
      setRows(mapped);
    })();
  }, [user?.email]);

  if (rows === null) return <ListSkeleton rows={3} />;
  if (rows.length === 0) {
    return <p className="rounded-xl border border-dashed border-gray-300 bg-white/60 py-8 text-center text-sm text-gray-500">No one has booked you yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((b) => {
        const needsReply = b.status === 'pending';
        const price = agreedRate(b);
        const when = formatServiceDate(b.event_start);
        return (
          <div key={b.id} className={`rounded-xl border bg-white p-3 sm:p-4 ${needsReply ? 'border-orange-300' : 'border-gray-200'}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-900">{b.event_title}</p>
                <p className="text-xs text-gray-500">From {b.organizer_name ?? b.organizer_email}{when ? ` · ${when}` : ''}{price ? ` · ${money(price)}` : ''}</p>
              </div>
              <span className="flex flex-wrap justify-end gap-1.5">
                {needsReply && <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-800">Needs your reply</span>}
                {b.payment_status === 'paid' && <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">Paid</span>}
                {b.payment_status === 'refunded' && <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">Refunded</span>}
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${BOOKING_STATUS_STYLES[b.status] ?? BOOKING_STATUS_STYLES.pending}`}>{BOOKING_STATUS_LABELS[b.status] ?? b.status}</span>
              </span>
            </div>
            <Link to="/resources/dashboard?tab=bookings" className={`mt-2 inline-block rounded-lg px-3 py-2 text-sm font-medium ${needsReply ? 'bg-marigold text-white hover:bg-marigold/90' : 'border border-gray-300 text-gray-700 hover:border-marigold'}`}>
              {needsReply ? 'Reply' : 'Manage'}
            </Link>
          </div>
        );
      })}
    </div>
  );
}
