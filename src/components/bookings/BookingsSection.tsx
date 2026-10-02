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
      ? <div><h2 className="mb-3 font-display text-xl font-bold text-gray-900">Bookings</h2><BookingsReceived /></div>
      : <BookingsManager title="Bookings" />;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-gray-900">Bookings</h2>
        <div className="inline-flex rounded-full border border-gray-200 bg-white p-1" role="tablist" aria-label="Which bookings">
          {([['mine', 'I booked', 0], ['received', 'Booked me', pending]] as const).map(([key, label, dot]) => (
            <button key={key} role="tab" aria-selected={side === key} onClick={() => setSide(key)}
              className={`relative rounded-full px-4 py-2 text-sm font-medium transition ${side === key ? 'bg-marigold text-white' : 'text-gray-600'}`}>
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
