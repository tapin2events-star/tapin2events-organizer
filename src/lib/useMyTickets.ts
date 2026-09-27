import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export interface MyTicket {
  ticketId: string; // the pass page for this ticket (one QR covers a whole order)
  count: number;
}

// The signed-in person's valid tickets, keyed by event ID, so event cards can
// show "Registered" / "Ticket purchased" and link straight to the ticket.
export function useMyTickets(email: string | null | undefined) {
  const [byEvent, setByEvent] = useState<Map<string, MyTicket>>(new Map());

  useEffect(() => {
    if (!email) {
      setByEvent(new Map());
      return;
    }
    supabase
      .from('tickets')
      .select('id, event_id, created_at')
      .eq('attendee_email', email)
      .in('status', ['confirmed', 'checked_in'])
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        const map = new Map<string, MyTicket>();
        for (const t of data ?? []) {
          const existing = map.get(t.event_id);
          map.set(t.event_id, existing ? { ...existing, count: existing.count + 1 } : { ticketId: t.id, count: 1 });
        }
        setByEvent(map);
      });
  }, [email]);

  return byEvent;
}
