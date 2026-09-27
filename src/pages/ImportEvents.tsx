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

function whenLabel(e: FoundEvent) {
  if (!e.start_local) return 'Date not found';
  const start = new Date(e.start_local);
  const dateOnly = e.needs_review.includes('start_time') || e.start_local.endsWith('T00:00');
  const date = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const time = dateOnly ? '' : ' · ' + start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(':00', '');
  const end = e.end_local ? new Date(e.end_local) : null;
  const multiDay = end && end.toDateString() !== start.toDateString();
  return date + time + (multiDay ? ` – ${end!.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : '');
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
                  const review = e.needs_review.filter((r) => r !== 'category' || preview.method === 'ai').map((r) => REVIEW_LABELS[r] ?? r);
                  const address = tidyAddress(e);
                  return (
                    <label key={e.key} className={`flex gap-3 rounded-xl border bg-white p-3 ${done ? 'border-gray-200 opacity-70' : checked ? 'border-marigold ring-1 ring-marigold/30' : 'border-gray-200'} ${done ? '' : 'cursor-pointer'}`}>
                      <input type="checkbox" checked={checked} disabled={done} onChange={() => toggle(e.key)} className="mt-1 h-5 w-5 shrink-0 accent-marigold" />
                      {e.image_url ? (
                        <img src={e.image_url} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" onError={(ev) => ((ev.target as HTMLImageElement).style.display = 'none')} />
                      ) : (
                        <div className="h-20 w-20 shrink-0 rounded-lg bg-gradient-to-br from-indigo-100 to-teal-100" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900">{e.title}</p>
                        <p className="text-sm text-gray-600">{whenLabel(e)}</p>
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
                  );
                })}
              </div>

              {importable.length > 0 && (
                <div className="mt-4 rounded-2xl border border-gray-200 bg-surface2 p-4">
                  <label className="flex cursor-pointer items-start gap-3 text-sm text-bone">
                    <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-marigold" />
                    <span>I'm the organizer of these events, or I have permission to post them on TapIN.</span>
                  </label>
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
