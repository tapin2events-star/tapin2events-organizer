import { useEffect, useState } from 'react';
import RevenueSplits from '../business/RevenueSplits';
import { useFeature } from '../../lib/preview';
import { ListSkeleton } from '../ui/Skeleton';
import { supabase } from '../../lib/supabaseClient';
import type { Ticket } from '../../lib/types';

export default function SalesTab({ eventId, onGoAttendees, hostName = 'You' }: { eventId: string; onGoAttendees?: () => void; hostName?: string }) {
  const splitsOn = useFeature('splits');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('tickets')
        .select('*, tier:event_ticket_tiers(name)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });
      setTickets((data ?? []) as Ticket[]);
      setLoading(false);
    })();
  }, [eventId]);

  if (loading) return <ListSkeleton rows={4} className="mt-4" />;

  const confirmed = tickets.filter((t) => t.status === 'confirmed');
  const totalAttendees = confirmed.reduce((sum, t) => sum + (t.quantity || 1), 0);
  const totalRevenue = confirmed.reduce((sum, t) => sum + (t.price_paid || 0) * (t.quantity || 1), 0);

  // A single series pass purchase creates one ticket row per occurrence in
  // the series, so counting rows would overcount -- count distinct orders
  // instead to get the actual number of passes covering this date.
  const seriesPassTickets = confirmed.filter((t) => t.ticket_type === 'series_pass');
  const seriesPassCount = new Set(seriesPassTickets.map((t) => t.order_id)).size;
  const seriesPassRevenue = seriesPassTickets.reduce((sum, t) => sum + (t.price_paid || 0) * (t.quantity || 1), 0);

  return (
    <div className="flex flex-col gap-6">
      {splitsOn && <RevenueSplits eventId={eventId} hostName={hostName} />}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-surface border border-gray-200 p-5">
          <p className="text-xs uppercase tracking-widest text-muted">Tickets sold</p>
          <p className="mt-1 font-display text-3xl font-extrabold text-marigold">{totalAttendees}</p>
        </div>
        <div className="rounded-xl bg-surface border border-gray-200 p-5">
          <p className="text-xs uppercase tracking-widest text-muted">Revenue</p>
          <p className="mt-1 font-display text-3xl font-extrabold text-mint">${totalRevenue.toFixed(2)}</p>
        </div>
        {seriesPassCount > 0 && (
          <div className="rounded-xl bg-surface border border-gray-200 p-5 sm:col-span-2">
            <p className="text-xs uppercase tracking-widest text-muted">Series Passes Covering This Date</p>
            <p className="mt-1 font-display text-3xl font-extrabold text-indigo-500">{seriesPassCount}</p>
            <p className="mt-1 text-xs text-muted">${seriesPassRevenue.toFixed(2)} of the revenue above came from series passes</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-bone">Recent sales</h3>
        {onGoAttendees && <button onClick={onGoAttendees} className="text-sm font-medium text-marigold">Everyone & spreadsheet in Attendees ›</button>}
      </div>
      {confirmed.filter((t) => (t.price_paid || 0) > 0).length === 0 ? (
        <p className="text-sm text-muted">No paid tickets yet for this event.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {confirmed.filter((t) => (t.price_paid || 0) > 0).slice(0, 15).map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-surface px-4 py-3">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-bone">{(t as { tier?: { name?: string } | null }).tier?.name || t.ticket_type} · Qty {t.quantity}</span>
                <span className="block truncate text-xs text-muted">{t.attendee_email} · {new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              </span>
              <span className="shrink-0 text-sm font-semibold text-bone">${((t.price_paid || 0) * (t.quantity || 1)).toFixed(2)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
