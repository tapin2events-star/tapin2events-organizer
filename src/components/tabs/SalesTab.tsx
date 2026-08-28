import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { Ticket } from '../../lib/types';

const STATUS_STYLES: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-800',
  pending: 'bg-orange-100 text-orange-800',
  cancelled: 'bg-red-100 text-red-800',
  refunded: 'bg-gray-100 text-gray-800',
};

export default function SalesTab({ eventId }: { eventId: string }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('tickets')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });
      setTickets((data ?? []) as Ticket[]);
      setLoading(false);
    })();
  }, [eventId]);

  if (loading) return <p className="text-muted">Loading…</p>;

  const confirmed = tickets.filter((t) => t.status === 'confirmed');
  const totalAttendees = confirmed.reduce((sum, t) => sum + (t.quantity || 1), 0);
  const totalRevenue = confirmed.reduce((sum, t) => sum + (t.price_paid || 0) * (t.quantity || 1), 0);

  function exportCsv() {
    const rows = [
      ['Attendee email', 'Ticket type', 'Quantity', 'Amount', 'Status', 'Purchased'],
      ...tickets.map((t) => [
        t.attendee_email,
        t.ticket_type,
        String(t.quantity),
        (t.price_paid * t.quantity).toFixed(2),
        t.status,
        new Date(t.created_at).toLocaleString(),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'attendees.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-surface border border-gray-200 p-5">
          <p className="text-xs uppercase tracking-widest text-muted">Attendees</p>
          <p className="mt-1 font-display text-3xl font-extrabold text-marigold">{totalAttendees}</p>
        </div>
        <div className="rounded-xl bg-surface border border-gray-200 p-5">
          <p className="text-xs uppercase tracking-widest text-muted">Revenue</p>
          <p className="mt-1 font-display text-3xl font-extrabold text-mint">${totalRevenue.toFixed(2)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-bone">Attendees</h3>
        {tickets.length > 0 && (
          <button
            onClick={exportCsv}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-bone hover:border-marigold hover:text-marigold"
          >
            Export CSV
          </button>
        )}
      </div>

      {tickets.length === 0 ? (
        <p className="text-sm text-muted">No tickets sold yet for this event.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tickets.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 bg-surface px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-bone">{t.attendee_email}</p>
                <p className="text-xs text-muted">
                  {t.ticket_type} · Qty {t.quantity}
                  {t.section_name ? ` · ${t.section_name}` : ''}
                  {t.seat_assignment ? ` · Seat ${t.seat_assignment}` : ''}
                  {' · '}
                  {new Date(t.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-medium text-bone">
                  ${(t.price_paid * t.quantity).toFixed(2)}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    STATUS_STYLES[t.status] ?? STATUS_STYLES.pending
                  }`}
                >
                  {t.status}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
