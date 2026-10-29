import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

// One source of truth for an event's numbers (event_numbers), shared by the Overview, Sales and Attendees tabs so they
// always agree. Tickets are counted by quantity (active tickets only); ticket revenue is the ticket price attendees paid
// (buyer fees are separate); other income is merchandise, donations, performer tips and paid vendor fees.
export interface EventNumbers {
  tickets_sold: number; paid_tickets: number; free_tickets: number; ticket_revenue: number; holders: number;
  checked_in: number; checked_in_people: number; cancelled_tickets: number; refunded: number; buyer_fees: number;
  merch_revenue: number; donations: number; tips: number; vendor_fees: number; capacity: number | null; remaining: number | null;
}
export function useEventNumbers(eventId: string, refreshKey: unknown = null) {
  const [n, setN] = useState<EventNumbers | null>(null);
  useEffect(() => {
    supabase.rpc('event_numbers', { p_event_id: eventId }).then(({ data }) => {
      const d = (data ?? null) as Record<string, unknown> | null;
      setN(d ? (Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v === null ? null : Number(v)])) as unknown as EventNumbers) : null);
    });
  }, [eventId, refreshKey]);
  return n;
}
export const usd = (x: number) => `$${x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
