import { useCallback, useEffect, useState } from 'react';
import { useFeature } from '../../lib/preview';
import { useMyMusicCount } from '../music/MyMusicCard';
import ProfileLink from '../ProfileLink';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

interface Parts {
  resources: { id: string; name: string; image: string | null; categories: string[] | null; status: string | null }[];
  orgs: { id: string; name: string; slug: string; logo: string | null; role: string }[];
  networking: { title: string | null; company: string | null; intro: string | null; public: boolean };
  events: number; groups: number; promoter_links: number;
}
const card = 'rounded-2xl border border-gray-200 bg-surface p-4';
const roleLabel: Record<string, string> = { owner: 'Owner', admin: 'Admin', editor: 'Editor', member: 'Member', viewer: 'Viewer' };

// Profile > "Your profile": one place for every part of someone's TapIN presence (artist/services, networking card,
// organizations, organizing), each turned on when needed, plus a tidy "My stuff" list.
export default function YourProfile({ userId, email, savedCount, vendorAppCounts, networkingOn }: {
  userId: string; email: string; savedCount: number; vendorAppCounts: { needsPayment: number; pending: number }; networkingOn: boolean;
}) {
  const managersOn = useFeature('profile_managers');
  const [managedCount, setManagedCount] = useState(0);
  useEffect(() => { if (managersOn) supabase.rpc('my_managed_profiles').then(({ data }) => setManagedCount(((data ?? []) as unknown[]).length)); }, [managersOn]);
  const musicCount = useMyMusicCount();
  const [p, setP] = useState<Parts | null>(null);
  const load = useCallback(async () => { const { data } = await supabase.rpc('my_profile_parts'); setP((data ?? null) as Parts | null); }, []);
  useEffect(() => { load(); }, [load]);
  async function togglePublicCard() {
    if (!p) return;
    await supabase.from('profiles').update({ show_pro_public: !p.networking.public }).eq('id', userId);
    load();
  }
  if (!p) return <div className="mt-6 h-40 animate-pulse rounded-2xl bg-gray-100" />;
  const hasCard = !!(p.networking.title || p.networking.intro);
  return (
    <>
      <section className="mt-6" aria-labelledby="your-profile">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="your-profile" className="font-display text-lg font-bold text-bone">Your profile</h2>
            <p className="text-sm text-muted">One TapIN profile. Turn on the parts you need; your public profile shows them together.</p>
          </div>
          <ProfileLink email={email} className="text-sm font-medium text-marigold">View public profile ›</ProfileLink>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {/* Artist & services */}
          <div className={card}>
            <p className="font-semibold text-bone">🎤 Artist & services</p>
            {p.resources.length ? (
              <ul className="mt-2 flex flex-col gap-2">
                {p.resources.map((r) => (
                  <li key={r.id} className="flex items-center gap-3">
                    {r.image ? <img src={r.image} alt="" className="h-10 w-10 rounded-xl object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-200 text-lg">🎤</span>}
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-bone">{r.name}</span><span className="block truncate text-xs text-muted">{(r.categories ?? []).slice(0, 2).join(' · ') || 'Profile'}</span></span>
                    <Link to={`/resources/${r.id}`} className="text-xs font-medium text-marigold">View</Link>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-1 text-sm text-muted">Get booked, sell merch and get paid as an artist, performer or service provider.</p>}
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              {p.resources.length
                ? <Link data-tour="artist-edit" to="/resources/dashboard" className="rounded-xl bg-[#0F1B3D] px-3 py-2 font-semibold text-white">Bookings & edit</Link>
                : <Link data-tour="artist-turn-on" to="/resources/new" className="rounded-xl bg-marigold px-3 py-2 font-semibold text-white">Turn on</Link>}
              {p.groups > 0 && <Link to="/groups" className="rounded-xl border border-gray-300 bg-white px-3 py-2 font-medium text-gray-700">Artist groups ({p.groups})</Link>}
              {managersOn && <Link to="/resources/dashboard#managers" className="rounded-xl border border-gray-300 bg-white px-3 py-2 font-medium text-gray-700">Profiles I manage{managedCount ? ` (${managedCount})` : ''}</Link>}
            </div>
          </div>

          {/* Networking card */}
          <div className={card}>
            <p className="font-semibold text-bone">🤝 Networking card</p>
            {hasCard ? (
              <>
                <p className="mt-1 text-sm text-bone">{[p.networking.title, p.networking.company].filter(Boolean).join(' · ') || 'Your card'}</p>
                {p.networking.intro && <p className="line-clamp-2 text-xs text-muted">"{p.networking.intro}"</p>}
                <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={p.networking.public} onChange={togglePublicCard} className="h-4 w-4 accent-marigold" /> Show on my public profile
                </label>
              </>
            ) : <p className="mt-1 text-sm text-muted">Your title, company and what you're looking for, for meeting people at events.</p>}
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <Link to="/connections" className={`rounded-xl px-3 py-2 font-semibold ${hasCard ? 'border border-gray-300 bg-white text-gray-700' : 'bg-marigold text-white'}`}>{hasCard ? 'Edit card' : 'Turn on'}</Link>
              {networkingOn && hasCard && <Link to="/connections" className="rounded-xl border border-gray-300 bg-white px-3 py-2 font-medium text-gray-700">People I've met</Link>}
            </div>
          </div>

          {/* Organizations */}
          <div className={card}>
            <p className="font-semibold text-bone">🏢 Organizations</p>
            {p.orgs.length ? (
              <ul className="mt-2 flex flex-col gap-2">
                {p.orgs.map((o) => (
                  <li key={o.id} className="flex items-center gap-3">
                    {o.logo ? <img src={o.logo} alt="" className="h-10 w-10 rounded-xl bg-white object-contain" /> : <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-200 text-lg">🏢</span>}
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-bone">{o.name}</span><span className="block text-xs text-muted">{roleLabel[o.role] ?? o.role}</span></span>
                    <Link to={`/business/${o.slug}/manage`} className="text-xs font-medium text-marigold">Manage</Link>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-1 text-sm text-muted">A page for your group or business, with team tools and an audience.</p>}
            <div className="mt-3 text-sm"><Link to="/business" className={`inline-block rounded-xl px-3 py-2 font-semibold ${p.orgs.length ? 'border border-gray-300 bg-white text-gray-700' : 'bg-marigold text-white'}`}>{p.orgs.length ? 'TapIN for Business' : 'Turn on'}</Link></div>
          </div>

          {/* Organizing */}
          <div className={card}>
            <p className="font-semibold text-bone">📅 Organizing</p>
            <p className="mt-1 text-sm text-muted">{p.events ? `${p.events} event${p.events === 1 ? '' : 's'} you organize.` : 'Sell tickets and run your own events.'}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              {p.events ? <Link to="/organizer" className="rounded-xl bg-[#0F1B3D] px-3 py-2 font-semibold text-white">Organizer Dashboard</Link> : <Link to="/organizer/new" className="rounded-xl bg-marigold px-3 py-2 font-semibold text-white">Create an event</Link>}
              {p.promoter_links > 0 && <Link to="/promoter" className="rounded-xl border border-gray-300 bg-white px-3 py-2 font-medium text-gray-700">My promoter links</Link>}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8" aria-labelledby="my-stuff">
        <h2 id="my-stuff" className="font-display text-lg font-bold text-bone">My stuff</h2>
        <ul className="mt-2 divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-surface">
          {[
            { to: '/activity', label: 'My tickets & activity' },
            { to: '/saved', label: 'Saved events', badge: savedCount ? String(savedCount) : '' },
            { to: '/products?tab=orders', label: 'My orders' },
            ...(musicCount !== null ? [{ to: '/my-music', label: 'My music', badge: musicCount ? String(musicCount) : '' }] : []),
            { to: '/vendor-applications', label: 'My vendor applications', badge: vendorAppCounts.needsPayment ? `${vendorAppCounts.needsPayment} needs payment` : vendorAppCounts.pending ? `${vendorAppCounts.pending} pending` : '' },
          ].map((l) => (
            <li key={l.to}><Link to={l.to} className="flex items-center justify-between gap-2 px-4 py-3 text-sm text-bone hover:bg-gray-50">
              <span>{l.label}</span>
              <span className="flex items-center gap-2">{l.badge && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-marigold">{l.badge}</span>}<span className="text-gray-400" aria-hidden="true">›</span></span>
            </Link></li>
          ))}
        </ul>
      </section>
    </>
  );
}
