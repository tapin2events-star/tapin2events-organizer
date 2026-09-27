import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import type { TapEvent } from '../../lib/types';

type Level = 'urgent' | 'warning' | 'info';

interface Alert {
  key: string;
  level: Level;
  tag: string;
  message: string;
  action: { label: string; to: string };
  sortTime: number; // sooner first, within a level
}

const DAY = 24 * 60 * 60 * 1000;
const LEVEL_ORDER: Record<Level, number> = { urgent: 0, warning: 1, info: 2 };
const LEVEL_STYLE: Record<Level, { bar: string; tag: string }> = {
  urgent: { bar: 'border-l-red-500', tag: 'bg-red-100 text-red-700' },
  warning: { bar: 'border-l-orange-400', tag: 'bg-orange-100 text-orange-700' },
  info: { bar: 'border-l-marigold', tag: 'bg-indigo-100 text-marigold' },
};
const PREVIEW = 4;

function daysUntil(dateStr: string, now: number) {
  const start = new Date(dateStr);
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const today = new Date(now);
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((startDay - todayDay) / DAY);
}

function whenLabel(days: number) {
  return days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
}

// Surfaces things organizers commonly miss, each with a button that goes
// straight to the fix. Pure database checks -- no AI, so it costs nothing.
export default function NeedsAttention({ events, userId, userEmail }: { events: TapEvent[]; userId: string; userEmail: string }) {
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const now = Date.now();
      const byId = new Map(events.map((e) => [e.id, e]));
      const ids = events.map((e) => e.id);
      const upcoming = events
        .filter((e) => e.start_date && new Date(e.start_date).getTime() >= now - 6 * 3600 * 1000)
        .sort((a, b) => a.start_date!.localeCompare(b.start_date!));
      const seenSeries = new Set<string>();
      const nextOfEachSeries = upcoming.filter((e) => {
        const key = e.parent_event_id ?? e.id;
        if (seenSeries.has(key)) return false;
        seenSeries.add(key);
        return true;
      });
      const soonIds = upcoming.filter((e) => new Date(e.start_date!).getTime() - now <= 14 * DAY).map((e) => e.id);

      const [apps, tickets, bookings, orders] = await Promise.all([
        ids.length
          ? supabase.from('event_vendor_applications').select('event_id, created_at').in('event_id', ids).eq('status', 'pending')
          : Promise.resolve({ data: [] as { event_id: string; created_at: string }[] }),
        soonIds.length
          ? supabase.from('tickets').select('event_id, quantity').in('event_id', soonIds).in('status', ['confirmed', 'checked_in'])
          : Promise.resolve({ data: [] as { event_id: string; quantity: number | null }[] }),
        supabase.from('resource_bookings').select('id, event_id, status').eq('organizer_email', userEmail).in('status', ['pending', 'counter_offered']),
        ids.length
          ? supabase.from('orders').select('event_id, items').in('event_id', ids).eq('payment_status', 'paid').eq('fulfillment_status', 'pending')
          : Promise.resolve({ data: [] as { event_id: string; items: unknown }[] }),
      ]);
      if (cancelled) return;

      const out: Alert[] = [];

      // 1. Drafts starting soon (only your own events -- you're the one who can publish).
      for (const e of nextOfEachSeries) {
        if (e.status !== 'draft' || e.organizer_id !== userId) continue;
        const days = daysUntil(e.start_date!, now);
        if (days > 14) continue;
        out.push({
          key: `draft-${e.id}`,
          level: 'urgent',
          tag: 'Still a draft',
          message: `"${e.title}" isn't published yet and starts ${whenLabel(days)}.`,
          action: { label: 'Review & publish', to: `/organizer/events/${e.id}/edit` },
          sortTime: new Date(e.start_date!).getTime(),
        });
      }

      // 2. Vendor applications waiting 3+ days, grouped per event.
      const waiting = new Map<string, { count: number; oldest: number }>();
      for (const a of apps.data ?? []) {
        const age = now - new Date(a.created_at).getTime();
        if (age < 3 * DAY) continue;
        const w = waiting.get(a.event_id) ?? { count: 0, oldest: 0 };
        waiting.set(a.event_id, { count: w.count + 1, oldest: Math.max(w.oldest, age) });
      }
      waiting.forEach((w, eventId) => {
        const e = byId.get(eventId);
        if (!e) return;
        out.push({
          key: `vendors-${eventId}`,
          level: 'warning',
          tag: 'Vendors waiting',
          message: `${w.count} vendor application${w.count === 1 ? '' : 's'} for "${e.title}" ${w.count === 1 ? 'has' : 'have'} been waiting ${Math.floor(w.oldest / DAY)}+ days.`,
          action: { label: 'Review', to: '/organizer/vendor-applications' },
          sortTime: e.start_date ? new Date(e.start_date).getTime() : Infinity,
        });
      });

      // 3. Slow sales for published events coming up soon.
      const sold = new Map<string, number>();
      for (const t of tickets.data ?? []) sold.set(t.event_id, (sold.get(t.event_id) ?? 0) + (t.quantity ?? 1));
      for (const e of nextOfEachSeries) {
        if (e.status !== 'published' || e.event_type === 'private' || e.external_ticket_url) continue; // sales on other sites aren't visible to TapIN
        const days = daysUntil(e.start_date!, now);
        if (days > 14 || days < 2) continue; // today/tomorrow are covered by "Happening soon"
        const count = sold.get(e.id) ?? 0;
        const noun = e.event_type === 'paid' ? 'sold' : 'registered';
        const cap = e.max_capacity ?? 0;
        let message: string | null = null;
        if (cap > 0 && count / cap < 0.25) {
          message = `"${e.title}" has ${count} of ${cap} spots ${noun} (${Math.round((count / cap) * 100)}%) and starts ${whenLabel(days)}.`;
        } else if (cap <= 0 && count < 5 && days <= 7) {
          message = `"${e.title}" has ${count} ${count === 1 ? 'person' : 'people'} ${noun} so far and starts ${whenLabel(days)}.`;
        }
        if (message) {
          out.push({
            key: `sales-${e.id}`,
            level: 'warning',
            tag: 'Slow sales',
            message,
            action: { label: 'Make a flyer', to: `/organizer/events/${e.id}/edit?flyer=1` },
            sortTime: new Date(e.start_date!).getTime(),
          });
        }
      }

      // 4. Resource bookings still unconfirmed close to the event.
      for (const b of bookings.data ?? []) {
        const e = b.event_id ? byId.get(b.event_id) : null;
        if (!e?.start_date) continue;
        const days = daysUntil(e.start_date, now);
        if (days < 0 || days > 10) continue;
        const yourMove = b.status === 'counter_offered';
        out.push({
          key: `booking-${b.id}`,
          level: yourMove ? 'urgent' : 'warning',
          tag: yourMove ? 'Your reply needed' : 'Booking pending',
          message: yourMove
            ? `A resource sent a counter-offer for "${e.title}", which starts ${whenLabel(days)}.`
            : `A resource hasn't confirmed their booking for "${e.title}" yet, and it starts ${whenLabel(days)}.`,
          action: { label: yourMove ? 'Respond' : 'View booking', to: '/organizer#resource-bookings' },
          sortTime: new Date(e.start_date).getTime(),
        });
      }

      // 5. Paid product orders waiting to be fulfilled.
      const toFulfill = new Map<string, number>();
      for (const o of orders.data ?? []) {
        const items = Array.isArray(o.items) ? (o.items as { type?: string }[]) : [];
        if (!items.some((i) => i?.type === 'product')) continue;
        toFulfill.set(o.event_id, (toFulfill.get(o.event_id) ?? 0) + 1);
      }
      toFulfill.forEach((count, eventId) => {
        const e = byId.get(eventId);
        if (!e) return;
        out.push({
          key: `orders-${eventId}`,
          level: 'warning',
          tag: 'Orders to fulfill',
          message: `${count} order${count === 1 ? '' : 's'} for "${e.title}" ${count === 1 ? 'is' : 'are'} paid and waiting to be fulfilled.`,
          action: { label: 'My Products', to: '/products?tab=products' },
          sortTime: e.start_date ? new Date(e.start_date).getTime() : Infinity,
        });
      });

      // 6. Happening today or tomorrow: a nudge toward check-in.
      for (const e of upcoming) {
        if (e.status !== 'published') continue;
        const days = daysUntil(e.start_date!, now);
        if (days > 1) continue;
        const time = new Date(e.start_date!).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(':00', '');
        out.push({
          key: `soon-${e.id}`,
          level: 'info',
          tag: 'Happening soon',
          message: `"${e.title}" starts ${whenLabel(days)} at ${time}.`,
          action: { label: 'Open check-in', to: `/organizer/events/${e.id}/checkin` },
          sortTime: new Date(e.start_date!).getTime(),
        });
      }

      out.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || a.sortTime - b.sortTime);
      setAlerts(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [events, userId, userEmail]);

  if (!alerts) return null;
  if (alerts.length === 0) {
    return <p className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-medium text-green-800">✓ You're all caught up. Nothing needs your attention right now.</p>;
  }

  const shown = showAll ? alerts : alerts.slice(0, PREVIEW);
  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <p className="font-semibold text-bone">Needs attention</p>
        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">{alerts.length}</span>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {shown.map((a) => (
          <div key={a.key} className={`flex flex-col gap-2 rounded-lg border border-l-4 border-gray-100 bg-gray-50 px-3 py-2.5 sm:flex-row sm:items-center ${LEVEL_STYLE[a.level].bar}`}>
            <div className="min-w-0 flex-1">
              <span className={`mr-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${LEVEL_STYLE[a.level].tag}`}>{a.tag}</span>
              <span className="text-sm text-bone">{a.message}</span>
            </div>
            <Link to={a.action.to} className="shrink-0 self-start rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-marigold shadow-sm ring-1 ring-gray-200 hover:ring-marigold sm:self-auto">
              {a.action.label}
            </Link>
          </div>
        ))}
      </div>
      {alerts.length > PREVIEW && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-1 py-2 text-sm font-medium text-marigold hover:underline">
          {showAll ? 'Show fewer' : `Show all ${alerts.length}`}
        </button>
      )}
    </div>
  );
}
