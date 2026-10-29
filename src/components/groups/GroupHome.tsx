import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { ICONS } from '../resource/ArtistHome';

// Group Manage home (preview, "TapIN Stage" look, like the artist dashboard): a bold hero, This month stats, what needs
// attention, quick actions, area cards with previews, and recent activity. Areas open on their own (onOpen).
export type GroupArea = 'bookings' | 'members' | 'payouts' | 'music' | 'media' | 'posts' | 'settings';
export type GroupQuick = 'song' | 'album' | 'invite' | 'media';
interface Home {
  tagline: string | null;
  stats: { earned_month: number; earned_prev: number; plays_month: number; plays_prev: number; plays_total: number; views_month: number; views_prev: number; bookings_month: number; pending: number };
  members: { count: number; invited: number; not_connected: number; photos: string[] };
  song_requests: number;
  next_booking: { title: string; date: string } | null;
  music: { songs: number; albums: number; covers: string[]; shares: number };
  media: string[];
  activity: { kind: string; text: string; at: string }[];
}
const Icon = ({ d, size = 18 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d.split('|').map((p, i) => <path key={i} d={p} />)}</svg>
);
const GROUP = 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2|M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z|M23 21v-2a4 4 0 0 0-3-3.87|M16 3.13a4 4 0 0 1 0 7.75';
const CHAT = 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z';
const POST = 'M4 4h16v16H4z|M8 9h8M8 13h8M8 17h5';
const GEAR = 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z|M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68 1.65 1.65 0 0 0 10 3.17V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z';
const money = (n: number) => `$${n % 1 ? n.toFixed(2) : n.toFixed(0)}`;
const num = (n: number) => n.toLocaleString();
function trend(now: number, prev: number) {
  if (!prev && !now) return null;
  if (!prev) return { text: 'New this month', tone: 'text-emerald-700' };
  const pct = Math.round(((now - prev) / prev) * 100);
  return pct >= 0 ? { text: `▲ ${pct}% vs last month`, tone: 'text-emerald-700' } : { text: `▼ ${Math.abs(pct)}% vs last month`, tone: 'text-red-700' };
}
const ago = (iso: string) => { const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 60 ? `${Math.max(1, m)}m` : m < 1440 ? `${Math.round(m / 60)}h` : m < 10080 ? `${Math.round(m / 1440)}d` : new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };

