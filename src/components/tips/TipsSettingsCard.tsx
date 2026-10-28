import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useFeature } from '../../lib/preview';
import { toast, toastError } from '../../lib/toast';
import ShareQR from '../ShareQR';
import { eventShortCode } from '../../lib/shortLink';

// Promote tab (preview): Tip the performers. One switch; lineup performers on TapIN are included (each can be turned
// off); revenue-split people opt in one at a time. A tip QR for the stage or a table sign.
interface Row { id: string; name: string; photo: string | null; on_tapin: boolean; tips_on: boolean; ready: boolean }
interface Settings { enabled: boolean; lineup: Row[]; split: Row[]; total_cents: number; count: number }
export default function TipsSettingsCard({ eventId }: { eventId: string }) {
  const [eventTitle, setEventTitle] = useState('this event');
  const on = useFeature('performer_tips');
  const [s, setS] = useState<Settings | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const load = useCallback(() => { supabase.rpc('event_tip_settings', { p_event_id: eventId }).then(({ data }) => setS((data ?? null) as Settings | null)); }, [eventId]);
  useEffect(() => {
    if (!on) return;
    load(); eventShortCode(eventId).then(setCode);
    supabase.from('events').select('title').eq('id', eventId).maybeSingle().then(({ data }) => { if (data?.title) setEventTitle(data.title); });
  }, [on, load, eventId]);
  if (!on || !s) return null;
  async function set(args: { p_enabled?: boolean; p_lineup_id?: string; p_split_id?: string; p_on?: boolean }, msg?: string) {
    const { error } = await supabase.rpc('set_event_tips', { p_event_id: eventId, p_enabled: args.p_enabled ?? null, p_lineup_id: args.p_lineup_id ?? null, p_split_id: args.p_split_id ?? null, p_on: args.p_on ?? null });
    if (error) return toastError(error.message);
    if (msg) toast(msg);
    load();
  }
  const Switch = ({ checked, onClick, label }: { checked: boolean; onClick: () => void; label: string }) => (
    <button role="switch" aria-checked={checked} aria-label={label} onClick={onClick} className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-emerald-600' : 'bg-gray-300'}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
  const person = (r: Row, kind: 'lineup' | 'split') => (
    <li key={r.id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-2.5">
      {r.photo ? <img src={r.photo} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-600">{r.name.charAt(0)}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-gray-900">{r.name}</span>
        <span className="block text-xs text-gray-500">{!r.on_tapin ? 'Not on TapIN yet, so they can\u2019t be tipped' : r.ready ? 'Payouts connected' : 'Tips are held until they connect payouts'}</span>
      </span>
      {r.on_tapin && <Switch checked={r.tips_on} label={`Tips for ${r.name}`} onClick={() => set(kind === 'lineup' ? { p_lineup_id: r.id, p_on: !r.tips_on } : { p_split_id: r.id, p_on: !r.tips_on })} />}
    </li>
  );
  return (
    <section className="mb-6 rounded-2xl border border-gray-200 bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-lg font-bold text-bone">💸 Tip the performers</p>
          <p className="mt-0.5 text-sm text-muted">Let attendees tip your performers on the event page and their tickets. 100% goes to the performers.</p>
        </div>
        <Switch checked={s.enabled} label="Tip the performers" onClick={() => set({ p_enabled: !s.enabled }, s.enabled ? 'Tips turned off' : '✓ Tips are on')} />
      </div>
      {s.enabled && (
        <>
          {s.count > 0 && <p className="mt-3 text-sm font-semibold text-emerald-700">{s.count} tip{s.count === 1 ? '' : 's'} so far · ${(s.total_cents / 100).toFixed(2)}</p>}
          <p className="mt-4 text-sm font-semibold text-bone">Lineup</p>
          {s.lineup.length ? <ul className="mt-2 flex flex-col gap-1.5">{s.lineup.map((r) => person(r, 'lineup'))}</ul> : <p className="mt-1 text-sm text-muted">Add performers in the Lineup tab, and they&apos;ll show up here.</p>}
          {s.split.length > 0 && (
            <>
              <p className="mt-4 text-sm font-semibold text-bone">People in the revenue split <span className="font-normal text-muted">(off unless you turn them on)</span></p>
              <ul className="mt-2 flex flex-col gap-1.5">{s.split.map((r) => person(r, 'split'))}</ul>
            </>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <ShareQR path={code ? `/e/${code}#tip` : `/events/${eventId}#tip`} title={`Tip the performers · ${eventTitle}`} subtitle="Scan to tip tonight's performers" label="Tip QR code" eventId={eventId}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-gray-300 px-4 text-sm font-medium text-bone" />
            <span className="text-xs text-muted">Show it on stage or print it for a table sign.</span>
          </div>
        </>
      )}
    </section>
  );
}
