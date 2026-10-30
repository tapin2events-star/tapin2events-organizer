import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { toast, toastError } from '../../lib/toast';
import CancelEventDialog from '../dashboard/CancelEventDialog';

// Edit event → Series: every date in a repeating event, with tickets sold. Add a date, remove a date (no tickets),
// cancel a date with refunds (dates with tickets, via the existing Cancel event flow), or stop repeating (keep this date
// as a single event).
interface Date_ { id: string; start_date: string; end_date: string | null; status: string; is_parent: boolean; tickets: number; passes: number }
interface Series { parent_id: string; frequency: string | null; pass_enabled: boolean; pass_discount: number | null; dates: Date_[] }
const fmt = (iso: string) => new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export default function SeriesPanel({ eventId, eventTitle }: { eventId: string; eventTitle: string }) {
  const [s, setS] = useState<Series | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<Date_ | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { supabase.rpc('series_dates', { p_event_id: eventId }).then(({ data }) => setS((data ?? null) as Series | null)); }, [eventId]);
  useEffect(() => { load(); }, [load]);
  if (!s) return null;
  const last = s.dates[s.dates.length - 1];
  const suggest = () => {
    if (!last) return '';
    const d = new Date(last.start_date);
    if (s.frequency === 'monthly') d.setMonth(d.getMonth() + 1); else d.setDate(d.getDate() + (s.frequency === 'biweekly' ? 14 : 7));
    return toLocalInput(d);
  };
  async function add() {
    if (!adding) return;
    setBusy(true);
    const { error } = await supabase.rpc('series_add_date', { p_event_id: eventId, p_start: new Date(adding).toISOString() });
    setBusy(false);
    if (error) return toastError(error.message);
    toast('Date added'); setAdding(null); load();
  }
  async function remove(d: Date_) {
    if (!window.confirm(`Remove ${fmt(d.start_date)} from this series?`)) return;
    const { error } = await supabase.rpc('series_remove_date', { p_event_id: d.id });
    if (error) return toastError(error.message);
    toast('Date removed');
    if (d.id === eventId) { window.location.href = '/organizer'; return; }
    load();
  }
  async function stop() {
    if (!window.confirm('Stop repeating? This date stays as a single event, and the other dates without tickets are removed.')) return;
    const { data, error } = await supabase.rpc('series_stop', { p_event_id: eventId });
    if (error) return toastError(error.message);
    const r = data as { removed: number; kept_with_tickets: { title: string; start_date: string }[] };
    if (r.kept_with_tickets.length) window.alert(`${r.removed} date${r.removed === 1 ? '' : 's'} removed. ${r.kept_with_tickets.length} date${r.kept_with_tickets.length === 1 ? ' has' : 's have'} tickets, so ${r.kept_with_tickets.length === 1 ? 'it stays' : 'they stay'} as ${r.kept_with_tickets.length === 1 ? 'its own event' : 'their own series'}: cancel ${r.kept_with_tickets.length === 1 ? 'it' : 'them'} with refunds from ${r.kept_with_tickets.length === 1 ? 'its' : 'their'} dashboard if needed.`);
    else toast('This is now a single event');
    window.location.reload();
  }
  return (
    <div className="mt-2 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-gray-900">🔁 Series · {s.dates.length} date{s.dates.length === 1 ? '' : 's'}{s.frequency ? ` · ${s.frequency === 'biweekly' ? 'every 2 weeks' : s.frequency}` : ''}</p>
        <button type="button" onClick={stop} className="text-sm font-semibold text-red-700 hover:underline">Stop repeating</button>
      </div>
      <ul className="mt-3 divide-y divide-indigo-100 rounded-xl border border-indigo-100 bg-white">
        {s.dates.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-gray-900">{fmt(d.start_date)}{d.id === eventId ? <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-800">editing</span> : null}</span>
              <span className="block text-xs text-gray-500">{d.tickets ? `${d.tickets} ticket${d.tickets === 1 ? '' : 's'}${d.passes ? ` (${d.passes} series pass${d.passes === 1 ? '' : 'es'})` : ''}` : 'No tickets yet'}{d.status === 'draft' ? ' · draft' : ''}</span>
            </span>
            {d.tickets > 0
              ? <button type="button" onClick={() => setCancelling(d)} className="min-h-[36px] rounded-full border border-red-200 px-3 text-xs font-semibold text-red-700">Cancel &amp; refund</button>
              : <button type="button" onClick={() => remove(d)} disabled={s.dates.length <= 1} className="min-h-[36px] rounded-full border border-gray-300 px-3 text-xs font-medium text-gray-700 disabled:opacity-40">Remove</button>}
          </li>
        ))}
      </ul>
      {adding === null ? (
        <button type="button" onClick={() => setAdding(suggest())} className="mt-3 min-h-[40px] rounded-full bg-[#0F1B3D] px-4 text-sm font-semibold text-white">+ Add a date</button>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input type="datetime-local" value={adding} onChange={(e) => setAdding(e.target.value)} aria-label="New date and time" className="min-h-[44px] rounded-xl border border-gray-300 bg-white px-3 text-base text-gray-900 sm:text-sm" />
          <button type="button" onClick={add} disabled={busy || !adding} className="min-h-[44px] rounded-full bg-indigo-600 px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Adding…' : 'Add date'}</button>
          <button type="button" onClick={() => setAdding(null)} className="min-h-[44px] px-2 text-sm text-gray-600">Cancel</button>
        </div>
      )}
      <p className="mt-2 text-xs text-gray-500">Each date is its own event with its own tickets and check-in. New dates copy this series&apos; details. Dates with tickets can only be cancelled with refunds.</p>
      {cancelling && <CancelEventDialog eventId={cancelling.id} eventTitle={`${eventTitle} (${fmt(cancelling.start_date)})`} onClose={() => setCancelling(null)} onCancelled={() => { setCancelling(null); load(); }} />}
    </div>
  );
}
