import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { Ticket } from '../../lib/types';
import { downloadCsv, fileSlug } from '../../lib/csv';

const STATUS_STYLES: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-800',
  pending: 'bg-orange-100 text-orange-800',
  cancelled: 'bg-red-100 text-red-800',
  refunded: 'bg-gray-100 text-gray-800',
};

export default function SalesTab({ eventId }: { eventId: string }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

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

  // A single series pass purchase creates one ticket row per occurrence in
  // the series, so counting rows would overcount -- count distinct orders
  // instead to get the actual number of passes covering this date.
  const seriesPassTickets = confirmed.filter((t) => t.ticket_type === 'series_pass');
  const seriesPassCount = new Set(seriesPassTickets.map((t) => t.order_id)).size;
  const seriesPassRevenue = seriesPassTickets.reduce((sum, t) => sum + (t.price_paid || 0) * (t.quantity || 1), 0);

  // Attendee list for door lists, follow-ups, and sponsors. Tickets don't
  // store names, so each row uses the name on the order, then the profile.
  async function exportCsv() {
    setExporting(true);
    const orderIds = [...new Set(tickets.map((t) => t.order_id).filter(Boolean))] as string[];
    const emails = [...new Set(tickets.map((t) => t.attendee_email))];
    const [{ data: orders }, { data: profiles }, { data: ev }] = await Promise.all([
      orderIds.length ? supabase.from('orders').select('id, order_number, customer_name').in('id', orderIds) : Promise.resolve({ data: [] }),
      emails.length ? supabase.from('public_profiles').select('email, full_name').in('email', emails) : Promise.resolve({ data: [] }),
      supabase.from('events').select('title').eq('id', eventId).maybeSingle(),
    ]);
    const orderById = new Map(((orders ?? []) as { id: string; order_number: string | null; customer_name: string | null }[]).map((o) => [o.id, o]));
    const nameByEmail = new Map(((profiles ?? []) as { email: string; full_name: string | null }[]).map((p) => [p.email, p.full_name]));
    const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '');
    const rows: unknown[][] = [
      ['Name', 'Email', 'Ticket type', 'Section', 'Seat', 'Quantity', 'Price per ticket', 'Total paid', 'Status', 'Checked in', 'Checked in at', 'Registered', 'Order #', 'Event date'],
      ...tickets.map((t) => {
        const order = t.order_id ? orderById.get(t.order_id) : undefined;
        const qty = Number(t.quantity) || 1;
        const price = Number(t.price_paid) || 0;
        return [
          order?.customer_name || nameByEmail.get(t.attendee_email) || '',
          t.attendee_email,
          t.ticket_type,
          t.section_name ?? '',
          t.seat_assignment ?? '',
          qty,
          price.toFixed(2),
          (price * qty).toFixed(2),
          t.status,
          t.checked_in_at ? 'Yes' : 'No',
          when(t.checked_in_at),
          when(t.created_at),
          order?.order_number ?? '',
          t.occurrence_date ? new Date(t.occurrence_date).toLocaleDateString('en-US', { dateStyle: 'medium' }) : '',
        ];
      }),
    ];
    downloadCsv(`${fileSlug(ev?.title ?? 'event')}-attendees-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    setExporting(false);
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
        {seriesPassCount > 0 && (
          <div className="rounded-xl bg-surface border border-gray-200 p-5 sm:col-span-2">
            <p className="text-xs uppercase tracking-widest text-muted">Series Passes Covering This Date</p>
            <p className="mt-1 font-display text-3xl font-extrabold text-indigo-500">{seriesPassCount}</p>
            <p className="mt-1 text-xs text-muted">${seriesPassRevenue.toFixed(2)} of the revenue above came from series passes</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-bone">Attendees</h3>
        {tickets.length > 0 && (
          <button
            onClick={exportCsv}
            disabled={exporting}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-bone hover:border-marigold hover:text-marigold disabled:opacity-50"
          >
            {exporting ? 'Preparing…' : 'Download attendee list'}
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
