import { useEventNumbers, usd } from '../../lib/eventNumbers';
import type { TapEvent } from '../../lib/types';

export default function OverviewTab({ event }: { event: TapEvent }) {
  const n = useEventNumbers(event.id);
  const other = n ? [
    { label: 'Merchandise', value: n.merch_revenue }, { label: 'Donations', value: n.donations },
    { label: 'Performer tips', value: n.tips, note: 'goes to performers' }, { label: 'Vendor fees', value: n.vendor_fees },
  ].filter((x) => x.value > 0) : [];
  const total = n ? n.ticket_revenue + n.merch_revenue + n.donations + n.vendor_fees : 0;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Tickets" value={n ? n.tickets_sold.toLocaleString() : '—'} sub={n ? `${n.holders} ${n.holders === 1 ? 'person' : 'people'}${n.free_tickets && n.paid_tickets ? ` · ${n.free_tickets} free` : n.tickets_sold && !n.paid_tickets ? ' · free' : ''}` : undefined} />
        <StatCard label="Ticket revenue" value={n ? usd(n.ticket_revenue) : '—'} accent="mint" sub={n && n.refunded > 0 ? `${usd(n.refunded)} refunded` : n ? 'before fees' : undefined} />
        <StatCard label="Checked in" value={n ? `${n.checked_in}` : '—'} sub={n ? `of ${n.tickets_sold} ticket${n.tickets_sold === 1 ? '' : 's'}` : undefined} />
        <StatCard label="Capacity" value={n ? (n.capacity ? `${n.remaining} left` : 'Unlimited') : '—'} sub={n?.capacity ? `of ${n.capacity}` : undefined} />
      </div>
      {other.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-surface p-5">
          <h3 className="font-display text-lg font-semibold text-bone">All income</h3>
          <dl className="mt-3 grid grid-cols-1 gap-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Tickets</dt><dd className="font-semibold text-bone">{usd(n!.ticket_revenue)}</dd></div>
            {other.map((x) => (
              <div key={x.label} className="flex justify-between"><dt className="text-muted">{x.label}{x.note ? <span className="ml-1 text-xs">({x.note})</span> : null}</dt><dd className="font-semibold text-bone">{usd(x.value)}</dd></div>
            ))}
            <div className="mt-1 flex justify-between border-t border-gray-200 pt-2"><dt className="font-semibold text-bone">Total for your event</dt><dd className="font-extrabold text-mint">{usd(total)}</dd></div>
          </dl>
          <p className="mt-2 text-xs text-muted">Amounts attendees paid, before payout splits. Fees buyers paid on top aren&apos;t included.{n!.tips > 0 ? ' Tips go to the performers, so they aren\u2019t in the total.' : ''}</p>
        </div>
      )}

      <div className="min-w-0 rounded-xl bg-surface p-5">
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
          <p className="mt-4 whitespace-pre-wrap text-sm text-muted [overflow-wrap:anywhere]">{event.description}</p>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, accent = 'marigold', sub }: { label: string; value: string; accent?: string; sub?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-surface p-5">
      <p className="font-mono text-xs uppercase tracking-widest text-muted">{label}</p>
      <p
        className={`mt-1 break-words font-display text-3xl font-extrabold ${
          accent === 'mint' ? 'text-mint' : 'text-marigold'
        }`}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="text-bone [overflow-wrap:anywhere]">{value}</dd>
    </div>
  );
}
