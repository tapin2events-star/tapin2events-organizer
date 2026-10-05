import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { ticketSiteName } from '../lib/externalTickets';

interface FoundEvent {
  key: string;
  title: string;
  description: string;
  start_local: string | null;
  end_local: string | null;
  location_name: string;
  location_address: string;
  is_online: boolean;
  online_link: string | null;
  price: number | null;
  is_free: boolean;
  ticket_url: string | null;
  image_url: string | null;
  category: string;
  event_url: string | null;
  needs_review: string[];
  existing_event_id: string | null;
}

interface Preview {
  method: 'structured' | 'ai';
  page_url: string;
  page_title: string;
  skipped_past: number;
  events: FoundEvent[];
}

const REVIEW_LABELS: Record<string, string> = {
  title: 'title', description: 'description', start_date: 'date', start_time: 'start time', end_date: 'end date',
  location: 'location', price: 'price', category: 'category',
};

// Times from the importer are Eastern wall-clock ("YYYY-MM-DDTHH:mm"); show them exactly as written.
function wallDate(local: string, opts: Intl.DateTimeFormatOptions) {
  const [y, m, d] = local.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });
}
function wallTime(local: string) {
  const h = Number(local.slice(11, 13));
  const min = local.slice(14, 16);
  return `${h % 12 || 12}${min === '00' ? '' : ':' + min} ${h < 12 ? 'AM' : 'PM'}`;
}
const timeMissing = (e: FoundEvent) => e.needs_review.includes('start_time');

