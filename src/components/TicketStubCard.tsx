import { Link } from 'react-router-dom';
import type { TapEvent } from '../lib/types';

// Status pill colors matching the real Base44 app's OrganizerEventCard exactly.
const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-orange-100 text-orange-800',
  published: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  completed: 'bg-gray-100 text-gray-800',
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  published: 'Live',
  cancelled: 'Cancelled',
  completed: 'Completed',
};

function formatEventDate(iso: string | null) {
  if (!iso) return 'Date to be announced';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function TicketStubCard({ event }: { event: TapEvent }) {
  const status = event.status ?? 'draft';

  return (
    <div className="rounded-2xl bg-surface shadow-sm border border-gray-200 transition hover:shadow-md overflow-hidden">
      {event.poster_url && (
        <div className="aspect-[16/9] w-full overflow-hidden bg-gray-100">
          <img
            src={event.poster_url}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      )}
      <div className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <Link to={`/organizer/events/${event.id}`} className="hover:underline">
              <p className="font-bold text-lg leading-snug text-gray-900 break-words">
                {event.title}
              </p>
            </Link>
            <p className="text-sm text-muted">{formatEventDate(event.start_date)}</p>
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
              STATUS_STYLES[status] ?? STATUS_STYLES.draft
            }`}
          >
            {STATUS_LABEL[status] ?? status}
          </span>
        </div>

        <p className="text-sm text-muted">
          {event.location_name || (event.event_type === 'free' ? 'Free event' : 'Venue TBD')}
        </p>
        <p className="text-xs text-muted">
          {event.event_type === 'free' ? 'Free' : `$${event.ticket_price?.toFixed(2) ?? '0.00'}`}
          {event.max_capacity ? ` · Cap ${event.max_capacity}` : ''}
        </p>

        <div className="pt-1">
          <Link
            to={`/organizer/events/${event.id}`}
            className="inline-flex items-center justify-center w-full h-10 rounded-xl text-sm font-medium bg-marigold text-white hover:bg-marigold/90 transition"
          >
            View event
          </Link>
        </div>
      </div>
    </div>
  );
}
