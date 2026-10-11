import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';

interface Source { id: string; name: string; url: string | null; kind: 'page' | 'ical' | 'ticketmaster'; active: boolean; last_run_at: string | null; last_result: string | null; feed_url: string | null; feed_kind: string | null; use_images: boolean }
interface Found {
  id: string; source_id: string | null; title: string; start_date: string | null; end_date: string | null; location_name: string | null; location_address: string | null;
  description: string | null; ticket_url: string | null; event_url: string | null; image_url: string | null; category: string | null; price: number | null; is_free: boolean;
  status: 'pending' | 'approved' | 'skipped' | 'duplicate'; duplicate_of: string | null; event_id: string | null; found_at: string; issues: string[]; image_credit: string | null;
}
const ISSUE_LABEL: Record<string, string> = { time_missing: 'Time not listed: set it before or after publishing', venue_missing: 'Venue missing', outside_triangle: 'May be outside the Triangle', far_out: 'More than 2 months away' };
const CATEGORIES = ['Music', 'Arts & Culture', 'Community', 'Nightlife', 'Food & Drink', 'Business', 'Sports & Fitness', 'Other'];
const KIND_LABEL = { page: 'Web page', ical: 'Calendar feed (.ics)', ticketmaster: 'Ticketmaster' } as const;
const when = (iso: string | null) => {
  if (!iso) return 'No date';
  const d = new Date(iso);
  const midnight = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d) === '00:00';
  return midnight
    ? `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York' })} · time not listed`
    : d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }).replace(':00 ', ' ');
};

