import { useEffect, useMemo, useState } from 'react';
import { MySessions, SessionSignupControl, useSessionSignups } from './SessionSignups';
import { useFeature } from '../../lib/preview';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { DEFAULT_BRAND, SESSION_KINDS, SPONSOR_TIERS, loadFont, type Organization, type Session, type Speaker, type Sponsor } from '../../lib/business';
import type { TapEvent } from '../../lib/types';

// Everything that makes a business / nonprofit event page: the organization strip
// (brand colors, logo), agenda by day, speakers, sponsor wall, venue notes and FAQ.
export function useBusinessData(event: TapEvent | null) {
  const [org, setOrg] = useState<Organization | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [links, setLinks] = useState<{ session_id: string; speaker_id: string }[]>([]);
  const isBiz = !!event && !!event.event_kind && event.event_kind !== 'community';
  useEffect(() => {
    if (!event || !isBiz) return;
    (async () => {
      const [o, a, b, c] = await Promise.all([
        event.organization_id ? supabase.from('organizations').select('*').eq('id', event.organization_id).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from('event_sessions').select('*').eq('event_id', event.id).order('starts_at', { ascending: true, nullsFirst: false }).order('sort_order'),
        supabase.from('event_speakers').select('*').eq('event_id', event.id).order('featured', { ascending: false }).order('sort_order').order('created_at'),
        supabase.from('event_sponsors').select('*').eq('event_id', event.id).order('sort_order').order('created_at'),
      ]);
      if (o.data) { const og = { ...o.data, brand: { ...DEFAULT_BRAND, ...(o.data.brand ?? {}) } } as Organization; setOrg(og); loadFont(og.brand.font); }
      const ss = (a.data ?? []) as Session[];
      setSessions(ss); setSpeakers((b.data ?? []) as Speaker[]); setSponsors((c.data ?? []) as Sponsor[]);
      if (ss.length) {
        const { data } = await supabase.from('session_speakers').select('session_id, speaker_id').in('session_id', ss.map((s) => s.id));
        setLinks((data ?? []) as { session_id: string; speaker_id: string }[]);
      }
    })();
  }, [event?.id, isBiz]); // eslint-disable-line react-hooks/exhaustive-deps
  return { isBiz, org, sessions, speakers, sponsors, links };
}

export function OrgStrip({ org, kind }: { org: Organization | null; kind?: string }) {
  if (!org) return null;
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 text-white sm:px-6" style={{ background: org.brand.primary, fontFamily: `'${org.brand.font}', system-ui, sans-serif` }}>
      {org.logo_url ? <img src={org.logo_url} alt="" className="h-8 w-8 rounded-lg bg-white/10 object-cover" /> : <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-sm font-bold">{org.name.charAt(0)}</span>}
      <Link to={`/o/${org.slug}`} className="min-w-0 flex-1 truncate text-sm font-semibold hover:underline" aria-label={`${org.name}: view organization page`}>{org.name}{org.verified && <span className="ml-1" style={{ color: org.brand.accent }} title="Verified">✓</span>}<span className="ml-1.5 opacity-80" aria-hidden="true">›</span></Link>
      <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide" style={{ background: org.brand.accent, color: '#111827' }}>{kind === 'nonprofit' ? 'Nonprofit event' : 'Business event'}</span>
    </div>
  );
}

const timeOf = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(':00 ', ' ') : 'TBA');

