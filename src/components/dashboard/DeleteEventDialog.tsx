import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { TapEvent } from '../../lib/types';
import { useEscapeKey } from '../../lib/useEscapeKey';

// Confirms and deletes an event with no sales. For a recurring series, all
// dates are deleted together so none are left pointing at a missing series.
// The database refuses to delete anything with tickets or payments.
export default function DeleteEventDialog({
  event,
  seriesChildren,
  onClose,
  onDeleted,
}: {
  event: TapEvent;
  seriesChildren: TapEvent[];
  onClose: () => void;
  onDeleted: (ids: string[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSeries = seriesChildren.length > 0;
  useEscapeKey(() => !busy && onClose());

  async function doDelete() {
    setBusy(true);
    setError(null);
    const ids = [...seriesChildren.map((c) => c.id), event.id];
    if (isSeries) {
      const { error: childErr } = await supabase.from('events').delete().in('id', seriesChildren.map((c) => c.id));
      if (childErr) {
        setBusy(false);
        setError("One of the dates in this series has tickets or registrations, so the series can't be deleted. Cancel it instead.");
        return;
      }
    }
    const { error: delErr } = await supabase.from('events').delete().eq('id', event.id);
    setBusy(false);
    if (delErr) {
      setError(/tickets|registrations|payments/i.test(delErr.message) ? delErr.message : "Couldn't delete this event. Please try again.");
      return;
    }
    onDeleted(ids);
  }

  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={() => !busy && onClose()}>
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Delete event">
        <p className="font-display text-lg font-bold text-gray-900">{isSeries ? 'Delete this series?' : 'Delete this event?'}</p>
        <p className="mt-1 text-sm text-gray-600">
          "{event.title}" {isSeries ? `and all ${seriesChildren.length + 1} of its dates` : ''} will be permanently removed. This can't be undone.
        </p>
        {error && <p className="mt-2 text-sm text-magenta">{error}</p>}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-gray-300 py-2.5 text-sm font-semibold text-gray-800">Keep it</button>
          <button type="button" onClick={doDelete} disabled={busy} className="rounded-lg bg-magenta py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? 'Working…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
