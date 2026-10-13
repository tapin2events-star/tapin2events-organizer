import { useEffect, useState } from 'react';
import OrgFollowButton from '../../components/business/OrgFollowButton';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import BusinessGate from '../../components/business/BusinessGate';
import EventCover from '../../components/EventCover';
import { DEFAULT_BRAND, loadFont, type Organization } from '../../lib/business';

// An organization's public page, in its own brand: logo, cover, about, and its events.
export default function OrgPublic() {
  return <BusinessGate><OrgPublicInner /></BusinessGate>;
}

function OrgPublicInner() {
  const { slug = '' } = useParams<{ slug: string }>();
  const [org, setOrg] = useState<Organization | null | undefined>(undefined);
  const [events, setEvents] = useState<{ id: string; title: string; start_date: string | null; location_name: string | null; poster_url: string | null; category: string | null }[]>([]);
  const [canManage, setCanManage] = useState(false);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('organizations').select('*').eq('slug', slug).maybeSingle();
      const o = data ? ({ ...data, brand: { ...DEFAULT_BRAND, ...(data.brand ?? {}) } } as Organization) : null;
      setOrg(o);
      if (!o) return;
      loadFont(o.brand.font);
      const [{ data: ev }, { data: role }] = await Promise.all([
        supabase.from('events').select('id, title, start_date, location_name, poster_url, category').eq('organization_id', o.id).neq('status', 'cancelled').gte('start_date', new Date(Date.now() - 86400000).toISOString()).order('start_date'),
        supabase.rpc('org_role', { p_org: o.id }),
      ]);
      setEvents((ev ?? []) as typeof events);
      setCanManage(role === 'owner' || role === 'admin');
    })();
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  if (org === undefined) return <p className="text-sm text-muted">Loading…</p>;
  if (!org) return <p className="mt-10 text-center text-sm text-muted">This organization page doesn't exist.</p>;
  const b = org.brand;
  const dark = b.theme === 'dark';
  return (
    <div className="-mx-4 -mt-4 min-h-screen sm:-mx-6" style={{ fontFamily: `'${b.font}', system-ui, sans-serif`, background: dark ? '#0B1020' : '#fff', color: dark ? '#E5E7EB' : '#111827' }}>
      <div className="relative h-44 w-full sm:h-60" style={{ background: org.cover_url ? undefined : `linear-gradient(135deg, ${b.primary}, ${b.accent})` }}>
        {org.cover_url && <img src={org.cover_url} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="mx-auto max-w-4xl px-6">
        <div className="relative z-10 -mt-12 flex items-end justify-between gap-3 sm:-mt-14">
          {org.logo_url ? <img src={org.logo_url} alt="" className="h-24 w-24 shrink-0 rounded-3xl border-4 bg-white object-cover shadow-md sm:h-28 sm:w-28" style={{ borderColor: dark ? '#0B1020' : '#fff' }} /> : <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl border-4 text-3xl font-bold text-white shadow-md sm:h-28 sm:w-28" style={{ background: b.primary, borderColor: dark ? '#0B1020' : '#fff' }}>{org.name.charAt(0)}</span>}
          <div className="mb-1 flex flex-wrap items-center justify-end gap-2">
            {canManage && <Link to={`/business/${org.slug}/manage`} className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm">Manage</Link>}
            <OrgFollowButton orgId={org.id} color={b.primary} />
          </div>
        </div>
        <div className="mt-3 min-w-0">
          <h1 className="break-words text-2xl font-extrabold leading-tight sm:text-3xl">{org.name}{org.verified && <span className="ml-2 text-xl" style={{ color: b.accent }} title="Verified">✓</span>}</h1>
          <p className="mt-0.5 text-sm opacity-70">{org.kind === 'nonprofit' ? 'Nonprofit' : org.kind === 'community' ? 'Community group' : 'Organization'}{org.city ? ` · ${org.city}${org.state ? `, ${org.state}` : ''}` : ''}</p>
        </div>
        {org.tagline && <p className="mt-5 text-lg font-medium">{org.tagline}</p>}
        {org.description && <p className="mt-3 whitespace-pre-wrap leading-relaxed opacity-80">{org.description}</p>}
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          {org.website && <a href={org.website} target="_blank" rel="noopener noreferrer" className="font-medium" style={{ color: b.accent }}>Website ↗</a>}
          {org.contact_email && <a href={`mailto:${org.contact_email}`} className="font-medium" style={{ color: b.accent }}>Contact</a>}
        </div>

        <h2 className="mt-10 text-xl font-bold">Upcoming events</h2>
        {events.length === 0 ? <p className="mt-2 pb-10 text-sm opacity-70">No upcoming events right now.</p> : (
          <div className="mt-4 grid gap-4 pb-10 sm:grid-cols-2">
            {events.map((e) => (
              <Link key={e.id} to={`/events/${e.id}`} className="overflow-hidden rounded-2xl border transition hover:shadow-md" style={{ borderColor: dark ? '#1F2937' : '#E5E7EB' }}>
                {e.poster_url ? <img src={e.poster_url} alt="" className="h-40 w-full object-cover" /> : <EventCover category={e.category} title={e.title} className="h-40 w-full" />}
                <div className="p-4">
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: b.accent }}>{e.start_date ? new Date(e.start_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Date TBA'}</p>
                  <p className="mt-1 font-semibold">{e.title}</p>
                  {e.location_name && <p className="text-sm opacity-70">{e.location_name}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
        <OrgGallery orgId={org.id} accent={b.accent} dark={dark} />
        <PastEvents orgId={org.id} accent={b.accent} dark={dark} />
      </div>
    </div>
  );
}

// Photo gallery (up to 24); tap a photo to see it full size.
function OrgGallery({ orgId }: { orgId: string; accent?: string; dark?: boolean }) {
  const [photos, setPhotos] = useState<{ id: string; url: string; caption: string | null }[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    supabase.from('organization_media').select('id, url, caption').eq('org_id', orgId).order('sort_order').order('created_at')
      .then(({ data }) => setPhotos((data ?? []) as { id: string; url: string; caption: string | null }[]));
  }, [orgId]);
  if (photos.length === 0) return null;
  const cur = open === null ? null : photos[open];
  return (
    <section className="pb-10">
      <h2 className="text-xl font-bold">Photos</h2>
      <div className="mt-4 grid grid-cols-3 gap-1.5 sm:gap-2">
        {photos.map((p, i) => (
          <button key={p.id} onClick={() => setOpen(i)} className="overflow-hidden rounded-xl" aria-label={p.caption || `Photo ${i + 1}`}>
            <img src={p.url} alt={p.caption ?? ''} className="aspect-square w-full object-cover transition hover:scale-105" loading="lazy" />
          </button>
        ))}
      </div>
      {cur && open !== null && (
        <div className="fixed inset-0 z-[1100] flex flex-col items-center justify-center bg-black/90 p-4" onClick={() => setOpen(null)} role="dialog" aria-label="Photo">
          <img src={cur.url} alt={cur.caption ?? ''} className="max-h-[80dvh] max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
          {cur.caption && <p className="mt-3 text-center text-sm text-white/90">{cur.caption}</p>}
          <div className="mt-4 flex gap-3" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setOpen((open - 1 + photos.length) % photos.length)} className="rounded-full bg-white/15 px-4 py-2 text-white" aria-label="Previous">←</button>
            <span className="self-center text-sm text-white/70">{open + 1} / {photos.length}</span>
            <button onClick={() => setOpen((open + 1) % photos.length)} className="rounded-full bg-white/15 px-4 py-2 text-white" aria-label="Next">→</button>
          </div>
          <button onClick={() => setOpen(null)} className="absolute right-4 top-[calc(1rem+env(safe-area-inset-top,0px))] rounded-full bg-white/15 px-3 py-1.5 text-white" aria-label="Close">✕</button>
        </div>
      )}
    </section>
  );
}

// Past events, automatically: the organization's most recent finished public events.
function PastEvents({ orgId, accent, dark }: { orgId: string; accent: string; dark: boolean }) {
  const [events, setEvents] = useState<{ id: string; title: string; start_date: string | null; poster_url: string | null; category: string | null }[]>([]);
  useEffect(() => {
    supabase.from('events').select('id, title, start_date, poster_url, category').eq('organization_id', orgId).in('status', ['published', 'completed'])
      .eq('is_test', false).is('parent_event_id', null).lt('start_date', new Date().toISOString()).order('start_date', { ascending: false }).limit(6)
      .then(({ data }) => setEvents((data ?? []) as typeof events));
  }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (events.length === 0) return null;
  return (
    <section className="pb-16">
      <h2 className="text-xl font-bold">Past events</h2>
      <div className="-mx-4 mt-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
        {events.map((e) => (
          <Link key={e.id} to={`/events/${e.id}`} className="w-56 shrink-0 snap-start overflow-hidden rounded-2xl border" style={{ borderColor: dark ? '#1F2937' : '#E5E7EB' }}>
            {e.poster_url ? <img src={e.poster_url} alt="" className="h-28 w-full object-cover" /> : <EventCover category={e.category} title={e.title} className="h-28 w-full" />}
            <div className="p-3">
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: accent }}>{e.start_date ? new Date(e.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</p>
              <p className="mt-0.5 line-clamp-2 text-sm font-semibold">{e.title}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
