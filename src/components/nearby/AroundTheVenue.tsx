import { useCallback, useEffect, useState } from 'react';
import PremiumBadge from '../business/PremiumBadge';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';

// Event page: "Make a night of it" — places near the venue. Anyone signed in can save their own picks (only they
// see them); the event's organizers can recommend up to 3 places to everyone ("Our pick").
interface Place { id: string; name: string; category: 'eat' | 'drink' | 'coffee' | 'parking' | 'stay'; kind: string | null; distance_m: number | null; hours: string | null; website: string | null; phone: string | null; address: string | null; lat: number; lng: number; pinned: boolean; hidden: boolean; source?: string; rating?: number | null; rating_count?: number | null; price_level?: string | null; saved?: boolean; photo_url?: string | null }
const CATS: { id: Place['category']; label: string; icon: string }[] = [
  { id: 'eat', label: 'Eat', icon: '🍽️' }, { id: 'drink', label: 'Drink', icon: '🍸' }, { id: 'coffee', label: 'Coffee', icon: '☕' }, { id: 'parking', label: 'Parking', icon: '🅿️' }, { id: 'stay', label: 'Stay', icon: '🛏️' },
];
// Google hours come as one line per weekday ("Monday: 11 AM – 9 PM | Tuesday: ..."); show today's.
const todayHours = (p: Place) => {
  if (!p.hours) return null;
  if (p.source !== 'google') return p.hours;
  const day = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const line = p.hours.split(' | ').find((l) => l.startsWith(day));
  return line ? `Today: ${line.slice(day.length + 1).trim()}` : null;
};
const walk = (m: number | null) => (m == null ? '' : m < 120 ? 'Steps away' : `${Math.max(1, Math.round(m / 80))} min walk`);

