import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { TapEvent } from '../../lib/types';

export default function OverviewTab({ event }: { event: TapEvent }) {
  const [ticketCount, setTicketCount] = useState<number | null>(null);
  const [revenue, setRevenue] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const { count } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', event.id)
        .eq('status', 'confirmed');
      setTicketCount(count ?? 0);

      const { data } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('event_id', event.id)
        .eq('payment_status', 'paid');
      const total = (data ?? []).reduce((sum, o) => sum + Number(o.total_amount ?? 0), 0);
      setRevenue(total);
    })();
  }, [event.id]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Tickets sold" value={ticketCount === null ? '—' : ticketCount.toString()} />
        <StatCard
          label="Revenue"
          value={revenue === null ? '—' : `$${revenue.toFixed(2)}`}
          accent="mint"
        />
        <StatCard
          label="Capacity"
          value={event.max_capacity ? event.max_capacity.toString() : 'Unlimited'}
        />
      </div>

      <div className="rounded-xl bg-surface p-5">
        <h3 className="mb-2 font-display text-lg font-semibold text-bone">Details</h3>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <Detail label="Status" value={event.status} />
          <Detail label="Type" value={event.event_type} />
          <Detail
            label="Starts"
            value={event.start_date ? new Date(event.start_date).toLocaleString() : 'TBD'}
          />
          <Detail
            label="Ends"
            value={event.end_date ? new Date(event.end_date).toLocaleString() : 'TBD'}
          />
          <Detail label="Venue" value={event.location_name || '—'} />
          <Detail label="Address" value={event.location_address || '—'} />
        </dl>
        {event.description && (
          <p className="mt-4 whitespace-pre-wrap text-sm text-muted">{event.description}</p>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, accent = 'marigold' }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl bg-surface p-5">
      <p className="font-mono text-xs uppercase tracking-widest text-muted">{label}</p>
      <p
        className={`mt-1 font-display text-3xl font-extrabold ${
          accent === 'mint' ? 'text-mint' : 'text-marigold'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="text-bone">{value}</dd>
    </div>
  );
}
