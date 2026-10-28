import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

// Artist & vendor dashboard home (preview): who you are, what needs your attention, quick-add buttons, and a card for
// each area. Cards and quick-adds open the area (onOpen) with a back button to here.
export type Area = 'Bookings' | 'Music' | 'Media' | 'Products' | 'Stats';
export type QuickAdd = 'song' | 'album' | 'product' | 'media';
interface Props {
  resource: { id: string; display_name: string; profile_image?: string | null };
  pendingBookings: number;
  upcomingBookings: number;
  unreadMessages: number;
  payoutsReady: boolean | null;
  musicOn: boolean;
  onOpen: (area: Area, quick?: QuickAdd) => void;
}
export default function ArtistHome({ resource, pendingBookings, upcomingBookings, unreadMessages, payoutsReady, musicOn, onOpen }: Props) {
  const [music, setMusic] = useState<{ songs: number; plays: number; sales: number; earned: number } | null>(null);
  const [products, setProducts] = useState<number | null>(null);
  useEffect(() => {
    if (musicOn) supabase.rpc('manage_tracks', { p_resource_id: resource.id }).then(({ data }) => {
      const d = (data ?? {}) as { tracks?: { plays: number; status: string }[]; sales?: { count: number; total: number } };
      const act = (d.tracks ?? []).filter((t) => t.status === 'active');
      setMusic({ songs: act.length, plays: act.reduce((n, t) => n + (t.plays || 0), 0), sales: d.sales?.count ?? 0, earned: Number(d.sales?.total ?? 0) });
    });
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('resource_id', resource.id).eq('is_active', true).then(({ count }) => setProducts(count ?? 0));
  }, [resource.id, musicOn]);

  const attention: { key: string; text: string; cta: string; go: () => void; tone: string }[] = [];
  if (pendingBookings > 0) attention.push({ key: 'b', text: `${pendingBookings} booking request${pendingBookings === 1 ? '' : 's'} waiting for your answer`, cta: 'Review', go: () => onOpen('Bookings'), tone: 'border-orange-200 bg-orange-50 text-orange-900' });
  if (unreadMessages > 0) attention.push({ key: 'm', text: `${unreadMessages} unread message${unreadMessages === 1 ? '' : 's'} about bookings`, cta: 'Open', go: () => onOpen('Bookings'), tone: 'border-indigo-200 bg-indigo-50 text-indigo-900' });
  if (payoutsReady === false) attention.push({ key: 'p', text: 'Connect payouts to get paid for bookings, music and products', cta: 'Connect', go: () => { window.location.href = '/profile#payouts'; }, tone: 'border-amber-200 bg-amber-50 text-amber-900' });

  const quick: { key: QuickAdd; label: string; icon: string; area: Area }[] = [
    ...(musicOn ? [{ key: 'song' as const, label: 'Song', icon: '🎵', area: 'Music' as const }, { key: 'album' as const, label: 'Album', icon: '💿', area: 'Music' as const }] : []),
    { key: 'product', label: 'Product', icon: '🛍️', area: 'Products' },
    { key: 'media', label: 'Photo or video', icon: '📸', area: 'Media' },
  ];
  const cards: { area: Area; icon: string; title: string; line: string }[] = [
    { area: 'Bookings', icon: '📅', title: 'Bookings', line: pendingBookings ? `${pendingBookings} waiting · ${upcomingBookings} upcoming` : `${upcomingBookings} upcoming` },
    ...(musicOn ? [{ area: 'Music' as const, icon: '🎵', title: 'Music', line: music ? `${music.songs} song${music.songs === 1 ? '' : 's'} · ${music.plays} play${music.plays === 1 ? '' : 's'}${music.sales ? ` · $${music.earned.toFixed(2)} earned` : ''}` : '…' }] : []),
    { area: 'Products', icon: '🛍️', title: 'Shop', line: products === null ? '…' : `${products} product${products === 1 ? '' : 's'}` },
    { area: 'Media', icon: '📸', title: 'Photos & videos', line: 'Your gallery' },
    { area: 'Stats', icon: '📊', title: 'Stats', line: 'Views, followers and more' },
  ];
  return (
    <div className="mt-4 flex flex-col gap-5">
      <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4">
        {resource.profile_image ? <img src={resource.profile_image} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" /> : <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xl font-bold text-indigo-700">{resource.display_name.charAt(0)}</span>}
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-bold text-gray-900">{resource.display_name}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            <Link to={`/resources/${resource.id}`} className="inline-flex min-h-[36px] items-center rounded-full bg-[#0F1B3D] px-3 text-xs font-semibold text-white">View public profile</Link>
            <Link to="/resources/new" className="inline-flex min-h-[36px] items-center rounded-full border border-gray-300 px-3 text-xs font-medium text-gray-700">Edit profile</Link>
          </div>
        </div>
      </div>
      {attention.length > 0 && (
        <section aria-label="Needs your attention">
          <p className="mb-2 text-sm font-semibold text-gray-900">Needs your attention</p>
          <div className="flex flex-col gap-2">
            {attention.map((a) => (
              <button key={a.key} onClick={a.go} className={`flex min-h-[52px] items-center justify-between gap-3 rounded-xl border px-3 text-left text-sm ${a.tone}`}>
                <span>{a.text}</span><span className="shrink-0 font-semibold">{a.cta} ›</span>
              </button>
            ))}
          </div>
        </section>
      )}
      <section aria-label="Add">
        <p className="mb-2 text-sm font-semibold text-gray-900">Add</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {quick.map((q) => (
            <button key={q.key} onClick={() => onOpen(q.area, q.key)} className="flex min-h-[64px] flex-col items-center justify-center rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-800 hover:border-marigold">
              <span className="text-xl" aria-hidden="true">{q.icon}</span>+ {q.label}
            </button>
          ))}
        </div>
      </section>
      <section aria-label="Your areas" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {cards.map((c) => (
          <button key={c.area} onClick={() => onOpen(c.area)} className="flex min-h-[72px] items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 text-left hover:border-marigold">
            <span className="text-2xl" aria-hidden="true">{c.icon}</span>
            <span className="min-w-0 flex-1"><span className="block font-semibold text-gray-900">{c.title}</span><span className="block truncate text-xs text-gray-500">{c.line}</span></span>
            <span className="text-gray-400" aria-hidden="true">›</span>
          </button>
        ))}
      </section>
    </div>
  );
}
