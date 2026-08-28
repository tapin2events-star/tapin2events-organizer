import { Link } from 'react-router-dom';
import type { TapEvent } from '../../lib/types';

// Same category-color hashing approach as the real Base44 EventCard,
// so categories land on consistent, distinct colors.
const CATEGORY_COLORS = [
  'bg-purple-100 text-purple-800',
  'bg-green-100 text-green-800',
  'bg-blue-100 text-blue-800',
  'bg-orange-100 text-orange-800',
  'bg-pink-100 text-pink-800',
  'bg-gray-200 text-gray-800',
  'bg-emerald-100 text-emerald-800',
  'bg-indigo-100 text-indigo-800',
  'bg-yellow-100 text-yellow-800',
  'bg-red-100 text-red-800',
  'bg-cyan-100 text-cyan-800',
  'bg-lime-100 text-lime-800',
];

function categoryColor(category: string | null) {
  if (!category) return 'bg-gray-100 text-gray-800';
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = (hash << 5) - hash + category.charCodeAt(i);
    hash |= 0;
  }
  return CATEGORY_COLORS[Math.abs(hash) % CATEGORY_COLORS.length];
}

function displayPrice(event: TapEvent): number {
  if (event.is_seating_enabled && event.seating_sections?.length) {
    return Math.min(...event.seating_sections.map((s) => s.price || 0));
  }
  return event.ticket_price || 0;
}

export default function DiscoverEventCard({
  event,
  isSaved,
  onToggleSave,
}: {
  event: TapEvent;
  isSaved: boolean;
  onToggleSave: (eventId: string) => void;
}) {
  const isOver = !event.is_recurring && event.start_date ? new Date(event.start_date) < new Date() : false;
  const price = displayPrice(event);
  const hasMultipleSections = event.is_seating_enabled && (event.seating_sections?.length ?? 0) > 1;

  return (
    <div className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-lg">
      <div className="relative">
        {event.poster_url ? (
          <img
            src={event.poster_url}
            alt=""
            className="h-48 w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-48 w-full items-center justify-center bg-gradient-to-br from-indigo-100 to-teal-100">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="1.5">
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M8 3v4M16 3v4M3 10h18" strokeLinecap="round" />
            </svg>
          </div>
        )}

        <div className="absolute right-3 top-3 flex gap-2">
          <button
            onClick={() => onToggleSave(event.id)}
            aria-label={isSaved ? 'Remove from saved' : 'Save event'}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/85 backdrop-blur hover:bg-white"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill={isSaved ? '#4F46E5' : 'none'} stroke={isSaved ? '#4F46E5' : '#6B7280'} strokeWidth="2">
              <path d="M5 3h14a1 1 0 0 1 1 1v17l-8-5-8 5V4a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${categoryColor(event.category)}`}>
            {event.category}
          </span>
          {event.is_recurring && (
            <span className="rounded-full bg-gray-800 px-2.5 py-1 text-xs font-medium text-white">Recurring</span>
          )}
          {event.is_online && (
            <span className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-medium text-white">Online</span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 p-5">
        <div>
          <Link to={`/discover/events/${event.id}`} className="hover:text-marigold">
            <h3 className="line-clamp-2 font-display text-lg font-bold text-gray-900">{event.title}</h3>
          </Link>
          {event.description && (
            <p className="mt-1 line-clamp-2 text-sm text-gray-500">{event.description}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5 text-sm text-gray-500">
          {event.start_date && (
            <div className="flex items-center gap-2">
              <span>{new Date(event.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              <span>&middot;</span>
              <span>{new Date(event.start_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            {event.is_online ? <span>Virtual event</span> : <span className="line-clamp-1">{event.location_name || 'Venue TBD'}</span>}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 pt-3">
          {event.event_type === 'free' ? (
            <span className="rounded-full border border-green-600 px-2.5 py-0.5 text-sm font-medium text-green-600">Free</span>
          ) : (
            <span className="text-lg font-bold text-gray-900">
              ${price}
              {hasMultipleSections && <span className="ml-1 text-xs font-normal text-gray-400">+</span>}
            </span>
          )}

          {isOver ? (
            <span className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm text-gray-400">Event ended</span>
          ) : (
            <Link
              to={`/discover/events/${event.id}`}
              className="rounded-lg bg-gradient-to-r from-marigold to-mint px-4 py-1.5 text-sm font-medium text-white hover:opacity-90"
            >
              {event.event_type === 'free' ? 'Register' : 'Get Tickets'}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
