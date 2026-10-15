import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { SESSION_KINDS, SPONSOR_TIERS, type Session, type Speaker, type Sponsor } from '../../lib/business';
import type { TapEvent } from '../../lib/types';
import { SessionRulesCard } from './SessionSignups';
import PremiumBadge from './PremiumBadge';

export interface SessionPreset { kind: string; signup?: boolean; title?: string }
const KIND_COLOR: Record<string, string> = { keynote: '#4F46E5', session: '#0EA5E9', panel: '#8B5CF6', workshop: '#10B981', networking: '#F59E0B', break: '#9CA3AF', meal: '#9CA3AF', other: '#64748B' };
const timeOf = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '');
const dayOf = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) : 'Time to be announced');

// One-tap starter schedules (minutes from the event's start).
const STARTERS: { key: string; label: string; desc: string; items: { title: string; kind: string; start: number; mins: number; signup?: boolean; room?: string }[] }[] = [
  { key: 'conference', label: 'Conference day', desc: 'Keynotes, a panel, parallel workshops, lunch and a reception', items: [
    { title: 'Registration & coffee', kind: 'networking', start: -30, mins: 30 },
    { title: 'Opening keynote', kind: 'keynote', start: 0, mins: 60, room: 'Main hall' },
    { title: 'Panel discussion', kind: 'panel', start: 70, mins: 60, room: 'Main hall' },
    { title: 'Break', kind: 'break', start: 130, mins: 15 },
    { title: 'Workshop A', kind: 'workshop', start: 145, mins: 60, signup: true, room: 'Room A' },
    { title: 'Workshop B', kind: 'workshop', start: 145, mins: 60, signup: true, room: 'Room B' },
    { title: 'Lunch', kind: 'meal', start: 205, mins: 60 },
    { title: 'Afternoon session', kind: 'session', start: 265, mins: 45, room: 'Main hall' },
    { title: 'Closing keynote', kind: 'keynote', start: 320, mins: 45, room: 'Main hall' },
    { title: 'Networking reception', kind: 'networking', start: 365, mins: 60 },
  ] },
  { key: 'workshop', label: 'Half-day workshop', desc: 'Two hands-on parts with a break and Q&A', items: [
    { title: 'Welcome & introductions', kind: 'session', start: 0, mins: 15 },
    { title: 'Workshop, part 1', kind: 'workshop', start: 15, mins: 75 },
    { title: 'Break', kind: 'break', start: 90, mins: 15 },
    { title: 'Workshop, part 2', kind: 'workshop', start: 105, mins: 75 },
    { title: 'Q&A and wrap-up', kind: 'session', start: 180, mins: 30 },
  ] },
  { key: 'gala', label: 'Gala evening', desc: 'Reception, dinner, program, paddle raise and dancing', items: [
    { title: 'Cocktail reception', kind: 'networking', start: 0, mins: 60 },
    { title: 'Welcome & opening remarks', kind: 'keynote', start: 60, mins: 15 },
    { title: 'Dinner', kind: 'meal', start: 75, mins: 75 },
    { title: 'Program & honorees', kind: 'session', start: 150, mins: 30 },
    { title: 'Paddle raise', kind: 'other', start: 180, mins: 30 },
    { title: 'Dancing & celebration', kind: 'networking', start: 210, mins: 90 },
  ] },
];

