import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { ICONS } from '../resource/ArtistHome';

// Organizer dashboard home (preview, "TapIN Stage" look like the artist and group dashboards): a greeting hero with
// Scan tickets, This month stats, what needs attention, Create buttons, upcoming events as cards with a sales bar, and
// recent activity. Real numbers from organizer_home (event page views are tracked from Oct 2026).
interface Home {
  name: string; upcoming_count: number; next_in_days: number | null;
  stats: { revenue_month: number; revenue_prev: number; tickets_month: number; tickets_prev: number; tickets_week: number; views_month: number; views_prev: number; checked_in_30d: number; tickets_30d: number };
  attention: { drafts: number; vendor_apps: number; held_cents: number; no_tickets_soon: number };
  upcoming: { id: string; title: string; start_date: string | null; location: string | null; poster: string | null; status: string; capacity: number | null; is_recurring: boolean; sold: number; revenue: number }[];
  activity: { kind: string; text: string; at: string }[];
}
const Icon = ({ d, size = 18 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d.split('|').map((p, i) => <path key={i} d={p} />)}</svg>
);
const SCAN = 'M3 7V5a2 2 0 0 1 2-2h2|M17 3h2a2 2 0 0 1 2 2v2|M21 17v2a2 2 0 0 1-2 2h-2|M7 21H5a2 2 0 0 1-2-2v-2|M7 12h10';
const BRIEF = 'M4 7h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z|M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2';
const SEND = 'M3 11l18-8-8 18-2-8-8-2z';
const PEOPLE = 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2|M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z|M23 21v-2a4 4 0 0 0-3-3.87|M16 3.13a4 4 0 0 1 0 7.75';
const TICKET = 'M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z';
const money = (n: number) => `$${n >= 1000 ? Math.round(n).toLocaleString() : n % 1 ? n.toFixed(2) : n.toFixed(0)}`;
function trend(now: number, prev: number) {
  if (!prev && !now) return null;
  if (!prev) return { text: 'New this month', tone: 'text-emerald-700' };
  const pct = Math.round(((now - prev) / prev) * 100);
  return pct >= 0 ? { text: `▲ ${pct}% vs last month`, tone: 'text-emerald-700' } : { text: `▼ ${Math.abs(pct)}% vs last month`, tone: 'text-red-700' };
}
const ago = (iso: string) => { const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 60 ? `${Math.max(1, m)}m` : m < 1440 ? `${Math.round(m / 60)}h` : m < 10080 ? `${Math.round(m / 1440)}d` : new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning,' : h < 18 ? 'Good afternoon,' : 'Good evening,'; };
const GRADS = ['from-[#1E1B4B] to-violet-600', 'from-orange-500 to-pink-500', 'from-teal-600 to-indigo-600', 'from-pink-600 to-violet-700'];

export default function OrganizerHome() {
  const [h, setH] = useState<Home | null>(null);
  useEffect(() => { supabase.rpc('organizer_home').then(({ data }) => setH((data ?? null) as Home | null)); }, []);
  const s = h?.stats;
  const attention: { key: string; text: string; cta: string; to: string; icon: string; tone: string }[] = [];
  if (h?.attention.held_cents) attention.push({ key: 'h', text: `${money(h.attention.held_cents / 100)} in ticket sales held: connect payouts`, cta: 'Connect', to: '/profile#payouts', icon: ICONS.card, tone: 'bg-amber-100 text-amber-800' });
  if (h?.attention.drafts) attention.push({ key: 'd', text: `${h.attention.drafts} draft event${h.attention.drafts === 1 ? ' isn\u2019t' : 's aren\u2019t'} published yet`, cta: 'Finish', to: '#all-events', icon: ICONS.edit, tone: 'bg-indigo-100 text-indigo-700' });
  if (h?.attention.vendor_apps) attention.push({ key: 'v', text: `${h.attention.vendor_apps} vendor application${h.attention.vendor_apps === 1 ? '' : 's'} to review`, cta: 'Review', to: '#all-events', icon: ICONS.bag, tone: 'bg-orange-100 text-orange-700' });
  if (h?.attention.no_tickets_soon) attention.push({ key: 'n', text: `${h.attention.no_tickets_soon} event${h.attention.no_tickets_soon === 1 ? '' : 's'} this week with no tickets yet`, cta: 'Promote', to: '#all-events', icon: SEND, tone: 'bg-pink-100 text-pink-700' });
  const tiles = s ? [
    { label: 'Ticket revenue', value: money(Number(s.revenue_month)), t: trend(Number(s.revenue_month), Number(s.revenue_prev)), bg: 'bg-indigo-50', fg: 'text-indigo-700', val: 'text-indigo-950' },
    { label: 'Tickets sold', value: Number(s.tickets_month).toLocaleString(), t: s.tickets_week ? { text: `▲ ${s.tickets_week} this week`, tone: 'text-emerald-700' } : trend(Number(s.tickets_month), Number(s.tickets_prev)), bg: 'bg-teal-50', fg: 'text-teal-800', val: 'text-teal-950' },
    { label: 'Event page views', value: Number(s.views_month).toLocaleString(), t: s.views_month && s.tickets_month ? { text: `${((s.tickets_month / s.views_month) * 100).toFixed(1)}% bought tickets`, tone: 'text-gray-600' } : trend(s.views_month, s.views_prev), bg: 'bg-amber-50', fg: 'text-amber-800', val: 'text-amber-950' },
    { label: 'Checked in', value: Number(s.checked_in_30d).toLocaleString(), t: s.tickets_30d ? { text: `of ${s.tickets_30d} at recent events`, tone: 'text-gray-600' } : { text: 'Last 30 days', tone: 'text-gray-600' }, bg: 'bg-pink-50', fg: 'text-pink-800', val: 'text-pink-950' },
  ] : [];
  const actIcon: Record<string, [string, string]> = { tickets: [TICKET, 'bg-teal-100 text-teal-700'], donation: [ICONS.heart, 'bg-amber-100 text-amber-700'], vendor: [ICONS.bag, 'bg-orange-100 text-orange-700'] };
  const create = [
    { label: 'Event', to: '/organizer/new', icon: ICONS.calendar, grad: 'from-indigo-600 to-violet-600', glow: 'shadow-indigo-500/40' },
    { label: 'Business', to: '/business', icon: BRIEF, grad: 'from-teal-600 to-teal-400', glow: 'shadow-teal-500/40' },
    { label: 'Promote', to: '#all-events', icon: SEND, grad: 'from-amber-500 to-orange-500', glow: 'shadow-orange-500/40' },
    { label: 'Book talent', to: '/resources', icon: PEOPLE, grad: 'from-pink-500 to-pink-600', glow: 'shadow-pink-500/40' },
  ];
  const Go = ({ to, className, children, label }: { to: string; className: string; children: React.ReactNode; label?: string }) =>
    to.startsWith('#') ? <a href={to} className={className} aria-label={label}>{children}</a> : <Link to={to} className={className} aria-label={label}>{children}</Link>;

  return (
    <div className="-mt-6 sm:mt-0">
      <div className="relative rounded-[28px] bg-gradient-to-br from-indigo-600 via-violet-600 to-teal-500 px-6 pb-[84px] pt-6 text-white">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-white/90">Organizer dashboard</span>
          {(() => { const next = h?.upcoming.find((e) => e.status === 'published'); return (
            <Go to={next ? `/organizer/events/${next.id}/checkin` : '#all-events'} label={next ? `Scan tickets for ${next.title}` : 'Scan tickets'} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-white/20 px-3.5 text-[13px] font-bold text-white"><Icon d={SCAN} size={16} /> Scan tickets</Go>
          ); })()}
        </div>
        <div className="mt-5 flex flex-col gap-1.5">
          <span className="text-[15px] text-white/90">{greeting()}</span>
          <h1 className="font-display text-[30px] font-extrabold leading-tight text-white">{h?.name ?? '\u00a0'}</h1>
          <span className="text-sm text-white/90">{h ? `${h.upcoming_count} upcoming event${h.upcoming_count === 1 ? '' : 's'}${h.next_in_days !== null ? ` · next ${h.next_in_days <= 0 ? 'today' : h.next_in_days === 1 ? 'tomorrow' : `in ${h.next_in_days} days`}` : ''}` : '\u00a0'}</span>
        </div>
      </div>
      <div className="px-4 sm:px-0">
        <section aria-label="This month" className="relative -mt-[60px] rounded-[24px] bg-white p-5 shadow-[0_10px_30px_rgba(39,30,110,0.14)]">
          <p className="text-[17px] font-extrabold text-gray-900">This month</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {(s ? tiles : Array.from({ length: 4 }, () => null)).map((t, i) => t ? (
              <div key={t.label} className={`flex flex-col gap-1.5 rounded-[18px] px-3.5 py-4 ${t.bg}`}>
                <span className={`text-xs font-bold ${t.fg}`}>{t.label}</span>
                <span className={`text-2xl font-extrabold ${t.val}`}>{t.value}</span>
                <span className={`text-xs font-semibold ${t.t?.tone ?? 'text-gray-600'}`}>{t.t?.text ?? '\u00a0'}</span>
              </div>
            ) : <div key={i} className="h-[100px] animate-pulse rounded-[18px] bg-gray-100" />)}
          </div>
        </section>
        {attention.length > 0 && (
          <section aria-label="Needs your attention" className="mt-9 flex flex-col gap-3.5">
            <p className="text-[17px] font-extrabold text-gray-900">Needs your attention</p>
            {attention.map((a) => (
              <Go key={a.key} to={a.to} className="flex min-h-[64px] items-center gap-3.5 rounded-[18px] bg-white px-4 py-3 text-gray-900 shadow-[0_2px_10px_rgba(39,30,110,0.06)]">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${a.tone}`}><Icon d={a.icon} /></span>
                <span className="flex-1 text-sm font-semibold leading-snug">{a.text}</span>
                <span className="text-[13px] font-extrabold">{a.cta}</span>
              </Go>
            ))}
          </section>
        )}
        <section aria-label="Create" className="mt-9">
          <p className="text-[17px] font-extrabold text-gray-900">Create</p>
          <div className="mt-4 grid grid-cols-4 gap-3">
            {create.map((c) => (
              <Go key={c.label} to={c.to} className="flex flex-col items-center gap-2.5 text-gray-900">
                <span className={`flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br text-white shadow-lg ${c.grad} ${c.glow}`}><Icon d={c.icon} size={26} /></span>
                <span className="text-[13px] font-bold">{c.label}</span>
              </Go>
            ))}
          </div>
        </section>
        {h && h.upcoming.length > 0 && (
          <section aria-label="Upcoming events" className="mt-9 flex flex-col gap-4">
            <div className="flex items-center justify-between"><p className="text-[17px] font-extrabold text-gray-900">Upcoming events</p><a href="#all-events" className="text-[13px] font-bold text-indigo-600">See all</a></div>
            {h.upcoming.map((e, i) => {
              const d = e.start_date ? new Date(e.start_date) : null;
              const pct = e.capacity ? Math.min(100, Math.round((e.sold / e.capacity) * 100)) : 0;
              return (
                <Link key={e.id} to={`/organizer/events/${e.id}`} className="flex flex-col overflow-hidden rounded-[20px] bg-white text-gray-900 shadow-[0_2px_10px_rgba(39,30,110,0.08)]">
                  <div className={`relative h-[140px] bg-gradient-to-br ${GRADS[i % GRADS.length]}`}>
                    {e.poster && <img src={e.poster} alt="" className="absolute inset-0 h-full w-full object-cover" />}
                    {d && <span className="absolute left-3.5 top-3.5 flex flex-col items-center rounded-xl bg-white px-3 py-2 leading-none shadow"><span className="text-[11px] font-extrabold uppercase text-pink-600">{d.toLocaleDateString('en-US', { month: 'short' })}</span><span className="text-xl font-extrabold text-gray-900">{d.getDate()}</span></span>}
                    <span className={`absolute right-3.5 top-3.5 rounded-full px-3 py-1 text-[11px] font-extrabold ${e.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>{e.status === 'published' ? 'Published' : 'Draft'}</span>
                  </div>
                  <div className="flex flex-col gap-2.5 p-[18px]">
                    <span className="text-base font-extrabold">{e.title}</span>
                    <span className="text-[13px] text-gray-600">{[d ? d.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : 'Date to be announced', e.location, e.is_recurring ? 'Repeats' : null].filter(Boolean).join(' · ')}</span>
                    {e.capacity ? <div className="mt-1 h-2 overflow-hidden rounded bg-[#EEEDF6]"><div className="h-full rounded bg-gradient-to-r from-indigo-600 to-teal-500" style={{ width: `${pct}%` }} /></div> : null}
                    <span className="flex justify-between text-xs font-semibold text-gray-600"><span>{e.capacity ? `${e.sold} of ${e.capacity} tickets sold` : `${e.sold} ticket${e.sold === 1 ? '' : 's'} sold`}</span><span className="text-gray-900">{money(Number(e.revenue))}</span></span>
                  </div>
                </Link>
              );
            })}
          </section>
        )}
        {h && h.activity.length > 0 && (
          <section aria-label="Recent activity" className="mb-10 mt-9">
            <p className="text-[17px] font-extrabold text-gray-900">Recent activity</p>
            <ul className="mt-3.5 divide-y divide-[#EEEDF6] rounded-[20px] bg-white shadow-[0_2px_10px_rgba(39,30,110,0.06)]">
              {h.activity.map((a, i) => { const [ic, tone] = actIcon[a.kind] ?? [ICONS.chart, 'bg-gray-100 text-gray-700']; return (
                <li key={i} className="flex items-center gap-3.5 px-[18px] py-4">
                  <span className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full ${tone}`}><Icon d={ic} size={16} /></span>
                  <span className="flex-1 text-sm leading-snug text-gray-900">{a.text}</span>
                  <span className="text-xs text-gray-600">{ago(a.at)}</span>
                </li>
              ); })}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
