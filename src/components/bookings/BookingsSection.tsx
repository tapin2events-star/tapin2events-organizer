import { useEffect, useState } from 'react';
import BookingsManager from './BookingsManager';
import BookingsReceived from './BookingsReceived';

// Activity > Bookings: the ones you made, and the ones where you were booked.
// The switch only appears when someone has both.
export default function BookingsSection({ mine, received, pending }: { mine: number; received: number; pending: number }) {
  const both = mine > 0 && received > 0;
  const [side, setSide] = useState<'mine' | 'received'>(() => (mine === 0 && received > 0) || pending > 0 ? 'received' : 'mine');
  useEffect(() => { if (mine === 0 && received > 0) setSide('received'); }, [mine, received]);

  if (!both) {
    return received > 0 && mine === 0
      ? <div className="mt-8"><h2 className="mb-3 font-display text-xl font-bold text-gray-900">Bookings</h2><BookingsReceived /></div>
      : <div className="mt-8"><BookingsManager title="Bookings" /></div>;
  }

  return (
    <div className="mt-8">
      {/* Phone: title, then a full-width switch underneath. Wider screens: side by side. */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-display text-xl font-bold text-gray-900">Bookings</h2>
        <div className="flex w-full rounded-full border border-gray-200 bg-white p-1 sm:inline-flex sm:w-auto" role="tablist" aria-label="Which bookings">
          {([['mine', 'I booked', 0], ['received', 'Booked me', pending]] as const).map(([key, label, dot]) => (
            <button key={key} role="tab" aria-selected={side === key} onClick={() => setSide(key)}
              className={`relative flex-1 rounded-full px-4 py-2 text-sm font-medium transition sm:flex-none ${side === key ? 'bg-marigold text-white' : 'text-gray-600'}`}>
              {label}
              {dot > 0 && <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 text-[11px] font-bold text-white" aria-label={`${dot} need your reply`}>{dot}</span>}
            </button>
          ))}
        </div>
      </div>
      {side === 'mine' ? <BookingsManager /> : <BookingsReceived />}
    </div>
  );
}
