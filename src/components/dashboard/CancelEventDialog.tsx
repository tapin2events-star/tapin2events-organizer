import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useEscapeKey } from '../../lib/useEscapeKey';
import { money } from '../../lib/earnings';

interface Item { kind: string; label: string; amount: number; reason?: string }
interface Preview {
  event: { title: string; past: boolean };
  orders: { count: number; cents: number };
  vendors: { count: number; cents: number };
  manual: Item[];
  balance: { available: number; pending: number } | null;
  unchecked: number;
}
interface Result { refunded: Item[]; failed: Item[]; manual: Item[]; remaining: number }

const c = (cents: number) => money(cents / 100);

// Cancel an event, refunding ticket buyers their ticket price and vendors
// their vendor fee from the organizer's Stripe payouts (fees aren't refunded).
// Payments that can't be refunded automatically are listed with the reason.
export default function CancelEventDialog({ eventId, eventTitle, onClose, onCancelled }: { eventId: string; eventTitle: string; onClose: () => void; onCancelled: () => void }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [paidBookings, setPaidBookings] = useState<{ count: number; total: number }>({ count: 0, total: 0 });
  useEscapeKey(() => !busy && onClose());

  useEffect(() => {
    supabase.functions.invoke('cancel-event-refunds', { body: { action: 'preview', event_id: eventId } }).then(({ data, error }) => {
      if (error || !data || data.error) setLoadError("Couldn't check this event's payments. Please try again.");
      else setPreview(data as Preview);
    });
    // Paid resource bookings aren't refunded automatically; the organizer cancels each one so it can be refunded.
    supabase.from('resource_bookings').select('final_rate, amount_paid').eq('event_id', eventId).eq('payment_status', 'paid').then(({ data }) => {
      const rows = data ?? [];
      setPaidBookings({ count: rows.length, total: rows.reduce((n, r) => n + Number(r.amount_paid ?? r.final_rate ?? 0), 0) });
    });
  }, [eventId]);

  async function run(withRefunds: boolean) {
    setBusy(true);
    if (!withRefunds) {
      const { error } = await supabase.from('events').update({ status: 'cancelled' }).eq('id', eventId);
      setBusy(false);
      if (error) return setLoadError("Couldn't cancel this event. Please try again.");
      onCancelled();
      return onClose();
    }
    const { data, error } = await supabase.functions.invoke('cancel-event-refunds', { body: { action: 'confirm', event_id: eventId } });
    setBusy(false);
    if (error || !data || data.error) return setLoadError('Something went wrong while refunding. Nothing is refunded twice, so you can safely try again.');
    setResult(data as Result);
    onCancelled();
  }

  const refundCount = preview ? preview.orders.count + preview.vendors.count : 0;
  const refundCents = preview ? preview.orders.cents + preview.vendors.cents : 0;
  const short = !!preview?.balance && preview.balance.available < refundCents;
  const manualList = result ? result.manual : preview?.manual ?? [];

  const ManualList = manualList.length > 0 && (
    <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <button type="button" onClick={() => setShowManual((v) => !v)} className="flex w-full items-center justify-between text-left text-sm font-medium text-gray-800">
        <span>{manualList.length} payment{manualList.length === 1 ? '' : 's'} to refund by hand in Stripe</span>
        <span className="text-gray-400">{showManual ? '▲' : '▼'}</span>
      </button>
      {showManual && (
        <ul className="mt-2 flex max-h-48 flex-col gap-2 overflow-y-auto text-xs text-gray-600">
          {manualList.map((m, i) => (
            <li key={i}><span className="font-medium text-gray-800">{m.label}</span> · {c(m.amount)}<br />{m.reason}</li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={() => !busy && onClose()}>
      <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Cancel event">
        {result ? (
          <>
            <p className="font-display text-lg font-bold text-gray-900">Event cancelled</p>
            <p className="mt-1 text-sm text-gray-600">Ticket holders have been alerted.</p>
            {result.refunded.length > 0 && (
              <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
                ✓ Refunded {result.refunded.length} payment{result.refunded.length === 1 ? '' : 's'}, {c(result.refunded.reduce((n, r) => n + r.amount, 0))} in total. Each person got an alert and an email.
              </p>
            )}
            {result.failed.length > 0 && (
              <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
                <p className="font-medium">{result.failed.length} refund{result.failed.length === 1 ? '' : 's'} didn't go through:</p>
                <ul className="mt-1 list-disc pl-4 text-xs">
                  {result.failed.slice(0, 5).map((f, i) => <li key={i}>{f.label} ({c(f.amount)}): {f.reason}</li>)}
                </ul>
              </div>
            )}
            {ManualList}
            {loadError && <p className="mt-2 text-sm text-magenta">{loadError}</p>}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              {(result.failed.length > 0 || result.remaining > 0) && (
                <button type="button" onClick={() => run(true)} disabled={busy} className="rounded-lg bg-marigold px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                  {busy ? 'Working…' : result.remaining > 0 ? `Continue (${result.remaining} left)` : 'Try failed refunds again'}
                </button>
              )}
              <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-800">Done</button>
            </div>
          </>
        ) : (
          <>
            <p className="font-display text-lg font-bold text-gray-900">Cancel this event?</p>
            <p className="mt-1 text-sm text-gray-600">
              "{eventTitle}" has tickets or payments, so it can't be deleted. Cancelling keeps those records, marks the event as cancelled, and alerts everyone holding a ticket.
            </p>
            {!preview && !loadError && <p className="mt-3 text-sm text-gray-500">Checking payments…</p>}
            {preview?.event.past && <p className="mt-2 text-xs text-gray-500">This event's date has already passed.</p>}
            {preview && refundCount > 0 && (
              <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm text-gray-800">
                <p className="font-semibold">Refunds</p>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {preview.orders.count > 0 && <li>{preview.orders.count} ticket buyer{preview.orders.count === 1 ? ' gets' : 's get'} their ticket price back ({c(preview.orders.cents)})</li>}
                  {preview.vendors.count > 0 && <li>{preview.vendors.count} vendor{preview.vendors.count === 1 ? ' gets' : 's get'} their vendor fee back ({c(preview.vendors.cents)})</li>}
                </ul>
                <p className="mt-2 text-xs text-gray-600">Service fees aren't refunded. The {c(refundCents)} comes out of your Stripe balance{preview.balance ? ` (available now: ${c(preview.balance.available)}; pending: ${c(preview.balance.pending)})` : ''}.</p>
                {short && (
                  <p className="mt-2 rounded bg-amber-100 px-2 py-1.5 text-xs text-amber-900">
                    Your available balance doesn't cover every refund right now. Any that can't go through will be listed, and you can retry once your balance catches up.
                  </p>
                )}
              </div>
            )}
            {preview && paidBookings.count > 0 && (
              <p className="mt-3 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800">
                You've paid {paidBookings.count} resource booking{paidBookings.count === 1 ? '' : 's'} ({money(paidBookings.total)}) for this event. Those aren't refunded automatically. After cancelling, open <strong>Bookings</strong> and choose <strong>Cancel booking</strong> on each one to get the booking price back.
              </p>
            )}
            {preview && ManualList}
            {loadError && <p className="mt-2 text-sm text-magenta">{loadError}</p>}
            <div className="mt-4 flex flex-col gap-2">
              {preview && refundCount > 0 ? (
                <>
                  <button type="button" onClick={() => run(true)} disabled={busy} className="rounded-lg bg-magenta py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                    {busy ? 'Refunding…' : `Cancel & refund ${c(refundCents)}`}
                  </button>
                  <button type="button" onClick={() => run(false)} disabled={busy} className="py-2 text-sm font-medium text-gray-500 hover:text-gray-800">
                    Cancel without refunding (I'll handle refunds myself)
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => run(false)} disabled={busy || (!preview && !loadError)} className="rounded-lg bg-magenta py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                  {busy ? 'Working…' : 'Cancel event'}
                </button>
              )}
              <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-gray-300 py-2.5 text-sm font-semibold text-gray-800">Keep it</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