function whenLabel(e: FoundEvent) {
  if (!e.start_local) return 'Date not found';
  const date = wallDate(e.start_local, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  if (timeMissing(e)) return `${date} · time not found`;
  let label = `${date} · ${wallTime(e.start_local)}`;
  if (e.end_local) {
    const sameDay = e.end_local.slice(0, 10) === e.start_local.slice(0, 10);
    const nextDay = !sameDay && new Date(e.end_local.slice(0, 10)).getTime() - new Date(e.start_local.slice(0, 10)).getTime() === 86400000;
    label += sameDay || (nextDay && Number(e.end_local.slice(11, 13)) < 12)
      ? ` – ${wallTime(e.end_local)}`
      : ` – ${wallDate(e.end_local, { month: 'short', day: 'numeric' })}, ${wallTime(e.end_local)}`;
  }
  return label;
}

const DATE_FLAGS = ['start_date', 'start_time', 'end_date'];

// Edit an imported event's date and times before saving it.
function WhenEditor({ e, onChange }: { e: FoundEvent; onChange: (start: string | null, end: string | null) => void }) {
  const [date, setDate] = useState(e.start_local?.slice(0, 10) ?? '');
  const [start, setStart] = useState(e.start_local && !timeMissing(e) ? e.start_local.slice(11, 16) : '');
  const [end, setEnd] = useState(e.end_local ? e.end_local.slice(11, 16) : '');
  const [endDate, setEndDate] = useState(e.end_local && e.start_local && e.end_local.slice(0, 10) !== e.start_local.slice(0, 10) ? e.end_local.slice(0, 10) : '');
  const [multiDay, setMultiDay] = useState(!!endDate && !(end && Number(end.slice(0, 2)) < 12 && endDate && date && new Date(endDate).getTime() - new Date(date).getTime() === 86400000));

  function apply(d = date, s = start, en = end, ed = endDate, md = multiDay) {
    if (!d || !s) { onChange(d && s ? `${d}T${s}` : null, null); return; }
    const startLocal = `${d}T${s}`;
    let endLocal: string | null = null;
    if (en) {
      let day = md && ed ? ed : d;
      // A same-day end earlier than the start runs past midnight.
      if (!md && en <= s) { const t = new Date(`${d}T12:00:00Z`); t.setUTCDate(t.getUTCDate() + 1); day = t.toISOString().slice(0, 10); }
      endLocal = `${day}T${en}`;
      if (endLocal <= startLocal) endLocal = null;
    }
    onChange(startLocal, endLocal);
  }
  const field = 'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900';
  return (
    <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <label className="col-span-2 min-w-0 text-xs font-medium text-gray-700 sm:col-span-1">Date
          <input type="date" className={field} value={date} onChange={(ev) => { setDate(ev.target.value); apply(ev.target.value); }} />
        </label>
        <label className="min-w-0 text-xs font-medium text-gray-700">Starts
          <input type="time" className={field} value={start} onChange={(ev) => { setStart(ev.target.value); apply(date, ev.target.value); }} />
        </label>
        <label className="min-w-0 text-xs font-medium text-gray-700">Ends <span className="font-normal text-gray-400">(optional)</span>
          <input type="time" className={field} value={end} onChange={(ev) => { setEnd(ev.target.value); apply(date, start, ev.target.value); }} />
        </label>
      </div>
      <label className="mt-2 flex items-center gap-2 text-xs text-gray-700">
        <input type="checkbox" checked={multiDay} onChange={(ev) => { setMultiDay(ev.target.checked); apply(date, start, end, endDate, ev.target.checked); }} className="h-4 w-4 accent-marigold" />
        Ends on a later day
      </label>
      {multiDay && (
        <label className="mt-2 block text-xs font-medium text-gray-700">End date
          <input type="date" className={field} value={endDate} min={date} onChange={(ev) => { setEndDate(ev.target.value); apply(date, start, end, ev.target.value, true); }} />
        </label>
      )}
      <p className="mt-2 text-xs text-gray-500">Eastern time. An end time earlier than the start (like 9 PM – 2 AM) is treated as the next morning.</p>
    </div>
  );
}

function priceLabel(e: FoundEvent) {
  if (e.is_free) return 'Free';
  if (e.price && e.price > 0) return `From $${e.price}`;
  return 'Price to confirm';
}

// Some pages repeat the venue as the address; don't show or save it twice.
const tidyAddress = (e: FoundEvent) => (e.location_address.trim().toLowerCase() === e.location_name.trim().toLowerCase() ? '' : e.location_address);

export default function ImportEvents() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingWhen, setEditingWhen] = useState<Set<string>>(new Set());

  function updateWhen(key: string, start: string | null, end: string | null) {
    setPreview((p) => p && {
      ...p,
      events: p.events.map((x) => (x.key === key
        ? { ...x, start_local: start, end_local: end, needs_review: start ? x.needs_review.filter((r) => !DATE_FLAGS.includes(r)) : x.needs_review }
        : x)),
    });
  }
  const [confirmed, setConfirmed] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: { id: string; title: string }[]; skipped: { title: string; reason: string; existing_event_id?: string }[] } | null>(null);

  async function findEvents() {
    setLoading(true);
    setError(null);
    setPreview(null);
    setResult(null);
    const { data, error: fnError } = await supabase.functions.invoke('import-events-from-url', { body: { action: 'preview', url } });
    setLoading(false);
    if (fnError || !data?.events) {
      let message = "Couldn't read that page. Please check the link and try again.";
      try {
        const ctx = (fnError as { context?: Response } | null)?.context;
        const body = ctx ? await ctx.json() : data;
        if (body?.error) message = body.error;
      } catch { /* keep the default message */ }
      setError(message);
      return;
    }
    const p = data as Preview;
    setPreview(p);
    setEditingWhen(new Set((p?.events ?? []).filter((x: FoundEvent) => !x.existing_event_id && x.needs_review.some((r) => DATE_FLAGS.includes(r))).map((x: FoundEvent) => x.key)));
    setSelected(new Set(p.events.filter((e) => !e.existing_event_id).map((e) => e.key)));
  }

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function importSelected() {
    if (!preview) return;
    const chosen = preview.events.filter((e) => selected.has(e.key)).map((e) => ({ ...e, location_address: tidyAddress(e) }));
    setImporting(true);
    setError(null);
    const { data, error: fnError } = await supabase.functions.invoke('import-events-from-url', { body: { action: 'create', events: chosen } });
    setImporting(false);
    if (fnError || !data) {
      setError("Couldn't import those events. Please try again.");
      return;
    }
    setResult(data);
  }

  function startOver() {
    setUrl('');
    setPreview(null);
    setResult(null);
    setConfirmed(false);
    setError(null);
  }

  const importable = preview?.events.filter((e) => !e.existing_event_id) ?? [];
  const chosenCount = importable.filter((e) => selected.has(e.key)).length;
  const missingTime = importable.filter((e) => selected.has(e.key) && (!e.start_local || timeMissing(e)));

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/organizer" className="-my-2 inline-block py-2 text-sm font-medium text-marigold">&larr; Organizer Dashboard</Link>
      <h1 className="mt-2 font-display text-3xl font-extrabold text-bone">Import events</h1>
      <p className="mt-1 text-muted">Bring in events from your website or Eventbrite. They arrive as drafts, so you can review everything before publishing.</p>

      {!result && (
        <div className="mt-6 rounded-2xl border border-gray-200 bg-surface2 p-5">
          <label htmlFor="import-url" className="text-sm font-medium text-bone">Link to your event or events page</label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id="import-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && url.trim() && !loading && findEvents()}
              placeholder="eventbrite.com/e/… or yoursite.com/events"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 outline-none focus:border-marigold"
            />
            <button type="button" onClick={findEvents} disabled={!url.trim() || loading} className="shrink-0 rounded-lg bg-marigold px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              {loading ? 'Reading the page…' : 'Find events'}
            </button>
          </div>
          {loading && <p className="mt-2 text-sm text-muted">This usually takes a few seconds. Calendar pages with many events can take up to a minute.</p>}
          {error && <p className="mt-2 text-sm text-magenta">{error}</p>}
          <p className="mt-3 text-xs text-muted">
            Works with Eventbrite and most event websites. Facebook and Instagram can't be read automatically. For those,{' '}
            <Link to="/organizer/new" className="font-medium text-marigold">use Quick create with your flyer</Link>.
          </p>
        </div>
      )}

      {preview && !result && (
        <div className="mt-6">
          {preview.events.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center">
              <p className="font-semibold text-bone">No upcoming events found on that page</p>
              <p className="mt-1 text-sm text-muted">
                {preview.skipped_past > 0 ? `It only listed ${preview.skipped_past} past event${preview.skipped_past === 1 ? '' : 's'}. ` : ''}
                Try the link to a specific event, or <Link to="/organizer/new" className="font-medium text-marigold">create it with Quick create</Link>.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-xl font-bold text-bone">
                  Found {preview.events.length} upcoming event{preview.events.length === 1 ? '' : 's'}
                </h2>
                {importable.length > 1 && (
                  <button type="button" onClick={() => setSelected(chosenCount === importable.length ? new Set() : new Set(importable.map((e) => e.key)))} className="-my-2 py-2 text-sm font-medium text-marigold">
                    {chosenCount === importable.length ? 'Select none' : 'Select all'}
                  </button>
                )}
              </div>
              <p className="mt-0.5 text-sm text-muted">
                {preview.method === 'structured'
                  ? 'Read directly from the event details on that page.'
                  : 'Read by AI. Double-check anything marked below before publishing.'}
                {preview.skipped_past > 0 && ` Skipped ${preview.skipped_past} past event${preview.skipped_past === 1 ? '' : 's'}.`}
              </p>

              <div className="mt-3 flex flex-col gap-2">
                {preview.events.map((e) => {
                  const done = !!e.existing_event_id;
                  const checked = selected.has(e.key) && !done;
                  const review = e.needs_review.filter((r) => (r !== 'category' || preview.method === 'ai') && !(editingWhen.has(e.key) && DATE_FLAGS.includes(r))).map((r) => REVIEW_LABELS[r] ?? r);
                  const address = tidyAddress(e);
                  const editing = editingWhen.has(e.key);
                  return (
                    <div key={e.key}>
                    <label className={`flex gap-3 rounded-xl border bg-white p-3 ${done ? 'border-gray-200 opacity-70' : checked ? 'border-marigold ring-1 ring-marigold/30' : 'border-gray-200'} ${done ? '' : 'cursor-pointer'}`}>
                      <input type="checkbox" checked={checked} disabled={done} onChange={() => toggle(e.key)} className="mt-1 h-5 w-5 shrink-0 accent-marigold" />
                      {e.image_url ? (
                        <img src={e.image_url} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" onError={(ev) => ((ev.target as HTMLImageElement).style.display = 'none')} />
                      ) : (
                        <div className="h-20 w-20 shrink-0 rounded-lg bg-gradient-to-br from-indigo-100 to-teal-100" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900">{e.title}</p>
                        <p className={`text-sm ${!e.start_local || timeMissing(e) ? 'font-medium text-amber-800' : 'text-gray-600'}`}>
                          {whenLabel(e)}
                          {!done && (
                            <button type="button" onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); setEditingWhen((prev) => { const n = new Set(prev); if (n.has(e.key)) n.delete(e.key); else n.add(e.key); return n; }); }}
                              className="ml-2 text-xs font-semibold text-marigold underline">
                              {editing ? 'Done' : 'Edit'}
                            </button>
                          )}
                        </p>
                        <p className="truncate text-sm text-gray-500">{e.is_online ? 'Online' : [e.location_name, address].filter(Boolean).join(' · ') || 'Location not found'}</p>
                        <p className="mt-0.5 text-sm text-gray-500">
                          {priceLabel(e)}
                          {e.ticket_url && <> · Tickets on {ticketSiteName(e.ticket_url)}</>}
                        </p>
                        {done ? (
                          <p className="mt-1 text-xs font-medium text-green-700">
                            Already imported · <Link to={`/organizer/events/${e.existing_event_id}/edit`} className="underline">View it</Link>
                          </p>
                        ) : review.length > 0 ? (
                          <p className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Check the {review.join(', ')}</p>
                        ) : null}
                      </div>
                    </label>
                    {editing && !done && <WhenEditor e={e} onChange={(st, en) => updateWhen(e.key, st, en)} />}
                    </div>
                  );
                })}
              </div>

              {importable.length > 0 && (
                <div className="mt-4 rounded-2xl border border-gray-200 bg-surface2 p-4">
                  <label className="flex cursor-pointer items-start gap-3 text-sm text-bone">
                    <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-marigold" />
                    <span>I'm the organizer of these events, or I have permission to post them on TapIN.</span>
                  </label>
                  {missingTime.length > 0 && (
                    <p role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      {missingTime.length === 1 ? `"${missingTime[0].title}" has` : `${missingTime.length} events have`} no start time on the page. Add one with <strong>Edit</strong> above, or set it later before publishing.
                    </p>
                  )}
                  <button type="button" onClick={importSelected} disabled={!confirmed || chosenCount === 0 || importing} className="mt-3 w-full rounded-lg bg-marigold px-5 py-3 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto">
                    {importing ? 'Importing…' : `Import ${chosenCount} as draft${chosenCount === 1 ? '' : 's'}`}
                  </button>
                  <p className="mt-2 text-xs text-muted">Tickets stay on the original site. Your TapIN event page will link people there.</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {result && (
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="font-display text-xl font-bold text-bone">
            {result.created.length > 0 ? `Imported ${result.created.length} event${result.created.length === 1 ? '' : 's'} as drafts` : 'Nothing new was imported'}
          </h2>
          {result.created.length > 0 && <p className="mt-0.5 text-sm text-muted">Review each one, add any missing details, then publish when it's ready.</p>}
          <div className="mt-3 flex flex-col gap-2">
            {result.created.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2.5">
                <span className="min-w-0 truncate text-sm font-medium text-gray-900">{c.title}</span>
                <Link to={`/organizer/events/${c.id}/edit`} className="shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-marigold hover:border-marigold">Review &amp; publish</Link>
              </div>
            ))}
            {result.skipped.map((s, i) => (
              <div key={i} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2.5 text-sm text-gray-500">
                <span className="min-w-0 truncate">{s.title}: {s.reason}</span>
                {s.existing_event_id && <Link to={`/organizer/events/${s.existing_event_id}/edit`} className="shrink-0 font-medium text-marigold">View</Link>}
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={startOver} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-bone hover:border-marigold">Import another link</button>
            <Link to="/organizer" className="rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-white">Go to dashboard</Link>
          </div>
        </div>
      )}
    </div>
  );
}