export default function AroundTheVenue({ eventId }: { eventId: string }) {
  const { user } = useAuth();
  const [d, setD] = useState<{ enabled: boolean; fetched: boolean; can_manage: boolean; can_recommend?: boolean; enhanced?: boolean; places: Place[] } | null>(null);
  const [cat, setCat] = useState<Place['category'] | null>(null);
  const load = useCallback(async () => {
    const { data } = await supabase.rpc('event_nearby', { p_event_id: eventId });
    const r = (data ?? null) as typeof d;
    setD(r);
    return r;
  }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    (async () => {
      const r = await load();
      if (r && !r.fetched) { await supabase.functions.invoke('nearby-places', { body: { event_id: eventId } }); load(); }
    })();
  }, [eventId, load]);
  if (!d || (!d.enabled && !d.can_manage)) return null;
  const places = d.places ?? [];
  const cats = CATS.filter((c) => places.some((p) => p.category === c.id && (!p.hidden || d.can_manage)));
  const active = cat && cats.some((c) => c.id === cat) ? cat : cats[0]?.id ?? null;
  // Your saved places first (only you see them), then the organizer's picks, then nearest.
  const shown = places.filter((p) => p.category === active)
    .sort((a, b) => Number(!!b.saved) - Number(!!a.saved) || Number(!!b.pinned) - Number(!!a.pinned) || (a.distance_m ?? 1e9) - (b.distance_m ?? 1e9))
    .slice(0, 8);
  const save = async (p: Place) => {
    const { data, error } = await supabase.rpc('toggle_nearby_save', { p_place_id: p.id });
    if (error) return window.alert(error.message);
    setD((x) => (x ? { ...x, places: x.places.map((q) => (q.id === p.id ? { ...q, saved: data === true } : q)) } : x));
  };
  const pin = async (p: Place) => { const { error } = await supabase.rpc('set_nearby_place', { p_place_id: p.id, p_pinned: !p.pinned, p_hidden: null }); if (error) window.alert(error.message); load(); };
  const hide = async (p: Place) => { await supabase.rpc('set_nearby_place', { p_place_id: p.id, p_pinned: null, p_hidden: !p.hidden }); load(); };
  const toggleSection = async () => { await supabase.rpc('set_nearby_enabled', { p_event_id: eventId, p_on: !d.enabled }); load(); };
  if (!places.length && !d.can_manage) return null;
  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="font-display text-xl font-bold text-gray-900">Make a night of it</h2>
        {d.can_manage && <button onClick={toggleSection} className="text-xs font-medium text-gray-500">{d.enabled ? 'Hide this section' : 'Show this section'}</button>}
      </div>
      <div>
        {d.can_manage && d.enhanced && <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">✨ Enhanced places (ratings, hours and price) <PremiumBadge feature="nearby_plus" /></p>}
      </div>
      {d.can_manage && <p className="mt-1 text-xs text-gray-500">Only your team sees these controls. Hide places you don't recommend; the event's organizer and Admins can also recommend up to 3 places to everyone (they show as Our pick).{!d.enabled && ' This section is hidden from attendees.'}</p>}
      {!places.length ? <p className="mt-2 text-sm text-gray-500">{d.fetched ? 'No nearby places found yet.' : 'Finding places nearby…'}</p> : (
        <>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist">
            {cats.map((c) => (
              <button key={c.id} role="tab" aria-selected={active === c.id} onClick={() => setCat(c.id)}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium ${active === c.id ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 bg-white text-gray-700'}`}>{c.icon} {c.label}</button>
            ))}
          </div>
          <ul className="mt-3 flex flex-col gap-2">
            {shown.map((p) => (
              <li key={p.id} className={`rounded-2xl border bg-white p-3 ${p.pinned || p.saved ? 'border-[#C9A227]' : 'border-gray-200'} ${p.hidden ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  {p.photo_url && <img src={p.photo_url} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-xl object-cover" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gray-900">{p.name}{p.saved && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 align-middle text-[10px] font-bold text-amber-800">★ YOUR PICK</span>}{p.pinned && <span className="ml-2 rounded-full bg-[#C9A227] px-2 py-0.5 align-middle text-[10px] font-bold text-[#0F1B3D]">OUR PICK</span>}</p>
                    {(p.rating != null || p.price_level) && <p className="text-sm text-gray-700">{p.rating != null && <><span className="text-amber-500" aria-hidden="true">★</span> {p.rating.toFixed(1)}{p.rating_count ? <span className="text-gray-400"> ({p.rating_count.toLocaleString()})</span> : null}</>}{p.rating != null && p.price_level ? ' · ' : ''}{p.price_level}</p>}
                    <p className="truncate text-sm text-gray-500">{[p.kind, walk(p.distance_m), p.address].filter(Boolean).join(' · ')}</p>
                    {todayHours(p) && <p className="truncate text-xs text-gray-400">{p.source === 'google' ? todayHours(p) : `Hours: ${todayHours(p)}`}</p>}
                  </div>
                  <a href={`https://maps.google.com/?daddr=${p.lat},${p.lng}`} target="_blank" rel="noopener" className="shrink-0 rounded-xl border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-800">Directions</a>
                </div>
                {(p.website || d.can_manage || user) && (
                  <div className="mt-1.5 flex flex-wrap gap-x-4 text-xs">
                    {p.website && <a href={p.website.startsWith('http') ? p.website : `https://${p.website}`} target="_blank" rel="noopener" className="font-medium text-marigold">Website</a>}
                    {user && <button onClick={() => save(p)} className={`font-medium ${p.saved ? 'text-amber-700' : 'text-gray-600'}`} aria-pressed={!!p.saved}>{p.saved ? '★ Saved' : '☆ Save'}</button>}
                    {d.can_recommend && <button onClick={() => pin(p)} className="font-medium text-gray-600">{p.pinned ? 'Stop recommending' : '📌 Recommend to everyone'}</button>}
                    {d.can_manage && <button onClick={() => hide(p)} className="text-gray-500">{p.hidden ? 'Show' : 'Hide'}</button>}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-gray-400">
            {shown.some((p) => p.source === 'google') && <span className="font-medium">Powered by Google. </span>}
            {shown.some((p) => p.source !== 'google') && <>Places from © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener" className="underline">OpenStreetMap</a> contributors. </>}
            Check hours before you go.
          </p>
        </>
      )}
    </section>
  );
}