// Admin > Imports: approved local sources, checked every Monday, and a review queue.
export default function ImportsTab({ notify: rawNotify }: { notify: (kind: 'ok' | 'err', text: string) => void }) {
  const notify = (msg: string, ok = true) => rawNotify(ok ? 'ok' : 'err', msg);
  const { user } = useAuth();
  const [sources, setSources] = useState<Source[]>([]);
  const [found, setFound] = useState<Found[] | null>(null);
  const [view, setView] = useState<'pending' | 'duplicate' | 'approved' | 'skipped'>('pending');
  const [checking, setChecking] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newSrc, setNewSrc] = useState({ name: '', url: '', kind: 'page' as Source['kind'] });
  const [categoryFor, setCategoryFor] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const [{ data: s }, { data: f }] = await Promise.all([
      supabase.from('event_sources').select('*').order('created_at'),
      supabase.from('imported_events').select('*').eq('status', view).gte('start_date', view === 'pending' || view === 'duplicate' ? new Date().toISOString() : '1970-01-01').order(view === 'pending' ? 'start_date' : 'found_at', { ascending: view === 'pending' }).limit(200),
    ]);
    setSources((s ?? []) as Source[]);
    setFound((f ?? []) as Found[]);
  }, [view]);
  useEffect(() => { load(); }, [load]);

  const sourceName = (id: string | null) => sources.find((s) => s.id === id)?.name ?? 'Source';

  async function checkNow(sourceId?: string) {
    setChecking(sourceId ?? 'all');
    const { data, error } = await supabase.functions.invoke('sync-event-sources', { body: sourceId ? { source_id: sourceId } : {} });
    setChecking(null);
    if (error) return notify("Couldn't check right now.", false);
    const added = ((data?.results ?? []) as { added: number }[]).reduce((n, r) => n + r.added, 0);
    notify(added ? `Found ${added} new event${added === 1 ? '' : 's'} to review.` : 'Checked. Nothing new this time.');
    load();
  }

  async function addSource() {
    if (!newSrc.name.trim() || (newSrc.kind !== 'ticketmaster' && !/^https?:\/\//i.test(newSrc.url.trim()))) return notify('Add a name and a full link (starting with https://).', false);
    const { error } = await supabase.from('event_sources').insert({ name: newSrc.name.trim(), url: newSrc.kind === 'ticketmaster' ? null : newSrc.url.trim(), kind: newSrc.kind });
    if (error) return notify("Couldn't add the source.", false);
    setAdding(false); setNewSrc({ name: '', url: '', kind: 'page' });
    notify('Source added. Tap Check now to look for events.');
    load();
  }

  async function approve(f: Found) {
    if (!user?.id || !user.email) return;
    setBusy(f.id);
    const src = sourceName(f.source_id);
    const link = f.ticket_url || f.event_url;
    const { data: ev, error } = await supabase.from('events').insert({
      title: f.title.slice(0, 200),
      description: [f.description, link ? `Details and tickets: ${link}` : null].filter(Boolean).join('\n\n') || null,
      category: categoryFor[f.id] || (f.category && CATEGORIES.includes(f.category) ? f.category : 'Other'),
      start_date: f.start_date, end_date: f.end_date,
      location_name: f.location_name, location_address: f.location_address,
      event_type: f.is_free ? 'free' : 'paid', ticket_price: f.is_free ? 0 : f.price ?? 0,
      external_ticket_url: link, poster_url: f.image_url, poster_credit: f.image_url ? f.image_credit : null,
      status: (f.issues ?? []).includes('time_missing') ? 'draft' : 'published', organizer_id: user.id, organizer_email: user.email,
      source_name: src, source_url: f.event_url || f.ticket_url,
    }).select('id').single();
    if (error || !ev) { setBusy(null); return notify("Couldn't publish it.", false); }
    await supabase.from('imported_events').update({ status: 'approved', event_id: ev.id, reviewed_at: new Date().toISOString() }).eq('id', f.id);
    setBusy(null);
    setFound((prev) => (prev ?? []).filter((x) => x.id !== f.id));
    if ((f.issues ?? []).includes('time_missing')) { notify(`Saved "${f.title}" as a draft. Add the time, then publish.`); window.open(`${import.meta.env.BASE_URL}organizer/events/${ev.id}/edit`, '_self'); return; }
    notify(`Published "${f.title}".`);
  }

  async function setStatus(f: Found, status: Found['status']) {
    setBusy(f.id);
    await supabase.from('imported_events').update({ status, reviewed_at: new Date().toISOString() }).eq('id', f.id);
    setBusy(null);
    setFound((prev) => (prev ?? []).filter((x) => x.id !== f.id));
  }

  const input = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900';
  return (
    <div className="mt-6 flex flex-col gap-6">
      <section className="rounded-2xl border border-gray-200 bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-bone">Event sources · Raleigh &amp; the Triangle</h2>
            <p className="mt-1 text-sm text-muted">Checked automatically every morning. New finds wait below for your approval; nothing is published on its own. Calendars that load in the browser are read through the data feed behind them when one exists.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setAdding((a) => !a)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700">+ Add source</button>
            <button onClick={() => checkNow()} disabled={!!checking} className="rounded-lg bg-marigold px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{checking === 'all' ? 'Checking…' : 'Check all now'}</button>
          </div>
        </div>
        {adding && (
          <div className="mt-3 grid gap-2 rounded-xl border border-gray-200 bg-white p-3 sm:grid-cols-[1fr_2fr_auto_auto]">
            <input className={input} placeholder="Name, e.g. Cary Arts Center" value={newSrc.name} onChange={(e) => setNewSrc({ ...newSrc, name: e.target.value })} />
            <input className={input} placeholder="https://… events page or .ics link" value={newSrc.url} disabled={newSrc.kind === 'ticketmaster'} onChange={(e) => setNewSrc({ ...newSrc, url: e.target.value })} />
            <select className={input} value={newSrc.kind} onChange={(e) => setNewSrc({ ...newSrc, kind: e.target.value as Source['kind'] })}>
              <option value="page">Web page</option><option value="ical">Calendar feed (.ics)</option>
            </select>
            <button onClick={addSource} className="rounded-lg bg-marigold px-3 py-2 text-sm font-semibold text-white">Add</button>
          </div>
        )}
        <ul className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
          {sources.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 p-3">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-gray-900">{s.name} <span className="font-normal text-gray-400">· {KIND_LABEL[s.kind]}</span></span>
                {s.url && <a href={s.url} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-marigold">{s.url}</a>}
                {s.feed_url && <span className="block truncate text-xs text-green-700">Reading its {s.feed_kind === 'wordpress' ? 'events feed' : s.feed_kind === 'ical' ? 'calendar feed' : 'RSS feed'} (found automatically)</span>}
                <span className={`block text-xs ${s.last_result?.startsWith('Problem') ? 'text-red-600' : 'text-gray-500'}`}>
                  {s.last_run_at ? `${new Date(s.last_run_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${s.last_result ?? ''}` : 'Not checked yet'}
                </span>
              </span>
              <button onClick={() => checkNow(s.id)} disabled={!!checking || !s.active} className="text-xs font-medium text-marigold disabled:opacity-40">{checking === s.id ? 'Checking…' : 'Check now'}</button>
              <label className="flex items-center gap-1.5 text-xs text-gray-600" title="Bring in this source's event photos (credited). Only turn on where you're comfortable using their images.">
                <input type="checkbox" checked={s.use_images} onChange={async (e) => { await supabase.from('event_sources').update({ use_images: e.target.checked }).eq('id', s.id); load(); }} className="h-4 w-4 accent-marigold" />
                Photos
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-600">
                <input type="checkbox" checked={s.active} onChange={async (e) => { await supabase.from('event_sources').update({ active: e.target.checked }).eq('id', s.id); load(); }} className="h-4 w-4 accent-marigold" />
                On
              </label>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button onClick={async () => {
            setChecking('photos');
            const { data, error } = await supabase.functions.invoke('sync-event-sources', { body: { backfill_photos: true } });
            setChecking(null);
            if (error) return notify("Couldn't get photos right now.", false);
            notify(data?.photos_added ? `Added photos to ${data.photos_added} published event${data.photos_added === 1 ? '' : 's'}.` : 'No new photos found for published events.');
          }} disabled={!!checking} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 disabled:opacity-50">
            {checking === 'photos' ? 'Getting photos…' : 'Add photos to published events'}
          </button>
          <span className="text-xs text-muted">Uses sources with <strong>Photos</strong> on. Each photo is credited (e.g. "Photo: Visit Raleigh"); events without one get a TapIN cover.</span>
        </div>
        <p className="mt-2 text-xs text-muted">Ticketmaster needs a free API key from developer.ticketmaster.com before it can be checked. Facebook and Instagram can't be used as sources.</p>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold text-bone">Found events</h2>
          <div className="flex gap-1 rounded-xl bg-gray-100 p-1 text-sm">
            {(['pending', 'duplicate', 'approved', 'skipped'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={`rounded-lg px-3 py-1.5 font-medium ${view === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                {v === 'pending' ? 'To review' : v === 'duplicate' ? 'Already listed' : v === 'approved' ? 'Published' : 'Skipped'}
              </button>
            ))}
          </div>
        </div>
        {view === 'pending' && <p className="mt-1 text-xs text-muted">Published events show "Listed from [source]," send people to the original page for tickets, and include a "Claim this event" link for the real organizer. Images aren't copied from other sites (except Ticketmaster).</p>}
        {found === null ? <p className="mt-3 text-sm text-muted">Loading…</p> : found.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-muted">{view === 'pending' ? 'Nothing waiting. New finds appear here after each morning’s check (or tap Check all now).' : 'Nothing here.'}</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {found.map((f) => (
              <li key={f.id} className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="flex gap-3">
                  {f.image_url && <img src={f.image_url} alt="" className="hidden h-16 w-24 shrink-0 rounded-lg object-cover sm:block" />}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900">{f.title}</p>
                    <p className="text-xs text-gray-500">{when(f.start_date)}{f.location_name ? ` · ${f.location_name}` : ''}{f.is_free ? ' · Free' : f.price ? ` · from $${Number(f.price).toFixed(2)}` : ''}</p>
                    <p className="text-xs text-gray-400">From {sourceName(f.source_id)}{f.event_url && <> · <a href={f.event_url} target="_blank" rel="noopener noreferrer" className="text-marigold">original page ↗</a></>}</p>
                    {f.description && <p className="mt-1 line-clamp-2 text-xs text-gray-600">{f.description}</p>}
                    {(f.issues ?? []).length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {f.issues.map((i) => <span key={i} className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">⚠ {ISSUE_LABEL[i] ?? i}</span>)}
                      </div>
                    )}
                    {f.status === 'duplicate' && f.duplicate_of && <Link to={`/events/${f.duplicate_of}`} className="mt-1 inline-block text-xs font-medium text-marigold">See the existing listing →</Link>}
                    {f.status === 'approved' && f.event_id && <Link to={`/events/${f.event_id}`} className="mt-1 inline-block text-xs font-medium text-marigold">View on TapIN →</Link>}
                  </div>
                </div>
                {(f.status === 'pending' || f.status === 'duplicate') && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <select value={categoryFor[f.id] ?? (f.category && CATEGORIES.includes(f.category) ? f.category : 'Other')} onChange={(e) => setCategoryFor({ ...categoryFor, [f.id]: e.target.value })}
                      aria-label="Category" className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700">
                      {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                    <button onClick={() => approve(f)} disabled={busy === f.id} className="rounded-lg bg-marigold px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{(f.issues ?? []).includes('time_missing') ? 'Approve & add time' : 'Approve & publish'}</button>
                    <button onClick={() => setStatus(f, 'skipped')} disabled={busy === f.id} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700">Skip</button>
                  </div>
                )}
                {f.status === 'skipped' && <button onClick={() => setStatus(f, 'pending')} className="mt-2 text-xs font-medium text-marigold">Move back to review</button>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
