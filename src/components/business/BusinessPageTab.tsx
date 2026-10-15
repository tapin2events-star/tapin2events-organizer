import { useCallback, useEffect, useState } from 'react';
import { SessionRosterSheet, SessionRulesCard } from './SessionSignups';
import { useFeature } from '../../lib/preview';
import { ListSkeleton } from '../ui/Skeleton';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import ImagePicker from './ImagePicker';
import Sheet from '../scouting/Sheet';
import { SESSION_KINDS, SPONSOR_TIERS, type Session, type Speaker, type Sponsor } from '../../lib/business';
import type { TapEvent } from '../../lib/types';

type Section = 'Agenda' | 'Speakers' | 'Sponsors' | 'FAQ & venue';
const toLocal = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso); const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);
const field = 'mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900';
const timeOf = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(':00 ', ' ') : '');

// Event dashboard > Business page: agenda, speakers, sponsors, FAQ and venue notes.
export default function BusinessPageTab({ event, onEventChange }: { event: TapEvent; onEventChange: (e: TapEvent) => void }) {
  const [section, setSection] = useState<Section>('Agenda');
  const workshopsOn = useFeature('workshops');
  const [rules, setRules] = useState({ r: (event as { sessions_require_ticket?: boolean }).sessions_require_ticket ?? true, o: (event as { sessions_allow_overlap?: boolean }).sessions_allow_overlap ?? false });
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [roster, setRoster] = useState<{ id: string; title: string; capacity: number | null } | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [links, setLinks] = useState<{ session_id: string; speaker_id: string }[]>([]);
  const [editSession, setEditSession] = useState<Session | 'new' | null>(null);
  const [editSpeaker, setEditSpeaker] = useState<Speaker | 'new' | null>(null);
  const [editSponsor, setEditSponsor] = useState<Sponsor | 'new' | null>(null);
  useEffect(() => {
    if (!workshopsOn) return;
    supabase.rpc('session_roster', { p_event_id: event.id }).then(({ data }) => {
      const m: Record<string, number> = {};
      for (const r of (data ?? []) as { session_id: string; status: string }[]) if (r.status === 'confirmed') m[r.session_id] = (m[r.session_id] ?? 0) + 1;
      setCounts(m);
    });
  }, [workshopsOn, event.id, sessions.length, roster]);

  const load = useCallback(async () => {
    const [a, b, c] = await Promise.all([
      supabase.from('event_sessions').select('*').eq('event_id', event.id).order('starts_at', { ascending: true, nullsFirst: false }).order('sort_order'),
      supabase.from('event_speakers').select('*').eq('event_id', event.id).order('featured', { ascending: false }).order('sort_order').order('created_at'),
      supabase.from('event_sponsors').select('*').eq('event_id', event.id).order('sort_order').order('created_at'),
    ]);
    const ss = (a.data ?? []) as Session[];
    setSessions(ss); setSpeakers((b.data ?? []) as Speaker[]); setSponsors((c.data ?? []) as Sponsor[]); setSessionsLoaded(true);
    if (ss.length) {
      const { data } = await supabase.from('session_speakers').select('session_id, speaker_id').in('session_id', ss.map((s) => s.id));
      setLinks((data ?? []) as { session_id: string; speaker_id: string }[]);
    } else setLinks([]);
  }, [event.id]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">Everything here appears on the event page, styled with your organization's brand. <Link to={`/events/${event.id}`} className="font-medium text-marigold">Preview page</Link></p>
      </div>
      <div className="mt-3 inline-flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1 text-sm">
        {(['Agenda', 'Speakers', 'Sponsors', 'FAQ & venue'] as Section[]).map((s) => (
          <button key={s} onClick={() => setSection(s)} className={`rounded-lg px-3.5 py-1.5 font-medium ${section === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
            {s}{s === 'Agenda' && sessions.length ? ` (${sessions.length})` : s === 'Speakers' && speakers.length ? ` (${speakers.length})` : s === 'Sponsors' && sponsors.length ? ` (${sponsors.length})` : ''}
          </button>
        ))}
      </div>

      {section === 'Agenda' && (
        <div className="mt-4">
          <button onClick={() => setEditSession('new')} className="rounded-xl bg-[#0F1B3D] px-4 py-2.5 text-sm font-bold text-white">+ Add session</button>
          {workshopsOn && <SessionRulesCard eventId={event.id} requiresTicket={rules.r} allowOverlap={rules.o} onChange={(r, o) => setRules({ r, o })} />}
          {sessions.length === 0 ? !sessionsLoaded ? <ListSkeleton rows={2} className="mt-3" /> : <p className="mt-4 text-sm text-muted">No sessions yet. Add keynotes, panels, workshops, breaks and networking.</p> : (
            <ul className="mt-4 flex flex-col gap-2">
              {sessions.map((s) => {
                const who = links.filter((l) => l.session_id === s.id).map((l) => speakers.find((k) => k.id === l.speaker_id)?.name).filter(Boolean);
                return (
                  <li key={s.id} className="flex flex-col gap-1"><button onClick={() => setEditSession(s)} className="flex w-full items-start gap-3 rounded-xl border border-gray-200 bg-surface p-3 text-left hover:border-[#C9A227]">
                    <span className="w-20 shrink-0 text-xs font-semibold text-muted">{timeOf(s.starts_at) || 'TBA'}{s.ends_at ? `–${timeOf(s.ends_at)}` : ''}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-bone">{s.title}</span>
                      <span className="block text-xs text-muted">{SESSION_KINDS.find((k) => k.key === s.kind)?.label}{s.room ? ` · ${s.room}` : ''}{s.track ? ` · ${s.track}` : ''}{s.capacity ? ` · ${s.capacity} seats` : ''}{who.length ? ` · ${who.join(', ')}` : ''}</span>
                    </span>
                  </button>
                  {workshopsOn && (s as { signup_required?: boolean }).signup_required && (
                    <button onClick={() => setRoster({ id: s.id, title: s.title, capacity: s.capacity ?? null })} className="ml-auto text-xs font-medium text-indigo-700">📋 {counts[s.id] ?? 0}{s.capacity ? ` / ${s.capacity}` : ''} signed up · View list ›</button>
                  )}</li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {section === 'Speakers' && (
        <div className="mt-4">
          <button onClick={() => setEditSpeaker('new')} className="rounded-xl bg-[#0F1B3D] px-4 py-2.5 text-sm font-bold text-white">+ Add speaker</button>
          {speakers.length === 0 ? !sessionsLoaded ? <ListSkeleton rows={2} className="mt-3" /> : <p className="mt-4 text-sm text-muted">No speakers yet.</p> : (
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {speakers.map((k) => (
                <li key={k.id}><button onClick={() => setEditSpeaker(k)} className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-surface p-3 text-left hover:border-[#C9A227]">
                  {k.photo_url ? <img src={k.photo_url} alt="" className="h-12 w-12 rounded-full object-cover" /> : <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 font-bold text-gray-600">{k.name.charAt(0)}</span>}
                  <span className="min-w-0"><span className="block truncate text-sm font-semibold text-bone">{k.name}{k.featured ? ' ★' : ''}</span><span className="block truncate text-xs text-muted">{[k.title, k.company].filter(Boolean).join(', ')}</span></span>
                </button></li>
              ))}
            </ul>
          )}
        </div>
      )}

      {section === 'Sponsors' && (
        <div className="mt-4">
          <button onClick={() => setEditSponsor('new')} className="rounded-xl bg-[#0F1B3D] px-4 py-2.5 text-sm font-bold text-white">+ Add sponsor</button>
          {sponsors.length === 0 ? !sessionsLoaded ? <ListSkeleton rows={2} className="mt-3" /> : <p className="mt-4 text-sm text-muted">No sponsors yet.</p> : (
            <div className="mt-4 flex flex-col gap-4">
              {SPONSOR_TIERS.filter((t) => sponsors.some((s) => s.tier === t)).concat(sponsors.filter((s) => !SPONSOR_TIERS.includes(s.tier)).map((s) => s.tier).filter((v, i, a) => a.indexOf(v) === i)).map((tier) => (
                <div key={tier}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">{tier}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {sponsors.filter((s) => s.tier === tier).map((s) => (
                      <button key={s.id} onClick={() => setEditSponsor(s)} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 hover:border-[#C9A227]">
                        {s.logo_url ? <img src={s.logo_url} alt="" className="h-8 w-14 object-contain" /> : null}
                        <span className="text-sm font-medium text-gray-900">{s.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {section === 'FAQ & venue' && <FaqVenue event={event} onEventChange={onEventChange} />}

      {roster && <SessionRosterSheet eventId={event.id} eventTitle={event.title} session={roster} onClose={() => setRoster(null)} />}
      {editSession && <SessionSheet signupsOn={workshopsOn} eventId={event.id} session={editSession === 'new' ? null : editSession} speakers={speakers} links={links} defaultStart={event.start_date} onClose={() => setEditSession(null)} onSaved={load} />}
      {editSpeaker && <SpeakerSheet eventId={event.id} speaker={editSpeaker === 'new' ? null : editSpeaker} onClose={() => setEditSpeaker(null)} onSaved={load} />}
      {editSponsor && <SponsorSheet eventId={event.id} sponsor={editSponsor === 'new' ? null : editSponsor} onClose={() => setEditSponsor(null)} onSaved={load} />}
    </div>
  );
}

function SessionSheet({ signupsOn = false, eventId, session, speakers, links, defaultStart, onClose, onSaved }: { signupsOn?: boolean; eventId: string; session: Session | null; speakers: Speaker[]; links: { session_id: string; speaker_id: string }[]; defaultStart: string | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ title: session?.title ?? '', kind: session?.kind ?? 'session', starts_at: toLocal(session?.starts_at ?? defaultStart), ends_at: toLocal(session?.ends_at ?? null), room: session?.room ?? '', track: session?.track ?? '', capacity: session?.capacity ? String(session.capacity) : '', description: session?.description ?? '' });
  const [signup, setSignup] = useState<boolean>(!!(session as { signup_required?: boolean } | null)?.signup_required);
  const [who, setWho] = useState<string[]>(session ? links.filter((l) => l.session_id === session.id).map((l) => l.speaker_id) : []);
  const [err, setErr] = useState<string | null>(null);
  async function save() {
    if (!f.title.trim()) return setErr('Give the session a title.');
    if (f.starts_at && f.ends_at && f.ends_at <= f.starts_at) return setErr('The end time must be after the start time.');
    const row = { event_id: eventId, title: f.title.trim(), kind: f.kind, starts_at: fromLocal(f.starts_at), ends_at: fromLocal(f.ends_at), room: f.room.trim() || null, track: f.track.trim() || null, capacity: f.capacity ? Math.max(1, parseInt(f.capacity, 10) || 0) || null : null, description: f.description.trim() || null, ...(signupsOn ? { signup_required: signup } : {}) };
    const res = session ? await supabase.from('event_sessions').update(row).eq('id', session.id).select('id').single() : await supabase.from('event_sessions').insert(row).select('id').single();
    if (res.error || !res.data) return setErr("Couldn't save the session.");
    const sid = res.data.id as string;
    await supabase.from('session_speakers').delete().eq('session_id', sid);
    if (who.length) await supabase.from('session_speakers').insert(who.map((speaker_id) => ({ session_id: sid, speaker_id })));
    onSaved(); onClose();
  }
  return (
    <Sheet title={session ? 'Edit session' : 'Add a session'} onClose={onClose} wide>
      <label className="block text-xs font-medium text-gray-500">Title<input className={field} value={f.title} maxLength={200} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Opening keynote" autoFocus /></label>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="text-xs font-medium text-gray-500">Type<select className={field} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{SESSION_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}</select></label>
        <label className="text-xs font-medium text-gray-500">Seats (optional)<input className={field} inputMode="numeric" value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value.replace(/\D/g, '') })} placeholder="No limit" /></label>
        <label className="text-xs font-medium text-gray-500">Starts<input type="datetime-local" className={field} value={f.starts_at} onChange={(e) => setF({ ...f, starts_at: e.target.value })} /></label>
        <label className="text-xs font-medium text-gray-500">Ends<input type="datetime-local" className={field} value={f.ends_at} onChange={(e) => setF({ ...f, ends_at: e.target.value })} /></label>
        <label className="text-xs font-medium text-gray-500">Room<input className={field} value={f.room} maxLength={100} onChange={(e) => setF({ ...f, room: e.target.value })} placeholder="Main hall" /></label>
        <label className="text-xs font-medium text-gray-500">Track<input className={field} value={f.track} maxLength={100} onChange={(e) => setF({ ...f, track: e.target.value })} placeholder="Leadership" /></label>
      </div>
      {signupsOn && (
        <label className="mt-3 flex items-start gap-3 rounded-xl bg-indigo-50 p-3 text-sm text-gray-800">
          <input type="checkbox" checked={signup} onChange={(e) => setSignup(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-marigold" />
          <span><strong>People sign up for this session</strong><span className="block text-xs text-gray-600">For workshops and limited-seat sessions. Uses the Seats number above (leave it blank for no limit); a waitlist opens when it's full.</span></span>
        </label>
      )}
      <label className="mt-3 block text-xs font-medium text-gray-500">Description<textarea rows={3} className={field} value={f.description} maxLength={3000} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
      {speakers.length > 0 && (
        <div className="mt-3 text-xs font-medium text-gray-500">Speakers
          <div className="mt-1 flex flex-wrap gap-2">
            {speakers.map((k) => (
              <button type="button" key={k.id} onClick={() => setWho(who.includes(k.id) ? who.filter((x) => x !== k.id) : [...who, k.id])}
                className={`rounded-full px-3 py-1.5 text-sm ${who.includes(k.id) ? 'bg-[#0F1B3D] text-white' : 'border border-gray-300 bg-white text-gray-700'}`}>{k.name}</button>
            ))}
          </div>
        </div>
      )}
      {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
      <div className="mt-5 flex items-center justify-between">
        {session ? <button onClick={async () => { await supabase.from('event_sessions').delete().eq('id', session.id); onSaved(); onClose(); }} className="text-sm text-gray-400 hover:text-red-600">Delete</button> : <span />}
        <button onClick={save} className="rounded-xl bg-[#0F1B3D] px-5 py-2.5 text-sm font-bold text-white">Save</button>
      </div>
    </Sheet>
  );
}

function SpeakerSheet({ eventId, speaker, onClose, onSaved }: { eventId: string; speaker: Speaker | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: speaker?.name ?? '', title: speaker?.title ?? '', company: speaker?.company ?? '', bio: speaker?.bio ?? '', link: speaker?.link ?? '', featured: speaker?.featured ?? false, photo_url: speaker?.photo_url ?? null as string | null });
  const [err, setErr] = useState<string | null>(null);
  async function save() {
    if (!f.name.trim()) return setErr('Add the speaker\u2019s name.');
    const row = { event_id: eventId, name: f.name.trim(), title: f.title.trim() || null, company: f.company.trim() || null, bio: f.bio.trim() || null, link: f.link.trim() || null, featured: f.featured, photo_url: f.photo_url };
    const { error } = speaker ? await supabase.from('event_speakers').update(row).eq('id', speaker.id) : await supabase.from('event_speakers').insert(row);
    if (error) return setErr("Couldn't save the speaker.");
    onSaved(); onClose();
  }
  return (
    <Sheet title={speaker ? 'Edit speaker' : 'Add a speaker'} onClose={onClose} wide>
      <ImagePicker label="Photo" shape="round" value={f.photo_url} onChange={(url) => setF({ ...f, photo_url: url })} />
      <label className="mt-3 block text-xs font-medium text-gray-500">Name<input className={field} value={f.name} maxLength={120} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus /></label>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="text-xs font-medium text-gray-500">Title<input className={field} value={f.title} maxLength={120} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Chief Executive Officer" /></label>
        <label className="text-xs font-medium text-gray-500">Company<input className={field} value={f.company} maxLength={120} onChange={(e) => setF({ ...f, company: e.target.value })} /></label>
      </div>
      <label className="mt-3 block text-xs font-medium text-gray-500">Bio<textarea rows={4} className={field} value={f.bio} maxLength={2000} onChange={(e) => setF({ ...f, bio: e.target.value })} /></label>
      <label className="mt-3 block text-xs font-medium text-gray-500">Link (LinkedIn or website)<input className={field} value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} inputMode="url" placeholder="https://" /></label>
      <label className="mt-3 flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={f.featured} onChange={(e) => setF({ ...f, featured: e.target.checked })} className="h-4 w-4 accent-marigold" /> Featured speaker (shown first, larger)</label>
      {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
      <div className="mt-5 flex items-center justify-between">
        {speaker ? <button onClick={async () => { await supabase.from('event_speakers').delete().eq('id', speaker.id); onSaved(); onClose(); }} className="text-sm text-gray-400 hover:text-red-600">Delete</button> : <span />}
        <button onClick={save} className="rounded-xl bg-[#0F1B3D] px-5 py-2.5 text-sm font-bold text-white">Save</button>
      </div>
    </Sheet>
  );
}

function SponsorSheet({ eventId, sponsor, onClose, onSaved }: { eventId: string; sponsor: Sponsor | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: sponsor?.name ?? '', tier: sponsor?.tier ?? 'Gold', website: sponsor?.website ?? '', logo_url: sponsor?.logo_url ?? null as string | null });
  const [err, setErr] = useState<string | null>(null);
  async function save() {
    if (!f.name.trim()) return setErr('Add the sponsor\u2019s name.');
    const row = { event_id: eventId, name: f.name.trim(), tier: f.tier, website: f.website.trim() || null, logo_url: f.logo_url };
    const { error } = sponsor ? await supabase.from('event_sponsors').update(row).eq('id', sponsor.id) : await supabase.from('event_sponsors').insert(row);
    if (error) return setErr("Couldn't save the sponsor.");
    onSaved(); onClose();
  }
  return (
    <Sheet title={sponsor ? 'Edit sponsor' : 'Add a sponsor'} onClose={onClose}>
      <ImagePicker label="Logo" value={f.logo_url} onChange={(url) => setF({ ...f, logo_url: url })} hint="Transparent PNG or SVG looks best" />
      <label className="mt-3 block text-xs font-medium text-gray-500">Name<input className={field} value={f.name} maxLength={120} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus /></label>
      <label className="mt-3 block text-xs font-medium text-gray-500">Tier<select className={field} value={f.tier} onChange={(e) => setF({ ...f, tier: e.target.value })}>{SPONSOR_TIERS.map((t) => <option key={t}>{t}</option>)}</select></label>
      <label className="mt-3 block text-xs font-medium text-gray-500">Website<input className={field} value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} inputMode="url" placeholder="https://" /></label>
      {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
      <div className="mt-5 flex items-center justify-between">
        {sponsor ? <button onClick={async () => { await supabase.from('event_sponsors').delete().eq('id', sponsor.id); onSaved(); onClose(); }} className="text-sm text-gray-400 hover:text-red-600">Delete</button> : <span />}
        <button onClick={save} className="rounded-xl bg-[#0F1B3D] px-5 py-2.5 text-sm font-bold text-white">Save</button>
      </div>
    </Sheet>
  );
}

function FaqVenue({ event, onEventChange }: { event: TapEvent; onEventChange: (e: TapEvent) => void }) {
  const bp = event.business_page ?? {};
  const [faq, setFaq] = useState<{ q: string; a: string }[]>(bp.faq ?? []);
  const [venue, setVenue] = useState(bp.venue_notes ?? '');
  const [msg, setMsg] = useState<string | null>(null);
  async function save() {
    const next = { ...bp, faq: faq.filter((x) => x.q.trim()).map((x) => ({ q: x.q.trim().slice(0, 200), a: x.a.trim().slice(0, 1500) })), venue_notes: venue.trim().slice(0, 2000) };
    const { error } = await supabase.from('events').update({ business_page: next }).eq('id', event.id);
    if (error) return setMsg("Couldn't save.");
    onEventChange({ ...event, business_page: next });
    setMsg('Saved.'); window.setTimeout(() => setMsg(null), 2000);
  }
  return (
    <div className="mt-4 flex flex-col gap-4">
      <label className="text-xs font-medium text-gray-500">Venue, parking & access notes
        <textarea rows={3} className={field} value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Parking in the deck on Main St (validated). Doors open at 8 AM. Elevator access at the north entrance." />
      </label>
      <div>
        <p className="text-xs font-medium text-gray-500">Frequently asked questions</p>
        <div className="mt-1 flex flex-col gap-2">
          {faq.map((x, i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-3">
              <input value={x.q} onChange={(e) => setFaq(faq.map((y, j) => (j === i ? { ...y, q: e.target.value } : y)))} placeholder="Question" className="w-full text-sm font-semibold text-gray-900 outline-none" />
              <textarea value={x.a} onChange={(e) => setFaq(faq.map((y, j) => (j === i ? { ...y, a: e.target.value } : y)))} rows={2} placeholder="Answer" className="mt-1 w-full text-sm text-gray-700 outline-none" />
              <button onClick={() => setFaq(faq.filter((_, j) => j !== i))} className="text-xs text-gray-400 hover:text-red-600">Remove</button>
            </div>
          ))}
          <button onClick={() => setFaq([...faq, { q: '', a: '' }])} className="self-start text-sm font-medium text-marigold">+ Add a question</button>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={save} className="rounded-xl bg-[#0F1B3D] px-5 py-2.5 text-sm font-bold text-white">Save</button>
        {msg && <span className="text-sm text-green-700">{msg}</span>}
      </div>
    </div>
  );
}
