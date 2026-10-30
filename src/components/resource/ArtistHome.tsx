import { useEffect, useState, type ReactNode } from 'react';
import DetailSheet, { type DetailKind } from '../earnings/DetailSheet';
import { useFeature } from '../../lib/preview';
import { EarningsSheet } from '../earnings/EarningsBreakdown';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

// Artist & vendor dashboard home (preview, "TapIN Stage" look): a bold hero, This month stats with trends, what needs
// your attention, round quick-add buttons, area cards that preview what's inside, and recent activity. Real numbers from
// artist_home (views and daily plays are tracked from Oct 2026).
export type Area = 'Bookings' | 'Music' | 'Media' | 'Products' | 'Stats';
export type QuickAdd = 'song' | 'album' | 'product' | 'media';
interface Home {
  tagline: string | null; cover: string | null;
  stats: { earned_month: number; earned_prev: number; plays_month: number; plays_prev: number; plays_total: number; views_month: number; views_prev: number; bookings_month: number; pending: number };
  next_booking: { title: string; date: string } | null;
  music: { songs: number; albums: number; covers: string[]; shares: number };
  shop: { count: number; images: string[] };
  media: string[];
  activity: { kind: string; text: string; at: string }[];
}
interface Props {
  resource: { id: string; display_name: string; profile_image?: string | null };
  unreadMessages: number;
  payoutsReady: boolean | null;
  musicOn: boolean;
  onOpen: (area: Area, quick?: QuickAdd) => void;
  // The payouts card, shown on the home (connect Stripe right here).
  payouts?: React.ReactNode;
}

const Icon = ({ d, size = 18, fill = false }: { d: string; size?: number; fill?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d.split('|').map((p, i) => <path key={i} d={p} />)}
  </svg>
);
export const ICONS = {
  back: 'M15 18l-6-6 6-6', eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z|M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', edit: 'M12 20h9|M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  calendar: 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z|M16 2v4M8 2v4M3 10h18', card: 'M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z|M2 10h20',
  chat: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z', music: 'M9 18V5l12-2v13|M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0z|M21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  disc: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z|M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', bag: 'M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z|M3 6h18|M16 10a4 4 0 0 1-8 0',
  camera: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z|M12 9a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', image: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z|M21 15l-5-5L5 21',
  chart: 'M3 3v18h18|M7 15l4-4 3 3 5-6', heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z',
  dollar: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6', user: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2|M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z|M19 8v6M22 11h-6',
  chevron: 'M9 18l6-6-6-6', play: 'M8 5v14l11-7z',
};
const money = (n: number) => `$${n >= 1000 ? Math.round(n).toLocaleString() : n % 1 ? n.toFixed(2) : n.toFixed(0)}`;
const num = (n: number) => n.toLocaleString();
function trend(now: number, prev: number): { text: string; tone: string } | null {
  if (!prev && !now) return null;
  if (!prev) return { text: 'New this month', tone: 'text-emerald-700' };
  const pct = Math.round(((now - prev) / prev) * 100);
  return pct >= 0 ? { text: `▲ ${pct}% vs last month`, tone: 'text-emerald-700' } : { text: `▼ ${Math.abs(pct)}% vs last month`, tone: 'text-red-700' };
}
const ago = (iso: string) => { const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 60 ? `${Math.max(1, m)}m` : m < 1440 ? `${Math.round(m / 60)}h` : m < 10080 ? `${Math.round(m / 1440)}d` : new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };

