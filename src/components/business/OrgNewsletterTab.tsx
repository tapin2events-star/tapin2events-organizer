import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Sheet from '../scouting/Sheet';
import { ListSkeleton } from '../ui/Skeleton';
import PremiumBadge from './PremiumBadge';

interface Counts { total: number; attendees: number; followers: number; imported: number; sendable: number; unsubscribed: number }
interface Person { email: string; name: string | null; sources: string[]; can_email: boolean }
interface Campaign { id: string; subject: string; body: string; event_id: string | null; event_title: string | null; promo_code: string | null; audience: string; status: 'draft' | 'sending' | 'sent' | 'failed'; mode: string | null; recipients: number; sent: number; error: string | null; created_at: string; sent_at: string | null; clicks: number; tickets: number }
const AUDIENCES = [{ id: 'all', label: 'Everyone' }, { id: 'attendees', label: 'Past attendees' }, { id: 'followers', label: 'Followers' }, { id: 'imported', label: 'Imported contacts' }] as const;
const SOURCE: Record<string, string> = { attendee: 'Attended', follower: 'Follows', imported: 'Imported' };
const field = 'mt-1 block w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900';
const errMsg = async (error: unknown, fallback: string) => {
  try { const j = await (error as { context?: Response })?.context?.json(); if (j?.error) return String(j.error); } catch { /* default */ }
  const m = (error as { message?: string })?.message; return m && !/function|permission|non-2xx/i.test(m) ? m : fallback;
};

// Very small CSV reader (handles quoted fields) for Eventbrite / spreadsheet exports.
function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cur = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}
function contactsFrom(text: string): { email: string; name: string }[] {
  const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const ei = head.findIndex((h) => h === 'email' || h === 'email address' || h === 'e-mail' || h.includes('email'));
  if (ei >= 0) {
    const fi = head.findIndex((h) => h === 'first name' || h === 'first_name' || h === 'firstname');
    const li = head.findIndex((h) => h === 'last name' || h === 'last_name' || h === 'lastname');
    const ni = head.findIndex((h) => h === 'name' || h === 'full name');
    return rows.slice(1).map((r) => ({ email: (r[ei] ?? '').trim(), name: (ni >= 0 ? r[ni] : [fi >= 0 ? r[fi] : '', li >= 0 ? r[li] : ''].join(' ')).trim() })).filter((c) => EMAIL.test(c.email));
  }
  // No header: pull every email-looking value (works for pasted lists too).
  return text.split(/[\s,;]+/).map((s) => s.trim().replace(/^<|>$/g, '')).filter((s) => EMAIL.test(s)).map((email) => ({ email, name: '' }));
}