export default function BusinessEventSections({ event, data }: { event: TapEvent; data: ReturnType<typeof useBusinessData> }) {
  const { org, sessions, speakers, sponsors, links } = data;
  const brand = org?.brand ?? DEFAULT_BRAND;
  const [openSpeaker, setOpenSpeaker] = useState<Speaker | null>(null);
  const days = useMemo(() => {
    const m = new Map<string, Session[]>();
    for (const s of sessions) {
      const k = s.starts_at ? new Date(s.starts_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'Schedule';
      m.set(k, [...(m.get(k) ?? []), s]);
    }
    return [...m.entries()];
  }, [sessions]);
  const tiers = useMemo(() => {
    const order = [...SPONSOR_TIERS, ...sponsors.map((s) => s.tier).filter((t) => !SPONSOR_TIERS.includes(t))];
    return order.filter((t, i) => order.indexOf(t) === i && sponsors.some((s) => s.tier === t));
  }, [sponsors]);
  const workshopsOn = useFeature('workshops');
  const signups = useSessionSignups(event.id, workshopsOn);
  const faq = event.business_page?.faq ?? [];
  const venue = event.business_page?.venue_notes ?? '';
  const font = { fontFamily: `'${brand.font}', system-ui, sans-serif` };
  const heading = 'font-bold text-gray-900 text-xl';
  if (!sessions.length && !speakers.length && !sponsors.length && !faq.length && !venue) return null;

  return (
    <div className="mt-10 flex flex-col gap-10" style={font}>
      {days.length > 0 && (
        <section id="agenda" className="scroll-mt-24">
          <h2 className={heading}>Agenda</h2>
          {signups.info && <MySessions info={signups.info} accent={brand.accent} titles={Object.fromEntries(sessions.map((x) => [x.id, { title: x.title, time: timeOf(x.starts_at) }]))} />}
          {days.map(([day, list]) => (
            <div key={day} className="mt-4">
              {days.length > 1 && <p className="mb-2 text-sm font-semibold" style={{ color: brand.primary }}>{day}</p>}
              <ol className="flex flex-col gap-2">
                {list.map((s) => {
                  const who = links.filter((l) => l.session_id === s.id).map((l) => speakers.find((k) => k.id === l.speaker_id)).filter(Boolean) as Speaker[];
                  const isBreak = s.kind === 'break' || s.kind === 'meal';
                  return (
                    <li key={s.id} className={`flex gap-4 rounded-xl p-4 ${isBreak ? 'bg-gray-50' : 'border border-gray-200 bg-white'}`} style={isBreak ? undefined : { borderLeft: `4px solid ${brand.accent}` }}>
                      <div className="w-20 shrink-0 text-sm font-semibold text-gray-900">{timeOf(s.starts_at)}{s.ends_at && <span className="block text-xs font-normal text-gray-400">to {timeOf(s.ends_at)}</span>}</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: brand.primary }}>{SESSION_KINDS.find((k) => k.key === s.kind)?.label}{s.track ? ` · ${s.track}` : ''}</p>
                        <p className="font-semibold text-gray-900">{s.title}</p>
                        {(s.room || s.capacity) && <p className="text-xs text-gray-500">{[s.room, s.capacity ? `${s.capacity} seats` : null].filter(Boolean).join(' · ')}</p>}
                        {s.description && <p className="mt-1 text-sm text-gray-600">{s.description}</p>}
                        {signups.info && (() => { const seat = signups.info.sessions.find((x) => x.id === s.id); return seat ? <SessionSignupControl seat={seat} info={signups.info} title={s.title} accent={brand.accent} onChanged={signups.reload} /> : null; })()}
                        {who.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {who.map((k) => (
                              <button key={k.id} onClick={() => setOpenSpeaker(k)} className="flex items-center gap-1.5 rounded-full bg-gray-100 py-0.5 pl-0.5 pr-2.5 text-xs text-gray-700">
                                {k.photo_url ? <img src={k.photo_url} alt="" className="h-5 w-5 rounded-full object-cover" /> : <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-300 text-[10px] font-bold">{k.name.charAt(0)}</span>}
                                {k.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </section>
      )}

      {speakers.length > 0 && (
        <section>
          <h2 className={heading}>Speakers</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {speakers.map((k) => (
              <button key={k.id} onClick={() => setOpenSpeaker(k)} className={`text-left ${k.featured ? 'col-span-2 sm:col-span-1' : ''}`}>
                <div className="aspect-square w-full overflow-hidden rounded-2xl bg-gray-100">
                  {k.photo_url ? <img src={k.photo_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-white" style={{ background: `linear-gradient(135deg, ${brand.primary}, ${brand.accent})` }}>{k.name.charAt(0)}</div>}
                </div>
                <p className="mt-2 font-semibold text-gray-900">{k.name}{k.featured && <span className="ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: brand.accent, color: '#111827' }}>Featured</span>}</p>
                <p className="text-xs text-gray-500">{[k.title, k.company].filter(Boolean).join(', ')}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {tiers.length > 0 && (
        <section>
          <h2 className={heading}>Sponsors</h2>
          <div className="mt-4 flex flex-col gap-6">
            {tiers.map((t, i) => (
              <div key={t}>
                <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-gray-400">{t}</p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-4">
                  {sponsors.filter((s) => s.tier === t).map((s) => {
                    const size = i === 0 ? 'h-16 w-40' : i === 1 ? 'h-12 w-32' : 'h-10 w-24';
                    const inner = s.logo_url ? <img src={s.logo_url} alt={s.name} className={`${size} object-contain`} /> : <span className="px-3 py-2 text-sm font-semibold text-gray-700">{s.name}</span>;
                    return s.website
                      ? <a key={s.id} href={s.website} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-gray-100 bg-white p-3 hover:border-gray-300" title={s.name}>{inner}</a>
                      : <span key={s.id} className="rounded-xl border border-gray-100 bg-white p-3" title={s.name}>{inner}</span>;
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {(venue || faq.length > 0) && (
        <section>
          <h2 className={heading}>Good to know</h2>
          {venue && <p className="mt-3 whitespace-pre-wrap rounded-xl bg-gray-50 p-4 text-sm text-gray-700">{venue}</p>}
          {faq.length > 0 && (
            <div className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
              {faq.map((x, i) => (
                <details key={i} className="group p-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium text-gray-900">{x.q}<span className="text-gray-400 transition group-open:rotate-45">+</span></summary>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">{x.a}</p>
                </details>
              ))}
            </div>
          )}
        </section>
      )}

      {openSpeaker && (
        <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setOpenSpeaker(null)}>
          <div className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:rounded-3xl" onClick={(e) => e.stopPropagation()} style={font}>
            <div className="flex items-center gap-4">
              {openSpeaker.photo_url ? <img src={openSpeaker.photo_url} alt="" className="h-20 w-20 rounded-2xl object-cover" /> : <span className="flex h-20 w-20 items-center justify-center rounded-2xl text-2xl font-bold text-white" style={{ background: brand.primary }}>{openSpeaker.name.charAt(0)}</span>}
              <div><p className="text-lg font-bold text-gray-900">{openSpeaker.name}</p><p className="text-sm text-gray-500">{[openSpeaker.title, openSpeaker.company].filter(Boolean).join(', ')}</p></div>
            </div>
            {openSpeaker.bio && <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{openSpeaker.bio}</p>}
            {(() => { const theirs = links.filter((l) => l.speaker_id === openSpeaker.id).map((l) => sessions.find((s) => s.id === l.session_id)).filter(Boolean) as Session[]; return theirs.length ? (
              <div className="mt-4"><p className="text-xs font-bold uppercase tracking-wide text-gray-400">Sessions</p>{theirs.map((s) => <p key={s.id} className="mt-1 text-sm text-gray-800">{timeOf(s.starts_at)} · {s.title}</p>)}</div>
            ) : null; })()}
            {openSpeaker.link && <a href={openSpeaker.link} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm font-medium" style={{ color: brand.primary }}>Profile ↗</a>}
          </div>
        </div>
      )}
    </div>
  );
}
