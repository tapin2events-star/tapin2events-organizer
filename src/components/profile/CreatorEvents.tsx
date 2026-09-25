import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

export interface CreatorEvent {
  id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  poster_url: string | null;
  location_name: string | null;
  is_online: boolean | null;
  parent_event_id: string | null;
}

interface EventCard {
  key: string;
  event: CreatorEvent; // the date shown: live, next upcoming, or most recent past
  dates: number;
  state: 'live' | 'upcoming' | 'past';
}

const PAST_PREVIEW = 6;

function endOf(e: CreatorEvent): number | null {
  if (!e.start_date) return null;
  // Events without an end time are treated as lasting 4 hours.
  return e.end_date ? new Date(e.end_date).getTime() : new Date(e.start_date).getTime() + 4 * 3600 * 1000;
}

// Recurring events are stored as one row per date, so a weekly series would
// flood this list. Each series becomes one card showing how many dates it has
// and the date that matters most right now.
export default function CreatorEvents({ events }: { events: CreatorEvent[] }) {
  const [showAllPast, setShowAllPast] = useState(false);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const groups = new Map<string, CreatorEvent[]>();
    events.forEach((e) => {
      const key = e.parent_event_id ?? e.id;
      groups.set(key, [...(groups.get(key) ?? []), e]);
    });

    const cards: EventCard[] = [];
    groups.forEach((list, key) => {
      const sorted = [...list].sort((a, b) => (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999'));
      const live = sorted.find((e) => e.start_date && new Date(e.start_date).getTime() <= now && (endOf(e) ?? 0) >= now);
      const next = sorted.find((e) => !e.start_date || (endOf(e) ?? 0) >= now);
      if (live) cards.push({ key, event: live, dates: sorted.length, state: 'live' });
      else if (next) cards.push({ key, event: next, dates: sorted.length, state: 'upcoming' });
      else cards.push({ key, event: sorted[sorted.length - 1], dates: sorted.length, state: 'past' });
    });

    const byDate = (a: EventCard, b: EventCard) => (a.event.start_date ?? '9999').localeCompare(b.event.start_date ?? '9999');
    return {
      upcoming: cards.filter((c) => c.state !== 'past').sort((a, b) => (a.state === 'live' ? -1 : b.state === 'live' ? 1 : byDate(a, b))),
      past: cards.filter((c) => c.state === 'past').sort((a, b) => byDate(b, a)),
    };
  }, [events]);

  const card = (c: EventCard) => (
    <Link key={c.key} to={`/events/${c.event.id}`} className="flex gap-3 rounded-xl border border-gray-200 bg-surface p-3 hover:border-marigold">
      {c.event.poster_url ? (
        <img src={c.event.poster_url} alt="" className="h-20 w-16 shrink-0 rounded-lg object-cover" />
      ) : (
        <div className="h-20 w-16 shrink-0 rounded-lg bg-gradient-to-br from-indigo-200 to-teal-200" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap gap-1.5">
          {c.state === 'live' && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">Happening now</span>}
          {c.dates > 1 && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-marigold">Series · {c.dates} dates</span>}
        </div>
        <p className="mt-0.5 truncate font-medium text-bone">{c.event.title}</p>
        <p className="text-xs text-muted">
          {c.event.start_date
            ? new Date(c.event.start_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
            : 'Date TBD'}
          {c.dates > 1 && c.state === 'upcoming' && ' (next date)'}
        </p>
        <p className="truncate text-xs text-muted">{c.event.is_online ? 'Virtual event' : c.event.location_name || ''}</p>
      </div>
    </Link>
  );

  if (upcoming.length === 0 && past.length === 0) {
    return <p className="mt-3 text-sm text-muted">No public events yet.</p>;
  }

  const pastShown = showAllPast ? past : past.slice(0, PAST_PREVIEW);
  return (
    <div className="mt-3 flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-semibold text-bone">Upcoming</p>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted">No upcoming events right now.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{upcoming.map(card)}</div>
        )}
      </div>
      {past.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold text-bone">Past</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{pastShown.map(card)}</div>
          {past.length > PAST_PREVIEW && (
            <button onClick={() => setShowAllPast((v) => !v)} className="mt-2 text-sm font-medium text-marigold hover:underline">
              {showAllPast ? 'Show fewer' : `Show all ${past.length} past events`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