export default function GroupHome({ group, roleLabel, isAdmin, isOwner, musicOn, onOpen }: {
  group: { id: string; display_name: string; profile_image?: string | null }; roleLabel: string; isAdmin: boolean; isOwner: boolean; musicOn: boolean; onOpen: (a: GroupArea, q?: GroupQuick) => void;
}) {
  const [h, setH] = useState<Home | null>(null);
  useEffect(() => { supabase.rpc('group_home', { p_group_id: group.id }).then(({ data }) => setH((data ?? null) as Home | null)); }, [group.id]);
  const s = h?.stats;
  const attention: { key: string; text: string; cta: string; icon: string; tone: string; go: () => void }[] = [];
  if (isAdmin && s?.pending) attention.push({ key: 'b', text: `${s.pending} booking request${s.pending === 1 ? '' : 's'} waiting for an answer`, cta: 'Review', icon: ICONS.calendar, tone: 'bg-orange-100 text-orange-700', go: () => onOpen('bookings') });
  if (isAdmin && h?.song_requests) attention.push({ key: 's', text: `${h.song_requests} song${h.song_requests === 1 ? '' : 's'} waiting for approval`, cta: 'Review', icon: ICONS.music, tone: 'bg-indigo-100 text-indigo-700', go: () => onOpen('music') });
  if (h?.members.not_connected) attention.push({ key: 'p', text: `${h.members.not_connected} member${h.members.not_connected === 1 ? ' hasn\u2019t' : 's haven\u2019t'} connected payouts`, cta: 'See', icon: ICONS.card, tone: 'bg-amber-100 text-amber-800', go: () => onOpen('payouts') });
  if (isAdmin && h?.members.invited) attention.push({ key: 'i', text: `${h.members.invited} invite${h.members.invited === 1 ? '' : 's'} waiting to be accepted`, cta: 'See', icon: GROUP, tone: 'bg-teal-100 text-teal-800', go: () => onOpen('members') });
  const quick: { key: GroupQuick; label: string; icon: string; area: GroupArea; grad: string; glow: string }[] = isAdmin ? [
    ...(musicOn ? [{ key: 'song' as const, label: 'Song', icon: ICONS.music, area: 'music' as const, grad: 'from-indigo-600 to-violet-600', glow: 'shadow-indigo-500/40' },
      { key: 'album' as const, label: 'Album', icon: ICONS.disc, area: 'music' as const, grad: 'from-teal-600 to-teal-400', glow: 'shadow-teal-500/40' }] : []),
    { key: 'invite', label: 'Invite', icon: ICONS.user, area: 'members', grad: 'from-amber-500 to-orange-500', glow: 'shadow-orange-500/40' },
    { key: 'media', label: 'Media', icon: ICONS.camera, area: 'media', grad: 'from-pink-500 to-pink-600', glow: 'shadow-pink-500/40' },
  ] : [];
  const tiles = s ? [
    { label: 'Earned', value: money(Number(s.earned_month)), t: trend(Number(s.earned_month), Number(s.earned_prev)), bg: 'bg-indigo-50', fg: 'text-indigo-700', val: 'text-indigo-950' },
    { label: 'Plays', value: num(s.plays_month), t: trend(s.plays_month, s.plays_prev) ?? { text: `${num(s.plays_total)} all time`, tone: 'text-gray-600' }, bg: 'bg-teal-50', fg: 'text-teal-800', val: 'text-teal-950' },
    { label: 'Page views', value: num(s.views_month), t: trend(s.views_month, s.views_prev), bg: 'bg-amber-50', fg: 'text-amber-800', val: 'text-amber-950' },
    { label: 'Bookings', value: num(s.bookings_month), t: s.pending ? { text: `${s.pending} waiting`, tone: 'text-gray-600' } : null, bg: 'bg-pink-50', fg: 'text-pink-800', val: 'text-pink-950' },
  ] : [];
  const actIcon: Record<string, [string, string]> = { donation: [ICONS.heart, 'bg-amber-100 text-amber-700'], tip: [ICONS.heart, 'bg-amber-100 text-amber-700'], sale: [ICONS.dollar, 'bg-teal-100 text-teal-700'], booking: [ICONS.calendar, 'bg-pink-100 text-pink-700'], follow: [ICONS.user, 'bg-indigo-100 text-indigo-700'] };
  const Card = ({ area, icon, tone, title, children }: { area: GroupArea; icon: string; tone: string; title: string; children: ReactNode }) => (
    <button onClick={() => onOpen(area)} className="flex flex-col gap-2.5 rounded-[20px] bg-white p-3.5 text-left text-gray-900 shadow-[0_2px_10px_rgba(39,30,110,0.06)] transition hover:shadow-[0_6px_18px_rgba(39,30,110,0.12)]">
      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}><Icon d={icon} /></span>
      <span className="text-[15px] font-extrabold">{title}</span>
      {children}
    </button>
  );
  return (
    <div className="-mt-6 sm:mt-0">
      <div className="relative rounded-[28px] bg-gradient-to-br from-indigo-600 via-violet-600 to-teal-500 px-5 pb-[72px] pt-5 text-white">
        <div className="flex items-center justify-between">
          <Link to="/groups" className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-white"><Icon d={ICONS.back} /> Groups</Link>
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-white/90">{roleLabel}</span>
          <span className="w-16" aria-hidden="true" />
        </div>
        <div className="mt-3 flex items-center gap-3.5">
          {group.profile_image ? <img src={group.profile_image} alt="" className="h-[76px] w-[76px] shrink-0 rounded-full object-cover ring-4 ring-white/35" />
            : <span className="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-full bg-white text-3xl font-extrabold text-indigo-600 ring-4 ring-white/35">{group.display_name.charAt(0)}</span>}
          <div className="min-w-0">
            <h1 className="line-clamp-2 font-display text-[26px] font-extrabold leading-tight text-white">{group.display_name}</h1>
            <p className="truncate text-sm text-white/90">{[h ? `${h.members.count} member${h.members.count === 1 ? '' : 's'}` : null, h?.tagline].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
        <div className="mt-4 flex gap-2.5">
          <Link to={`/resources/${group.id}`} className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-full bg-white text-sm font-bold text-indigo-800"><Icon d={ICONS.eye} size={16} /> View page</Link>
          <Link to={`/groups/${group.id}/chat`} className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-full border-[1.5px] border-white/60 bg-white/15 text-sm font-bold text-white"><Icon d={CHAT} size={16} /> Group chat</Link>
        </div>
      </div>
      <div className="px-3 sm:px-0">
        <section aria-label="This month" className="relative -mt-[52px] rounded-[22px] bg-white p-4 shadow-[0_10px_30px_rgba(39,30,110,0.14)]">
          <p className="text-[15px] font-extrabold text-gray-900">This month</p>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {(s ? tiles : Array.from({ length: 4 }, () => null)).map((t, i) => t ? (
              <div key={t.label} className={`flex flex-col gap-1 rounded-2xl p-3 ${t.bg}`}>
                <span className={`text-xs font-bold ${t.fg}`}>{t.label}</span>
                <span className={`text-2xl font-extrabold ${t.val}`}>{t.value}</span>
                <span className={`text-xs font-semibold ${t.t?.tone ?? 'text-gray-600'}`}>{t.t?.text ?? '\u00a0'}</span>
              </div>
            ) : <div key={i} className="h-[92px] animate-pulse rounded-2xl bg-gray-100" />)}
          </div>
        </section>
        {attention.length > 0 && (
          <section aria-label="Needs attention" className="mt-5 flex flex-col gap-2.5">
            <p className="text-[15px] font-extrabold text-gray-900">Needs attention</p>
            {attention.map((a) => (
              <button key={a.key} onClick={a.go} className="flex min-h-[56px] items-center gap-3 rounded-2xl bg-white px-3.5 py-2.5 text-left shadow-[0_2px_10px_rgba(39,30,110,0.06)]">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${a.tone}`}><Icon d={a.icon} /></span>
                <span className="flex-1 text-sm font-semibold text-gray-900">{a.text}</span>
                <span className="text-[13px] font-extrabold text-gray-800">{a.cta}</span>
              </button>
            ))}
          </section>
        )}
        {quick.length > 0 && (
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
        )}
        <section aria-label="Group areas" className="mt-6 flex flex-col gap-3">
          <p className="text-[15px] font-extrabold text-gray-900">Your group</p>
          {musicOn && (
            <button onClick={() => onOpen('music')} className="flex flex-col gap-3 rounded-[20px] bg-[#1E1B4B] p-4 text-left text-white">
              <span className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-base font-extrabold text-white"><Icon d={ICONS.music} /> Music</span>
                <span className="text-[13px] font-semibold text-indigo-200">{h ? `${h.music.songs} song${h.music.songs === 1 ? '' : 's'} · ${h.music.albums} album${h.music.albums === 1 ? '' : 's'}` : '…'}</span>
              </span>
              <span className="flex items-center gap-2.5">
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[conic-gradient(from_0deg,#4F46E5,#14B8A6,#F59E0B,#EC4899,#4F46E5)] ring-[3px] ring-white/15" aria-hidden="true"><span className="h-[18px] w-[18px] rounded-full bg-[#F4F3FA]" /></span>
                {(h?.music.covers ?? []).slice(0, 2).map((c) => <img key={c} src={c} alt="" className="h-16 w-16 shrink-0 rounded-[14px] object-cover" />)}
                <span className="flex min-w-0 flex-1 flex-col items-end"><span className="whitespace-nowrap text-[22px] font-extrabold text-white">{h ? num(h.stats.plays_total) : '…'}</span><span className="text-xs text-indigo-200">plays</span></span>
              </span>
            </button>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Card area="members" icon={GROUP} tone="bg-teal-100 text-teal-700" title="Members">
              <span className="flex -space-x-2">{(h?.members.photos ?? []).slice(0, 4).map((p) => <img key={p} src={p} alt="" className="h-7 w-7 rounded-full object-cover ring-2 ring-white" />)}</span>
              <span className="text-xs text-gray-600">{h ? `${h.members.count} member${h.members.count === 1 ? '' : 's'}` : '…'}</span>
            </Card>
            <Card area="payouts" icon={ICONS.card} tone="bg-amber-100 text-amber-800" title="Payouts & splits">
              <span className="text-xs leading-snug text-gray-600">{h?.members.not_connected ? `${h.members.not_connected} need to connect` : 'Everyone with a share is connected'}</span>
            </Card>
            <Card area="bookings" icon={ICONS.calendar} tone="bg-pink-100 text-pink-700" title="Bookings">
              <span className="text-xs leading-snug text-gray-600">{h?.next_booking ? <>Next: {h.next_booking.title}<br />{new Date(h.next_booking.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</> : 'No upcoming bookings'}</span>
            </Card>
            <Card area="media" icon={ICONS.image} tone="bg-indigo-100 text-indigo-700" title="Media">
              {h?.media.length ? <span className="grid grid-cols-3 gap-1">{h.media.map((u) => <img key={u} src={u} alt="" className="h-[30px] w-full rounded-md object-cover" />)}</span> : <span className="text-xs text-gray-600">Photos, videos, music &amp; links</span>}
            </Card>
            <Card area="posts" icon={POST} tone="bg-violet-100 text-violet-700" title="Posts">
              <span className="text-xs leading-snug text-gray-600">Updates on the group&apos;s page</span>
            </Card>
            <Card area="settings" icon={GEAR} tone="bg-gray-100 text-gray-700" title={isAdmin ? 'Settings' : 'My membership'}>
              <span className="text-xs leading-snug text-gray-600">{isOwner ? 'Profile, announcements, delete group' : isAdmin ? 'Profile and announcements' : 'Your title, leave group'}</span>
            </Card>
          </div>
        </section>
        {h && h.activity.length > 0 && (
          <section aria-label="Recent activity" className="mb-6 mt-6">
            <p className="text-[15px] font-extrabold text-gray-900">Recent activity</p>
            <ul className="mt-2.5 divide-y divide-[#EEEDF6] rounded-[20px] bg-white shadow-[0_2px_10px_rgba(39,30,110,0.06)]">
              {h.activity.map((a, i) => { const [ic, tone] = actIcon[a.kind] ?? [ICONS.chart, 'bg-gray-100 text-gray-700']; return (
                <li key={i} className="flex items-center gap-3 px-3.5 py-3">
                  <span className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full ${tone}`}><Icon d={ic} size={16} /></span>
                  <span className="flex-1 text-[13px] leading-snug text-gray-900">{a.text}</span>
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
