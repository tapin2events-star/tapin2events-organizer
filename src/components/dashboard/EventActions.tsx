import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import type { TapEvent } from '../../lib/types';
import { useEscapeKey } from '../../lib/useEscapeKey';

// The ⋯ menu on an organizer's own event card. Events with no tickets,
// registrations, or payments can be deleted; events with any are cancelled
// instead so those records are kept (the database enforces this too).
export default function EventActions({
  event,
  seriesChildren,
  hasSales,
  onDeleted,
  onCancelled,
}: {
  event: TapEvent;
  seriesChildren: TapEvent[];
  hasSales: boolean | undefined;
  onDeleted: (ids: string[]) => void;
  onCancelled: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<'delete' | 'cancel' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEscapeKey(() => { setOpen(false); if (!busy) setConfirm(null); }, open || !!confirm);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const isSeries = seriesChildren.length > 0;
  const cancelled = event.status === 'cancelled';
  const paidEvent = event.event_type === 'paid' && !event.external_ticket_url;

  async function doDelete() {
    setBusy(true);
    setError(null);
    const ids = [...seriesChildren.map((c) => c.id), event.id];
    // Delete the other dates first so none are left pointing at a missing series.
    if (isSeries) {
      const { error: childErr } = await supabase.from('events').delete().in('id', seriesChildren.map((c) => c.id));
      if (childErr) {
        setBusy(false);
        setError('One of the dates in this series has tickets or registrations, so the series can\'t be deleted. Cancel it instead.');
        return;
      }
    }
    const { error: delErr } = await supabase.from('events').delete().eq('id', event.id);
    setBusy(false);
    if (delErr) {
      setError(/tickets|registrations|payments/i.test(delErr.message) ? delErr.message : "Couldn't delete this event. Please try again.");
      return;
    }
    setConfirm(null);
    onDeleted(ids);
  }

  async function doCancel() {
    setBusy(true);
    setError(null);
    const { error: upErr } = await supabase.from('events').update({ status: 'cancelled' }).eq('id', event.id);
    setBusy(false);
    if (upErr) {
      setError("Couldn't cancel this event. Please try again.");
      return;
    }
    setConfirm(null);
    onCancelled(event.id);
  }

  return (
    <>
      <div ref={ref} className="absolute left-3 top-3 z-20">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={`Options for ${event.title}`}
          aria-expanded={open}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-lg font-bold leading-none text-white backdrop-blur-sm hover:bg-black/70"
        >
          ⋯
        </button>
        {open && (
          <div className="mt-1 w-48 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 text-sm shadow-lg">
            <Link to={`/organizer/events/${event.id}/edit`} className="block px-4 py-2.5 text-gray-800 hover:bg-gray-50">Edit event</Link>
            {hasSales === undefined ? (
              <p className="px-4 py-2.5 text-gray-400">Checking…</p>
            ) : hasSales ? (
              !cancelled && (
                <button type="button" onClick={() => { setOpen(false); setConfirm('cancel'); }} className="block w-full px-4 py-2.5 text-left text-magenta hover:bg-red-50">
                  Cancel event
                </button>
              )
            ) : (
              <button type="button" onClick={() => { setOpen(false); setConfirm('delete'); }} className="block w-full px-4 py-2.5 text-left text-magenta hover:bg-red-50">
                {isSeries ? 'Delete series' : 'Delete event'}
              </button>
            )}
          </div>
        )}
      </div>

      {confirm && (
        <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={() => !busy && setConfirm(null)}>
          <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            {confirm === 'delete' ? (
              <>
                <p className="font-display text-lg font-bold text-gray-900">{isSeries ? 'Delete this series?' : 'Delete this event?'}</p>
                <p className="mt-1 text-sm text-gray-600">
                  "{event.title}" {isSeries ? `and all ${seriesChildren.length + 1} of its dates` : ''} will be permanently removed. This can't be undone.
                </p>
              </>
            ) : (
              <>
                <p className="font-display text-lg font-bold text-gray-900">Cancel this event?</p>
                <p className="mt-1 text-sm text-gray-600">
                  "{event.title}" has tickets or registrations, so it can't be deleted. Cancelling keeps those records, marks the event as cancelled on its page, and alerts everyone holding a ticket.
                </p>
                {paidEvent && (
                  <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    Refunds aren't automatic yet. Issue refunds for paid tickets from your Stripe dashboard.
                  </p>
                )}
              </>
            )}
            {error && <p className="mt-2 text-sm text-magenta">{error}</p>}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setConfirm(null)} disabled={busy} className="rounded-lg border border-gray-300 py-2.5 text-sm font-semibold text-gray-800">
                Keep it
              </button>
              <button type="button" onClick={confirm === 'delete' ? doDelete : doCancel} disabled={busy} className="rounded-lg bg-magenta py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                {busy ? 'Working…' : confirm === 'delete' ? 'Delete' : 'Cancel event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