// Organization > Newsletter (Preview, Owners/Admins): audience (attendees + followers + imported), import, and emails.
export default function OrgNewsletterTab({ orgId, orgName }: { orgId: string; orgName: string }) {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [showPeople, setShowPeople] = useState(false);
  const [q, setQ] = useState('');
  const [sheet, setSheet] = useState<null | 'import' | 'compose' | Campaign>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const flash = (ok: boolean, text: string) => { setMsg({ ok, text }); setTimeout(() => setMsg(null), 5000); };
  const load = useCallback(async () => {
    const [{ data: c }, { data: list }] = await Promise.all([
      supabase.rpc('org_audience_counts', { p_org_id: orgId }),
      supabase.rpc('org_campaigns_list', { p_org_id: orgId }),
    ]);
    setCounts((c ?? null) as Counts | null);
    setCampaigns(((list ?? []) as Campaign[]).map((x) => ({ ...x, clicks: Number(x.clicks), tickets: Number(x.tickets) })));
  }, [orgId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!showPeople) return;
    supabase.rpc('org_audience', { p_org_id: orgId, p_filter: 'all', p_query: null }).then(({ data }) => setPeople((data ?? []) as Person[]));
  }, [showPeople, orgId, counts?.total]);
  const shownPeople = useMemo(() => (people ?? []).filter((p) => !q.trim() || p.email.includes(q.trim().toLowerCase()) || (p.name ?? '').toLowerCase().includes(q.trim().toLowerCase())), [people, q]);

  async function remove(p: Person) {
    if (!window.confirm(`Remove ${p.email} from your imported contacts?`)) return;
    await supabase.rpc('remove_org_contact', { p_org_id: orgId, p_email: p.email });
    setPeople((list) => (list ?? []).filter((x) => x.email !== p.email || x.sources.length > 1)); load();
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-display text-lg font-bold text-bone">📧 Newsletter <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700">Preview</span> <PremiumBadge /></p>
          <p className="text-sm text-muted">Email your audience about upcoming events. Everyone gets an unsubscribe link, and we track clicks and ticket sales from each email.</p>
        </div>
        <button onClick={() => setSheet('compose')} disabled={!counts?.sendable} className="rounded-xl bg-marigold px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">+ New email</button>
      </div>
      {msg && <p role="status" className={`mt-3 rounded-xl px-3 py-2 text-sm ${msg.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{msg.text}</p>}

      {/* Audience */}
      <section className="mt-4 rounded-2xl border border-gray-200 bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold text-bone">Your audience</p>
          <div className="flex gap-2">
            <button onClick={() => setShowPeople(!showPeople)} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700">{showPeople ? 'Hide list' : 'See everyone'}</button>
            <button onClick={() => setSheet('import')} className="rounded-xl bg-[#0F1B3D] px-3 py-2 text-sm font-semibold text-white">Import contacts</button>
          </div>
        </div>
        {!counts ? <ListSkeleton rows={1} className="mt-3" /> : (
          <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            <div className="rounded-xl bg-white p-2"><p className="text-xl font-extrabold text-bone">{counts.sendable}</p><p className="text-[11px] text-muted">can be emailed</p></div>
            <div className="rounded-xl bg-white p-2"><p className="text-xl font-extrabold text-bone">{counts.attendees}</p><p className="text-[11px] text-muted">past attendees</p></div>
            <div className="rounded-xl bg-white p-2"><p className="text-xl font-extrabold text-bone">{counts.followers}</p><p className="text-[11px] text-muted">followers</p></div>
            <div className="rounded-xl bg-white p-2"><p className="text-xl font-extrabold text-bone">{counts.imported}</p><p className="text-[11px] text-muted">imported</p></div>
          </div>
        )}
        {counts && counts.unsubscribed > 0 && <p className="mt-2 text-xs text-muted">{counts.unsubscribed} unsubscribed (never emailed).</p>}
        {showPeople && (
          people === null ? <ListSkeleton rows={3} className="mt-3" /> : (
            <>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${people.length} people`} aria-label="Search audience" className="mt-3 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 sm:text-sm" />
              <ul className="mt-2 max-h-80 overflow-y-auto rounded-xl border border-gray-200 bg-white">
                {shownPeople.slice(0, 300).map((p) => (
                  <li key={p.email} className="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-2 text-sm last:border-0">
                    <span className="min-w-0"><span className="block truncate text-gray-900">{p.name || p.email}</span><span className="block truncate text-xs text-gray-500">{p.name ? `${p.email} · ` : ''}{p.sources.map((s) => SOURCE[s] ?? s).join(', ')}{!p.can_email ? ' · unsubscribed' : ''}</span></span>
                    {p.sources.includes('imported') && <button onClick={() => remove(p)} className="shrink-0 text-xs text-gray-400 hover:text-red-600">Remove</button>}
                  </li>
                ))}
              </ul>
            </>
          )
        )}
      </section>

      {/* Emails */}
      <section className="mt-6">
        <h3 className="font-display text-lg font-bold text-bone">Emails</h3>
        {campaigns === null ? <ListSkeleton rows={2} className="mt-3" /> : campaigns.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-muted">No emails yet. {counts?.sendable ? 'Tap "+ New email" to write your first one.' : 'Import contacts or wait for attendees and followers to build your list.'}</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {campaigns.map((c) => (
              <li key={c.id} className="rounded-2xl border border-gray-200 bg-surface p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-bone">{c.subject}</p>
                    <p className="text-xs text-muted">{c.status === 'draft' ? 'Draft' : c.status === 'sending' ? `Sending… ${c.sent} of ${c.recipients}` : `Sent ${c.sent_at ? new Date(c.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''} to ${c.sent}`}{c.event_title ? ` · ${c.event_title}` : ''}{c.promo_code ? ` · code ${c.promo_code}` : ''}</p>
                    {c.error && <p className="mt-1 text-xs text-red-600">Last attempt didn't go through. You can try again.</p>}
                  </div>
                  {c.status !== 'draft' && c.event_id && <p className="shrink-0 text-right text-sm"><span className="font-bold text-bone">{c.tickets} ticket{c.tickets === 1 ? '' : 's'}</span><span className="block text-xs text-muted">{c.clicks} click{c.clicks === 1 ? '' : 's'}</span></p>}
                </div>
                {c.status === 'draft' && <button onClick={() => setSheet(c)} className="mt-2 text-sm font-medium text-marigold">Edit & send ›</button>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {sheet === 'import' && <ImportSheet orgId={orgId} orgName={orgName} onClose={() => setSheet(null)} onDone={(n) => { setSheet(null); flash(true, `Imported ${n} contact${n === 1 ? '' : 's'}.`); setPeople(null); load(); }} />}
      {(sheet === 'compose' || (sheet && typeof sheet === 'object')) && (
        <ComposeSheet orgId={orgId} counts={counts} draft={typeof sheet === 'object' ? sheet : null} onClose={() => { setSheet(null); load(); }}
          onSent={(text) => { setSheet(null); flash(true, text); load(); }} onError={(text) => flash(false, text)} />
      )}
    </div>
  );
}

function ImportSheet({ orgId, orgName, onClose, onDone }: { orgId: string; orgName: string; onClose: () => void; onDone: (n: number) => void }) {
  const [text, setText] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const found = useMemo(() => contactsFrom(text), [text]);
  async function file(f: File | undefined) { if (f) setText(await f.text()); }
  async function save() {
    if (!found.length) return setErr('No email addresses found.');
    if (!consent) return setErr('Please confirm these people agreed to hear from you.');
    setBusy(true); setErr(null);
    let total = 0;
    for (let i = 0; i < found.length; i += 2000) {
      const { data, error } = await supabase.rpc('import_org_contacts', { p_org_id: orgId, p_rows: found.slice(i, i + 2000), p_consent: true });
      if (error) { setBusy(false); return setErr(await errMsg(error, "Couldn't import.")); }
      total += Number(data) || 0;
    }
    setBusy(false); onDone(total);
  }
  return (
    <Sheet title="Import contacts" onClose={onClose}>
      <p className="-mt-2 text-sm text-gray-600">Upload a CSV (like an Eventbrite attendee export) or paste email addresses. We'll pick up names when there's a Name or First/Last Name column.</p>
      <label className="mt-3 inline-flex min-h-[44px] cursor-pointer items-center rounded-xl border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700">
        📄 Choose a CSV file<input type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={(e) => file(e.target.files?.[0])} />
      </label>
      <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={'…or paste here:\nname@example.com, friend@example.com'} className={`${field} font-mono text-sm`} />
      <p className="mt-2 text-sm font-medium text-gray-900">{found.length} email address{found.length === 1 ? '' : 'es'} found</p>
      {found.length > 0 && <p className="text-xs text-gray-500">e.g. {found.slice(0, 3).map((c) => c.name ? `${c.name} <${c.email}>` : c.email).join(', ')}{found.length > 3 ? '…' : ''}</p>}
      <label className="mt-4 flex items-start gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-marigold" />
        <span>These people agreed to hear from <strong>{orgName}</strong> (for example, they bought tickets to our past events or signed up for our list). Every email includes an unsubscribe link.</span>
      </label>
      {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
      <button onClick={save} disabled={busy || !found.length} className="mt-4 w-full rounded-xl bg-marigold py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Importing…' : `Import ${found.length || ''} contact${found.length === 1 ? '' : 's'}`}</button>
    </Sheet>
  );
}

function ComposeSheet({ orgId, counts, draft, onClose, onSent, onError }: { orgId: string; counts: Counts | null; draft: Campaign | null; onClose: () => void; onSent: (t: string) => void; onError: (t: string) => void }) {
  const [subject, setSubject] = useState(draft?.subject ?? '');
  const [body, setBody] = useState(draft?.body ?? 'Hi {first name},\n\n');
  const [eventId, setEventId] = useState(draft?.event_id ?? '');
  const [promo, setPromo] = useState(draft?.promo_code ?? '');
  const [audience, setAudience] = useState<string>(draft?.audience ?? 'all');
  const [events, setEvents] = useState<{ id: string; title: string; start_date: string | null }[]>([]);
  const [codes, setCodes] = useState<string[]>([]);
  const [id, setId] = useState<string | null>(draft?.id ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    supabase.from('events').select('id, title, start_date').eq('organization_id', orgId).eq('status', 'published').gte('start_date', new Date().toISOString()).order('start_date')
      .then(({ data }) => setEvents((data ?? []) as typeof events));
  }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setCodes([]);
    if (!eventId) return;
    supabase.rpc('event_promo_codes', { p_event_id: eventId }).then(({ data }) => setCodes(((data ?? []) as { code: string; active: boolean }[]).filter((c) => c.active !== false).map((c) => c.code)));
  }, [eventId]);
  const audienceCount = counts ? (audience === 'attendees' ? counts.attendees : audience === 'followers' ? counts.followers : audience === 'imported' ? counts.imported : counts.sendable) : 0;

  async function saveDraft() {
    if (!subject.trim()) { setNote('Add a subject.'); return null; }
    if (!body.trim()) { setNote('Write a message.'); return null; }
    const { data, error } = await supabase.rpc('save_org_campaign', { p: { id, org_id: orgId, subject, body, event_id: eventId || null, promo_code: promo || null, audience } });
    if (error || !data) { setNote(await errMsg(error, "Couldn't save.")); return null; }
    setId(data as string); return data as string;
  }
  async function test() {
    setBusy('test'); setNote(null);
    const cid = await saveDraft();
    if (!cid) { setBusy(null); return; }
    const { data, error } = await supabase.functions.invoke('org-newsletter', { body: { action: 'test', campaign_id: cid } });
    setBusy(null);
    setNote(error ? await errMsg(error, "Couldn't send the test.") : `Test sent to ${data?.to}. Check your inbox.`);
  }
  async function send() {
    if (!window.confirm(`Send "${subject}" to about ${audienceCount} ${audienceCount === 1 ? 'person' : 'people'}? This can't be undone.`)) return;
    setBusy('send'); setNote(null);
    const cid = await saveDraft();
    if (!cid) { setBusy(null); return; }
    const { data, error } = await supabase.functions.invoke('org-newsletter', { body: { action: 'send', campaign_id: cid } });
    setBusy(null);
    if (error) { const m = await errMsg(error, "Sending didn't go through."); setNote(m); onError(m); return; }
    onSent(data?.mode === 'direct' && data?.remaining > 0
      ? `Sending to ${data.recipients} people: ${data.sent_now} sent now, the rest over the next day or two (daily limit).`
      : `Sent to ${data?.recipients ?? audienceCount} people! Clicks and ticket sales will show here.`);
  }
  return (
    <Sheet title={draft ? 'Edit email' : 'New email'} onClose={onClose}>
      <label className="block text-xs font-medium text-gray-500">Subject<input value={subject} maxLength={150} onChange={(e) => setSubject(e.target.value)} placeholder="Our next show is coming up!" className={field} autoFocus={!draft} /></label>
      <label className="mt-3 block text-xs font-medium text-gray-500">Message
        <textarea rows={7} maxLength={10000} value={body} onChange={(e) => setBody(e.target.value)} className={field} />
        <span className="mt-1 block font-normal text-gray-500">{'{first name}'} becomes each person's first name. Blank lines start new paragraphs; lines starting with "•" or "-" become a list.</span>
      </label>
      <label className="mt-3 block text-xs font-medium text-gray-500">Feature an event (optional)
        <select value={eventId} onChange={(e) => { setEventId(e.target.value); setPromo(''); }} className={field}>
          <option value="">No event</option>
          {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}{ev.start_date ? ` (${new Date(ev.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})` : ''}</option>)}
        </select>
        {eventId && <span className="mt-1 block font-normal text-gray-500">Adds an event card with a "Get tickets" button, tracked so you can see clicks and ticket sales from this email.</span>}
      </label>
      {eventId && (
        <label className="mt-3 block text-xs font-medium text-gray-500">Promo code (optional)
          <select value={promo} onChange={(e) => setPromo(e.target.value)} className={field}>
            <option value="">No code</option>
            {codes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {codes.length === 0 && <span className="mt-1 block font-normal text-gray-500">Create codes on the event's Tickets tab.</span>}
        </label>
      )}
      <p className="mt-3 text-xs font-medium text-gray-500">Send to</p>
      <div className="mt-1 grid grid-cols-2 gap-2">
        {AUDIENCES.map((a) => (
          <button key={a.id} type="button" onClick={() => setAudience(a.id)} aria-pressed={audience === a.id}
            className={`min-h-[44px] rounded-xl px-2 text-sm font-semibold ${audience === a.id ? 'bg-[#0F1B3D] text-white' : 'border border-gray-300 bg-white text-gray-800'}`}>
            {a.label}{counts ? ` (${a.id === 'attendees' ? counts.attendees : a.id === 'followers' ? counts.followers : a.id === 'imported' ? counts.imported : counts.sendable})` : ''}
          </button>
        ))}
      </div>
      <p className="mt-1 text-xs text-gray-500">People who unsubscribed are always skipped.</p>
      {note && <p role="status" className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-800">{note}</p>}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button onClick={test} disabled={!!busy} className="rounded-xl border border-gray-300 bg-white py-3 text-sm font-semibold text-gray-800 disabled:opacity-50">{busy === 'test' ? 'Sending…' : 'Send me a test'}</button>
        <button onClick={send} disabled={!!busy || audienceCount === 0} className="rounded-xl bg-marigold py-3 text-sm font-bold text-white disabled:opacity-50">{busy === 'send' ? 'Sending…' : `Send to ${audienceCount}`}</button>
      </div>
      <button onClick={async () => { const cid = await saveDraft(); if (cid) onClose(); }} disabled={!!busy} className="mt-2 w-full py-2 text-sm text-gray-500">Save draft</button>
    </Sheet>
  );
}