// The dark header inside an area (Music, Bookings, ...), with a back button to the home.
export function AreaHeader({ title, onBack, resourceId, music }: { title: string; onBack: () => void; resourceId: string; music?: boolean }) {
  const [h, setH] = useState<Home | null>(null);
  useEffect(() => { if (music) supabase.rpc('artist_home', { p_resource_id: resourceId }).then(({ data }) => setH((data ?? null) as Home | null)); }, [music, resourceId]);
  return (
    <div className="-mt-6 mb-2 rounded-[28px] bg-[#1E1B4B] px-4 pb-5 pt-4 text-white sm:mt-0">
      <div className="flex items-center gap-3">
        <button onClick={onBack} aria-label="Back to dashboard" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white"><Icon d={ICONS.back} size={20} /></button>
        <div><p className="text-xs font-semibold text-indigo-200">Dashboard</p><h2 className="font-display text-2xl font-extrabold text-white">{title}</h2></div>
      </div>
      {music && h && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[[num(h.stats.plays_total), 'plays'], [money(h.stats.earned_month), 'earned this month'], [num(h.music.shares), 'shares']].map(([v, l]) => (
            <div key={l} className="rounded-2xl bg-white/10 p-2.5"><p className="text-lg font-extrabold text-white">{v}</p><p className="text-[11px] font-semibold text-indigo-200">{l}</p></div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ArtistHome({ resource, unreadMessages, payoutsReady, musicOn, onOpen, payouts }: Props) {
  const earningsOn = useFeature('earnings_v2');
  const [earningsOpen, setEarningsOpen] = useState(false);
  const [detail, setDetail] = useState<DetailKind | null>(null);
  // Tapping a This month tile opens its details (preview).
  const tileTap = (label: string): (() => void) | undefined => (earningsOn ? ({ 'Earned': () => setEarningsOpen(true), 'Plays': () => setDetail('plays'), 'Profile views': () => setDetail('views'), 'Bookings': () => onOpen('Bookings') } as Record<string, () => void>)[label] : undefined);
  const [h, setH] = useState<Home | null>(null);
  useEffect(() => { supabase.rpc('artist_home', { p_resource_id: resource.id }).then(({ data }) => setH((data ?? null) as Home | null)); }, [resource.id]);
  const s = h?.stats;

  const attention: { key: string; text: string; cta: string; icon: string; tone: string; go: () => void }[] = [];
  if (s?.pending) attention.push({ key: 'b', text: `${s.pending} booking request${s.pending === 1 ? '' : 's'} waiting for your answer`, cta: 'Review', icon: ICONS.calendar, tone: 'bg-orange-100 text-orange-700', go: () => onOpen('Bookings') });
  if (unreadMessages > 0) attention.push({ key: 'm', text: `${unreadMessages} unread booking message${unreadMessages === 1 ? '' : 's'}`, cta: 'Open', icon: ICONS.chat, tone: 'bg-indigo-100 text-indigo-700', go: () => onOpen('Bookings') });
  if (payoutsReady === false) attention.push({ key: 'p', text: 'Connect payouts to get paid', cta: 'Connect', icon: ICONS.card, tone: 'bg-amber-100 text-amber-800', go: () => { const el = document.getElementById('artist-payouts'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); else window.location.href = '/profile#payouts'; } });

  const quick: { key: QuickAdd; label: string; icon: string; area: Area; grad: string; glow: string }[] = [
    ...(musicOn ? [
      { key: 'song' as const, label: 'Song', icon: ICONS.music, area: 'Music' as const, grad: 'from-indigo-600 to-violet-600', glow: 'shadow-indigo-500/40' },
      { key: 'album' as const, label: 'Album', icon: ICONS.disc, area: 'Music' as const, grad: 'from-teal-600 to-teal-400', glow: 'shadow-teal-500/40' },
    ] : []),
    { key: 'product', label: 'Product', icon: ICONS.bag, area: 'Products', grad: 'from-amber-500 to-orange-500', glow: 'shadow-orange-500/40' },
    { key: 'media', label: 'Media', icon: ICONS.camera, area: 'Media', grad: 'from-pink-500 to-pink-600', glow: 'shadow-pink-500/40' },
  ];
  const tiles: { label: string; value: string; t: ReturnType<typeof trend> | { text: string; tone: string }; bg: string; fg: string; val: string }[] = s ? [
    { label: 'Earned', value: money(Number(s.earned_month)), t: trend(Number(s.earned_month), Number(s.earned_prev)), bg: 'bg-indigo-50', fg: 'text-indigo-700', val: 'text-indigo-950' },
    { label: 'Plays', value: num(s.plays_month), t: trend(s.plays_month, s.plays_prev) ?? { text: `${num(s.plays_total)} all time`, tone: 'text-gray-600' }, bg: 'bg-teal-50', fg: 'text-teal-800', val: 'text-teal-950' },
    { label: 'Profile views', value: num(s.views_month), t: trend(s.views_month, s.views_prev), bg: 'bg-amber-50', fg: 'text-amber-800', val: 'text-amber-950' },
    { label: 'Bookings', value: num(s.bookings_month), t: s.pending ? { text: `${s.pending} waiting on you`, tone: 'text-gray-600' } : null, bg: 'bg-pink-50', fg: 'text-pink-800', val: 'text-pink-950' },
  ] : [];
  const actIcon: Record<string, [string, string]> = { donation: [ICONS.heart, 'bg-amber-100 text-amber-700'], tip: [ICONS.heart, 'bg-amber-100 text-amber-700'], sale: [ICONS.dollar, 'bg-teal-100 text-teal-700'], booking: [ICONS.calendar, 'bg-pink-100 text-pink-700'], follow: [ICONS.user, 'bg-indigo-100 text-indigo-700'] };
  const Card = ({ area, children, className = '' }: { area: Area; children: ReactNode; className?: string }) => (
    <button onClick={() => onOpen(area)} className={`flex flex-col gap-2.5 rounded-[20px] bg-white p-3.5 text-left text-gray-900 shadow-[0_2px_10px_rgba(39,30,110,0.06)] transition hover:shadow-[0_6px_18px_rgba(39,30,110,0.12)] ${className}`}>{children}</button>
  );

  return (
    <div className="-mt-6 sm:mt-0">
      {/* Hero */}
      <div className="relative rounded-[28px] bg-gradient-to-br from-indigo-600 via-violet-600 to-teal-500 px-5 pb-[72px] pt-5 text-white">
        <div className="flex items-center justify-between">
          <Link to="/profile" className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-white"><Icon d={ICONS.back} /> Profile</Link>
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-white/90">Artist dashboard</span>
          <span className="w-16" aria-hidden="true" />
        </div>
        <div className="mt-3 flex items-center gap-3.5">
          {resource.profile_image
            ? <img src={resource.profile_image} alt="" className="h-[76px] w-[76px] shrink-0 rounded-full object-cover ring-4 ring-white/35" />
            : <span className="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-full bg-white text-3xl font-extrabold text-indigo-600 ring-4 ring-white/35">{resource.display_name.charAt(0)}</span>}
          <div className="min-w-0">
            <h1 className="truncate font-display text-[28px] font-extrabold leading-tight text-white">{resource.display_name}</h1>
            {h?.tagline && <p className="truncate text-sm text-white/90">{h.tagline}</p>}
          </div>
        </div>
        <div className="mt-4 flex gap-2.5">
          <Link to={`/resources/${resource.id}`} className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-full bg-white text-sm font-bold text-indigo-800"><Icon d={ICONS.eye} size={16} /> View profile</Link>
          <Link to="/resources/new" className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-full border-[1.5px] border-white/60 bg-white/15 text-sm font-bold text-white"><Icon d={ICONS.edit} size={16} /> Edit profile</Link>
        </div>
      </div>

      <div className="px-3 sm:px-0">
        {/* This month */}
        <section aria-label="This month" className="relative -mt-[52px] rounded-[22px] bg-white p-4 shadow-[0_10px_30px_rgba(39,30,110,0.14)]">
          <p className="text-[15px] font-extrabold text-gray-900">This month</p>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {(s ? tiles : Array.from({ length: 4 }, () => null)).map((t, i) => t ? (
              <div key={t.label} className={`flex flex-col gap-1 rounded-2xl p-3 ${t.bg}`} onClick={tileTap(t.label)} role={tileTap(t.label) ? 'button' : undefined} tabIndex={tileTap(t.label) ? 0 : undefined} onKeyDown={(e) => { const f = tileTap(t.label); if (f && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); f(); } }}>
                <span className={`text-xs font-bold ${t.fg}`}>{t.label}</span>
                <span className={`text-2xl font-extrabold ${t.val}`}>{t.value}</span>
                <span className={`text-xs font-semibold ${t.t?.tone ?? 'text-gray-600'}`}>{t.t?.text ?? '\u00a0'}</span>
              </div>
            ) : <div key={i} className="h-[92px] animate-pulse rounded-2xl bg-gray-100" />)}
          </div>
        </section>

        {payouts && <div id="artist-payouts" className="mt-5 scroll-mt-24 [&>*]:mb-0">{payouts}</div>}
        {attention.length > 0 && (
          <section aria-label="Needs your attention" className="mt-5 flex flex-col gap-2.5">
            <p className="text-[15px] font-extrabold text-gray-900">Needs your attention</p>
            {attention.map((a) => (
              <button key={a.key} onClick={a.go} className="flex min-h-[56px] items-center gap-3 rounded-2xl bg-white px-3.5 py-2.5 text-left shadow-[0_2px_10px_rgba(39,30,110,0.06)]">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${a.tone}`}><Icon d={a.icon} /></span>
                <span className="flex-1 text-sm font-semibold text-gray-900">{a.text}</span>
                <span className="text-[13px] font-extrabold text-gray-800">{a.cta}</span>
              </button>
            ))}
          </section>
        )}

        <section aria-label="Add something new" className="mt-6">
          <p className="text-[15px] font-extrabold text-gray-900">Add something new</p>
          <div className={`mt-3 grid gap-2 ${quick.length === 4 ? 'grid-cols-4' : 'grid-cols-2'}`}>
            {quick.map((q) => (
              <button key={q.key} onClick={() => onOpen(q.area, q.key)} className="flex flex-col items-center gap-2 text-gray-900">
                <span className={`flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br text-white shadow-lg ${q.grad} ${q.glow}`}><Icon d={q.icon} size={26} /></span>
                <span className="text-[13px] font-bold">{q.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section aria-label="Your areas" className="mt-6 flex flex-col gap-3">
          <p className="text-[15px] font-extrabold text-gray-900">Your areas</p>
          {musicOn && (
            <button onClick={() => onOpen('Music')} className="flex flex-col gap-3 rounded-[20px] bg-[#1E1B4B] p-4 text-left text-white">
              <span className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-base font-extrabold text-white"><Icon d={ICONS.music} /> Music</span>
                <span className="text-[13px] font-semibold text-indigo-200">{h ? `${h.music.songs} song${h.music.songs === 1 ? '' : 's'} · ${h.music.albums} album${h.music.albums === 1 ? '' : 's'}` : '…'}</span>
              </span>
              <span className="flex items-center gap-2.5">
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[conic-gradient(from_0deg,#4F46E5,#14B8A6,#F59E0B,#EC4899,#4F46E5)] ring-[3px] ring-white/15" aria-hidden="true"><span className="h-[18px] w-[18px] rounded-full bg-[#F4F3FA]" /></span>
                {(h?.music.covers ?? []).slice(0, 2).map((c) => <img key={c} src={c} alt="" className="h-16 w-16 shrink-0 rounded-[14px] object-cover" />)}
                {Array.from({ length: Math.max(0, 2 - (h?.music.covers.length ?? 0)) }, (_, i) => <span key={i} className={`h-16 w-16 shrink-0 rounded-[14px] ${i ? 'bg-gradient-to-br from-orange-500 to-pink-500' : 'bg-gradient-to-br from-violet-600 to-teal-500'}`} aria-hidden="true" />)}
                <span className="flex min-w-0 flex-1 flex-col items-end"><span className="whitespace-nowrap text-[22px] font-extrabold text-white">{h ? num(h.stats.plays_total) : '…'}</span><span className="text-xs text-indigo-200">plays</span></span>
              </span>
            </button>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Card area="Bookings">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-100 text-pink-700"><Icon d={ICONS.calendar} /></span>
              <span className="text-[15px] font-extrabold">Bookings</span>
              <span className="text-xs leading-snug text-gray-600">{h?.next_booking ? <>Next: {h.next_booking.title}<br />{new Date(h.next_booking.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</> : 'No upcoming bookings'}</span>
            </Card>
            <Card area="Products">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 text-orange-700"><Icon d={ICONS.bag} /></span>
              <span className="text-[15px] font-extrabold">Shop</span>
              {h?.shop.images.length ? <span className="flex gap-1.5">{h.shop.images.map((u) => <img key={u} src={u} alt="" className="h-9 w-9 rounded-[10px] object-cover" />)}</span>
                : <span className="text-xs text-gray-600">{h ? `${h.shop.count} product${h.shop.count === 1 ? '' : 's'}` : '…'}</span>}
            </Card>
            <Card area="Media">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700"><Icon d={ICONS.image} /></span>
              <span className="text-[15px] font-extrabold">Media</span>
              {h?.media.length ? <span className="grid grid-cols-3 gap-1">{h.media.map((u) => <img key={u} src={u} alt="" className="h-[30px] w-full rounded-md object-cover" />)}</span>
                : <span className="text-xs text-gray-600">Photos, videos, music &amp; links</span>}
            </Card>
            <Card area="Stats">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-100 text-green-700"><Icon d={ICONS.chart} /></span>
              <span className="text-[15px] font-extrabold">Stats</span>
              <span className="text-xs leading-snug text-gray-600">Views, followers and top songs</span>
            </Card>
          </div>
        </section>

        {h && h.activity.length > 0 && (
          <section aria-label="Recent activity" className="mb-6 mt-6">
            <p className="text-[15px] font-extrabold text-gray-900">Recent activity</p>
            <ul className="mt-2.5 divide-y divide-[#EEEDF6] rounded-[20px] bg-white shadow-[0_2px_10px_rgba(39,30,110,0.06)]">
              {h.activity.map((a, i) => {
                const [ic, tone] = actIcon[a.kind] ?? [ICONS.chart, 'bg-gray-100 text-gray-700'];
                return (
                  <li key={i} className="flex items-center gap-3 px-3.5 py-3">
                    <span className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full ${tone}`}><Icon d={ic} size={16} /></span>
                    <span className="flex-1 text-[13px] leading-snug text-gray-900">{a.text}</span>
                    <span className="text-xs text-gray-600">{ago(a.at)}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
      {detail && <DetailSheet kind={detail} scopeId={resource.id} onClose={() => setDetail(null)} />}
      {earningsOpen && <EarningsSheet scope="resource" scopeId={resource.id} title="Earnings" onClose={() => setEarningsOpen(false)} />}
    </div>
  );
}
