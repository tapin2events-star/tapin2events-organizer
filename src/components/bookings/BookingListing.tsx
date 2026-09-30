import { timeRange, dayLabel } from '../../lib/program';

export interface Listing { role: string | null; slots: { title: string; starts_at: string; ends_at: string | null; area: string | null }[] }

// How a booked resource appears on the event page: their role and schedule slots.
export default function BookingListing({ listing, audience }: { listing: Listing | undefined; audience: 'resource' | 'organizer' }) {
  if (!listing) return null;
  const { role, slots } = listing;
  return (
    <div className="mt-2 rounded-lg border border-teal/30 bg-teal/5 px-3 py-2 text-sm">
      <p className="font-medium text-gray-800">
        {audience === 'resource' ? 'On the event page as' : 'Listed as'}: <span className="text-marigold">{role || 'No role set yet'}</span>
      </p>
      {slots.length > 0 ? (
        <ul className="mt-1 space-y-0.5 text-xs text-gray-600">
          {slots.map((s, i) => (
            <li key={i}>🕒 {dayLabel(s.starts_at)}, {timeRange(s.starts_at, s.ends_at)} · {s.title}{s.area ? ` · ${s.area}` : ''}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-0.5 text-xs text-gray-500">{audience === 'resource' ? "The organizer hasn't scheduled your time yet." : 'Not on the schedule yet. Add a time in the event\u2019s Lineup & schedule tab.'}</p>
      )}
    </div>
  );
}