// Event dashboard > Program (Preview): the event's agenda, speakers, sponsors and FAQ on one page.
export default function ProgramLayout(p: {
  event: TapEvent; sessions: Session[]; speakers: Speaker[]; sponsors: Sponsor[]; links: { session_id: string; speaker_id: string }[];
  loaded: boolean; counts: Record<string, number>; workshopsOn: boolean; rules: { r: boolean; o: boolean }; setRules: (r: { r: boolean; o: boolean }) => void;
  onSession: (s: Session | 'new', preset?: SessionPreset) => void; onSpeaker: (s: Speaker | 'new') => void; onSponsor: (s: Sponsor | 'new') => void;
  onRoster: (s: { id: string; title: string; capacity: number | null }) => void; reload: () => void; faqSlot: ReactNode;
}) {
  const { event, sessions, speakers, sponsors, links } = p;
  const [busy, setBusy] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const faqCount = (event.business_page?.faq ?? []).length + (event.business_page?.venue_notes ? 1 : 0);
  const signupSessions = sessions.filter((s) => (s as { signup_required?: boolean }).signup_required);
  const days = Object.entries(sessions.reduce<Record<string, Session[]>>((acc, s) => { (acc[dayOf(s.starts_at)] ??= []).push(s); return acc; }, {}));
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  async function applyStarter(key: string) {
    const st = STARTERS.find((x) => x.key === key)!;
    const base = event.start_date ? new Date(event.start_date) : (() => { const d = new Date(); d.setHours(9, 0, 0, 0); return d; })();
    setBusy(key);
    await supabase.from('event_sessions').insert(st.items.map((it, i) => ({
      event_id: event.id, title: it.title, kind: it.kind, room: it.room ?? null, sort_order: i,
      starts_at: new Date(base.getTime() + it.start * 60000).toISOString(), ends_at: new Date(base.getTime() + (it.start + it.mins) * 60000).toISOString(),
      ...(p.workshopsOn && it.signup ? { signup_required: true, capacity: 30 } : {}),
    })));
    setBusy(null); p.reload();
  }
  async function duplicate(s: Session) {
    setBusy(s.id);
    const { id: _id, created_at: _c, ...rest } = s as Session & { created_at?: string };
    void _id; void _c;
    const { data } = await supabase.from('event_sessions').insert({ ...rest, title: `${s.title} (copy)` }).select('id').single();
    const who = links.filter((l) => l.session_id === s.id);
    if (data && who.length) await supabase.from('session_speakers').insert(who.map((l) => ({ session_id: data.id, speaker_id: l.speaker_id })));
    setBusy(null); p.reload();
  }

  const Check = ({ id, label, count, done }: { id: string; label: string; count: number; done: boolean }) => (
    <button onClick={() => jump(id)} className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${done ? 'bg-green-100 text-green-800' : 'border border-gray-200 bg-white text-gray-600'}`}>
      {done ? '✓' : '○'} {label}{count ? ` · ${count}` : ''}
    </button>
  );

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-display text-lg font-bold text-bone">Program <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700">Preview</span></p>
          <p className="text-sm text-muted">Your agenda, speakers, sponsors and FAQ. Everything here shows on the event page in your brand.</p>
        </div>
        <Link to={`/events/${event.id}#agenda`} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700">Preview page ›</Link>
      </div>

      {/* Checklist doubles as section shortcuts */}
      <div className="sticky top-[calc(4rem+env(safe-area-inset-top,0px))] z-10 -mx-4 mt-3 flex gap-1.5 overflow-x-auto bg-[var(--color-ink,transparent)] px-4 py-2 backdrop-blur md:top-0">
        <Check id="program-agenda" label="Agenda" count={sessions.length} done={sessions.length > 0} />
        <Check id="program-speakers" label="Speakers" count={speakers.length} done={speakers.length > 0} />
        <Check id="program-sponsors" label="Sponsors" count={sponsors.length} done={sponsors.length > 0} />
        <Check id="program-faq" label="FAQ & venue" count={faqCount} done={faqCount > 0} />
      </div>

      {/* Agenda */}
      <section id="program-agenda" className="mt-4 scroll-mt-28">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-lg font-bold text-bone">Agenda</h3>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => p.onSession('new', { kind: 'session' })} className="rounded-xl bg-[#0F1B3D] px-3 py-2 text-sm font-semibold text-white">+ Session</button>
            {p.workshopsOn && <button onClick={() => p.onSession('new', { kind: 'workshop', signup: true })} className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">+ Workshop</button>}
            <button onClick={() => p.onSession('new', { kind: 'break', title: 'Break' })} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700">+ Break</button>
          </div>
        </div>

        {p.workshopsOn && signupSessions.length > 0 && (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm">
            <button onClick={() => setShowRules(!showRules)} className="flex w-full flex-wrap items-center justify-between gap-2 text-left">
              <span className="flex flex-wrap items-center gap-2 text-emerald-900">📋 Sign-up rules: {p.rules.r ? 'ticket holders only' : 'anyone signed in'} · {p.rules.o ? 'overlaps allowed' : 'no overlapping sessions'} <PremiumBadge note={false} /></span>
              <span className="text-xs font-semibold text-emerald-800">{showRules ? 'Done' : 'Change'}</span>
            </button>
            {showRules && <SessionRulesCard eventId={event.id} requiresTicket={p.rules.r} allowOverlap={p.rules.o} onChange={(r, o) => p.setRules({ r, o })} />}
          </div>
        )}

        {!p.loaded ? <div className="mt-3 h-32 animate-pulse rounded-2xl bg-gray-100" /> : sessions.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-gray-300 p-4">
            <p className="text-sm font-semibold text-bone">Start from a sample schedule</p>
            <p className="text-xs text-muted">Fills in times from your event's start. Rename, move or delete anything after.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {STARTERS.map((st) => (
                <button key={st.key} onClick={() => applyStarter(st.key)} disabled={!!busy} className="rounded-xl border border-gray-200 bg-white p-3 text-left hover:border-marigold disabled:opacity-50">
                  <span className="block text-sm font-semibold text-gray-900">{busy === st.key ? 'Adding…' : st.label}</span>
                  <span className="block text-xs text-gray-500">{st.desc}</span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">Or add sessions one at a time with the buttons above.</p>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-5">
            {days.map(([day, list]) => (
              <div key={day}>
                {days.length > 1 && <p className="mb-2 text-sm font-semibold text-bone">{day}</p>}
                <ol className="relative flex flex-col gap-2 border-l-2 border-gray-200 pl-4">
                  {list.map((s) => {
                    const who = links.filter((l) => l.session_id === s.id).map((l) => speakers.find((k) => k.id === l.speaker_id)?.name).filter(Boolean);
                    const color = KIND_COLOR[s.kind] ?? '#64748B';
                    const isBreak = s.kind === 'break' || s.kind === 'meal';
                    const signup = p.workshopsOn && (s as { signup_required?: boolean }).signup_required;
                    return (
                      <li key={s.id} className="relative">
                        <span className="absolute -left-[23px] top-4 h-3 w-3 rounded-full border-2 border-white" style={{ background: color }} aria-hidden="true" />
                        <div className={`flex items-stretch gap-3 rounded-xl border ${isBreak ? 'border-dashed border-gray-200 bg-gray-50' : 'border-gray-200 bg-surface'}`}>
                          <button onClick={() => p.onSession(s)} className="flex min-w-0 flex-1 items-start gap-3 p-3 text-left">
                            <span className="w-16 shrink-0 text-xs font-semibold text-bone">{timeOf(s.starts_at) || 'TBA'}{s.ends_at && <span className="block font-normal text-muted">{timeOf(s.ends_at)}</span>}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[10px] font-bold uppercase tracking-wide" style={{ color }}>{SESSION_KINDS.find((k) => k.key === s.kind)?.label}{s.track ? ` · ${s.track}` : ''}</span>
                              <span className="block text-sm font-semibold text-bone">{s.title}</span>
                              {(s.room || who.length > 0) && <span className="block truncate text-xs text-muted">{[s.room, who.join(', ')].filter(Boolean).join(' · ')}</span>}
                            </span>
                          </button>
                          <div className="flex shrink-0 flex-col items-end justify-between gap-1 p-2">
                            {signup ? (
                              <button onClick={() => p.onRoster({ id: s.id, title: s.title, capacity: s.capacity ?? null })} className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">📋 {p.counts[s.id] ?? 0}{s.capacity ? `/${s.capacity}` : ''}</button>
                            ) : s.capacity ? <span className="text-[11px] text-muted">{s.capacity} seats</span> : <span />}
                            <button onClick={() => duplicate(s)} disabled={busy === s.id} className="text-[11px] font-medium text-gray-400 hover:text-gray-700">{busy === s.id ? '…' : 'Duplicate'}</button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Speakers */}
      <section id="program-speakers" className="mt-8 scroll-mt-28">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-lg font-bold text-bone">Speakers</h3>
          <button onClick={() => p.onSpeaker('new')} className="rounded-xl bg-[#0F1B3D] px-3 py-2 text-sm font-semibold text-white">+ Speaker</button>
        </div>
        {speakers.length === 0 ? <p className="mt-2 text-sm text-muted">No speakers yet. Add them here, then tag them on sessions.{event.organization_id ? ' You can pick people from your organization\u2019s People section.' : ''}</p> : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {speakers.map((k) => (
              <li key={k.id}><button onClick={() => p.onSpeaker(k)} className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-surface p-3 text-left hover:border-[#C9A227]">
                {k.photo_url ? <img src={k.photo_url} alt="" className="h-12 w-12 rounded-full object-cover" /> : <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 font-bold text-gray-600">{k.name.charAt(0)}</span>}
                <span className="min-w-0"><span className="block truncate text-sm font-semibold text-bone">{k.name}{k.featured ? ' ★' : ''}</span><span className="block truncate text-xs text-muted">{[k.title, k.company].filter(Boolean).join(', ')}</span>
                  <span className="block text-[11px] text-muted">{links.filter((l) => l.speaker_id === k.id).length || 'No'} session{links.filter((l) => l.speaker_id === k.id).length === 1 ? '' : 's'}</span></span>
              </button></li>
            ))}
          </ul>
        )}
      </section>

      {/* Sponsors */}
      <section id="program-sponsors" className="mt-8 scroll-mt-28">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-lg font-bold text-bone">Sponsors</h3>
          <button onClick={() => p.onSponsor('new')} className="rounded-xl bg-[#0F1B3D] px-3 py-2 text-sm font-semibold text-white">+ Sponsor</button>
        </div>
        {sponsors.length === 0 ? <p className="mt-2 text-sm text-muted">No sponsors yet. Add logos by tier (Presenting, Gold, Community partner…).</p> : (
          <div className="mt-3 flex flex-col gap-3">
            {SPONSOR_TIERS.filter((t) => sponsors.some((s) => s.tier === t)).concat(sponsors.filter((s) => !SPONSOR_TIERS.includes(s.tier)).map((s) => s.tier).filter((v, i, a) => a.indexOf(v) === i)).map((tier) => (
              <div key={tier}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">{tier}</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {sponsors.filter((s) => s.tier === tier).map((s) => (
                    <button key={s.id} onClick={() => p.onSponsor(s)} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 hover:border-[#C9A227]">
                      {s.logo_url ? <img src={s.logo_url} alt="" className="h-8 w-14 object-contain" /> : null}
                      <span className="text-sm font-medium text-gray-900">{s.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* FAQ & venue */}
      <section id="program-faq" className="mt-8 scroll-mt-28">
        <h3 className="font-display text-lg font-bold text-bone">FAQ & venue</h3>
        {p.faqSlot}
      </section>
    </div>
  );
}
