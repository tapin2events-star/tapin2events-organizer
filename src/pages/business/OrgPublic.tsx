import { useEffect, useState } from 'react';
import { OrgAlbumsSection } from '../../components/business/OrgAlbums';
import HeaderVideo, { ProcessingLabel, useHeaderVideo, useHeaderVideoProcessing } from '../../components/video/HeaderVideo';
import { cachedRole, loadRole } from '../../lib/orgFollows';
import { useFeature } from '../../lib/preview';
import { ListSkeleton } from '../../components/ui/Skeleton';
import { cachedOrg, primeOrg, type CachedOrg } from '../../lib/orgCache';
import OrgFollowButton from '../../components/business/OrgFollowButton';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import BusinessGate from '../../components/business/BusinessGate';
import EventCover from '../../components/EventCover';
import { DEFAULT_BRAND, loadFont, type Organization } from '../../lib/business';

// An organization's public page, in its own brand: logo, cover, about, and its events.
// slugOverride: shown on an organization's own domain (custom domains), where there's no /o/:slug in the address.
export default function OrgPublic({ slugOverride, embedded = false }: { slugOverride?: string; embedded?: boolean } = {}) {
  return <BusinessGate><OrgPublicInner slugOverride={slugOverride} embedded={embedded} /></BusinessGate>;
}

function OrgPublicInner({ slugOverride, embedded = false }: { slugOverride?: string; embedded?: boolean }) {
  const volunteersOn = useFeature('volunteers');
  const videoHeadersOn = useFeature('video_headers');
  const albumsOn = useFeature('org_albums');
  const params = useParams<{ slug: string }>();
  const slug = slugOverride ?? params.slug ?? '';
  const [org, setOrg] = useState<Organization | null | undefined>(() => { const c = cachedOrg(slug); return c ? ({ description: null, website: null, contact_email: null, ...c, brand: { ...DEFAULT_BRAND, ...(c.brand ?? {}) } } as unknown as Organization) : undefined; });
  const [events, setEvents] = useState<{ id: string; title: string; start_date: string | null; location_name: string | null; poster_url: string | null; category: string | null }[]>([]);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const orgVideo = useHeaderVideo(null, org?.id ?? null);
  const orgVideoProcessing = useHeaderVideoProcessing(null, org?.id ?? null);
  const [canManage, setCanManage] = useState<boolean>(() => { const c = cachedOrg(slug) as { id?: string } | null; const r = c?.id ? cachedRole(c.id) : undefined; return r === 'owner' || r === 'admin'; });
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('organizations').select('*').eq('slug', slug).maybeSingle();
      const o = data ? ({ ...data, brand: { ...DEFAULT_BRAND, ...(data.brand ?? {}) } } as Organization) : null;
      setOrg(o);
      if (!o) return;
      primeOrg(o as unknown as CachedOrg);
      loadFont(o.brand.font);
      const [{ data: ev }, role] = await Promise.all([
        supabase.from('events').select('id, title, start_date, location_name, poster_url, category').eq('organization_id', o.id).eq('status', 'published').eq('is_test', false).gte('start_date', new Date(Date.now() - 86400000).toISOString()).order('start_date'),
        loadRole(o.id),
      ]);
      setEvents((ev ?? []) as typeof events); setEventsLoaded(true);
      setCanManage(role === 'owner' || role === 'admin');
    })();
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  if (org === undefined) return (
    <div className="-mx-4 -mt-4 sm:-mx-6" aria-busy="true" aria-label="Loading organization">
      <div className="h-40 animate-pulse bg-gray-200 sm:h-56" />
      <div className="px-4 sm:px-6">
        <div className="-mt-10 h-20 w-20 animate-pulse rounded-2xl border-4 border-white bg-gray-200" />
        <div className="mt-4 h-7 w-56 animate-pulse rounded-lg bg-gray-200" />
        <div className="mt-2 h-4 w-40 animate-pulse rounded bg-gray-100" />
        <div className="mt-6 space-y-2"><div className="h-4 w-full animate-pulse rounded bg-gray-100" /><div className="h-4 w-11/12 animate-pulse rounded bg-gray-100" /><div className="h-4 w-3/4 animate-pulse rounded bg-gray-100" /></div>
      </div>
    </div>
  );
  if (!org) return <p className="mt-10 text-center text-sm text-muted">This organization page doesn't exist.</p>;
  const b = org.brand;
  const dark = b.theme === 'dark';
  return (
    <div className="-mx-4 -mt-4 min-h-screen sm:-mx-6" style={{ fontFamily: `'${b.font}', system-ui, sans-serif`, background: dark ? '#0B1020' : '#fff', color: dark ? '#E5E7EB' : '#111827' }}>
      <div className="relative h-44 w-full sm:h-60 lg:h-80" style={{ background: org.cover_url ? undefined : `linear-gradient(135deg, ${b.primary}, ${b.accent})` }}>
        {orgVideoProcessing && <ProcessingLabel />}
        {orgVideo ? <HeaderVideo src={orgVideo.src} poster={orgVideo.poster ?? org.cover_url ?? null} postId={orgVideo.id} /> : org.cover_url && <img src={org.cover_url} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="mx-auto max-w-4xl px-6">
        <div className="relative z-10 -mt-12 flex items-end justify-between gap-3 sm:-mt-14">
          {org.logo_url ? <img src={org.logo_url} alt="" className="h-24 w-24 shrink-0 rounded-3xl border-4 bg-white object-cover shadow-md sm:h-28 sm:w-28" style={{ borderColor: dark ? '#0B1020' : '#fff' }} /> : <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl border-4 text-3xl font-bold text-white shadow-md sm:h-28 sm:w-28" style={{ background: b.primary, borderColor: dark ? '#0B1020' : '#fff' }}>{org.name.charAt(0)}</span>}
          <div className="mb-1 flex flex-wrap items-center justify-end gap-2">
            {!embedded && canManage && <Link to={`/business/${org.slug}/manage`} className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm">Manage</Link>}
            {embedded
              ? <a href={`https://app.tapin2events.com/o/${org.slug}`} target="_blank" rel="noopener" className="rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm" style={{ background: b.primary }}>Follow on TapIN</a>
              : <OrgFollowButton orgId={org.id} color={b.primary} />}
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
        {events.length === 0 ? !eventsLoaded ? <ListSkeleton rows={2} className="mt-3" /> : <p className="mt-2 pb-10 text-sm opacity-70">No upcoming events right now.</p> : (
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
        <OrgSections orgId={org.id} accent={b.accent} dark={dark} />
        {volunteersOn && <OrgVolunteer orgId={org.id} accent={b.accent} dark={dark} />}
        {videoHeadersOn && <OrgHighlights orgId={org.id} />}
        <OrgGallery orgId={org.id} accent={b.accent} dark={dark} />
        {albumsOn && <OrgAlbumsSection orgId={org.id} />}
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
    supabase.from('organization_media').select('id, url, caption').eq('org_id', orgId).is('album_id', null).order('sort_order').order('created_at')
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
    supabase.from('events').select('id, title, start_date, poster_url, category').eq('organization_id', orgId).in('status', ['published', 'completed']).eq('is_test', false)
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

// Our artists, Videos and Shop, chosen in the organization's Page settings.
function OrgSections({ orgId, accent, dark }: { orgId: string; accent: string; dark: boolean }) {
  const [person, setPerson] = useState<{ name: string; photo: string | null; title?: string | null; bio?: string | null; link?: string | null } | null>(null);
  const [s, setS] = useState<{ roster_heading?: string | null; artists: { id: string; resource_id?: string | null; user_id?: string | null; name: string; photo: string | null; categories: string[] | null; city: string | null; title?: string | null; bio?: string | null; link?: string | null }[]; videos: { id: string; thumbnail: string | null; caption: string | null; author: string | null }[]; products: { id: string; name: string; price: number; image: string | null; seller: string | null }[] } | null>(null);
  useEffect(() => { supabase.rpc('org_page_sections', { p_org_id: orgId }).then(({ data }) => setS((data ?? null) as typeof s)); }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!s) return null;
  const card = dark ? '#111827' : '#FFFFFF';
  const line = dark ? '#1F2937' : '#E5E7EB';
  return (
    <>
      {s.artists.length > 0 && (
        <section className="pb-10">
          <h2 className="text-xl font-bold">{s.roster_heading || 'Our artists'}</h2>
          <div className="-mx-4 mt-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
            {s.artists.map((a) => {
              const inner = (
                <>
                  {a.photo ? <img src={a.photo} alt="" className="mx-auto h-20 w-20 rounded-full object-cover" /> : <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold text-white" style={{ background: accent }}>{a.name.charAt(0)}</span>}
                  <p className="mt-2 truncate text-sm font-semibold">{a.name}</p>
                  <p className="line-clamp-2 text-xs opacity-70">{a.title || (a.categories ?? []).slice(0, 2).join(' · ') || a.city || ''}</p>
                </>
              );
              return a.resource_id
                ? <Link key={a.id} to={`/resources/${a.resource_id}`} className="w-36 shrink-0 snap-start rounded-2xl border p-3 text-center" style={{ background: card, borderColor: line }}>{inner}</Link>
                : a.user_id
                ? <Link key={a.id} to={`/u/${a.user_id}`} className="w-36 shrink-0 snap-start rounded-2xl border p-3 text-center" style={{ background: card, borderColor: line }}>{inner}</Link>
                : <button key={a.id} type="button" onClick={() => setPerson(a)} className="w-36 shrink-0 snap-start rounded-2xl border p-3 text-center" style={{ background: card, borderColor: line }}>{inner}</button>;
            })}
          </div>
        </section>
      )}
      {person && (
        <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={() => setPerson(null)} role="dialog" aria-label={person.name}>
          <div className="w-full max-w-sm rounded-2xl p-5 text-center" style={{ background: card }} onClick={(e) => e.stopPropagation()}>
            {person.photo ? <img src={person.photo} alt="" className="mx-auto h-24 w-24 rounded-full object-cover" /> : <span className="mx-auto flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold text-white" style={{ background: accent }}>{person.name.charAt(0)}</span>}
            <p className="mt-3 text-lg font-bold">{person.name}</p>
            {person.title && <p className="text-sm opacity-75">{person.title}</p>}
            {person.bio && <p className="mt-3 whitespace-pre-line text-left text-sm leading-relaxed opacity-90">{person.bio}</p>}
            <div className="mt-4 flex justify-center gap-2">
              {person.link && <a href={person.link} target="_blank" rel="noopener noreferrer" className="rounded-full px-4 py-2 text-sm font-semibold text-white" style={{ background: accent }}>Learn more ↗</a>}
              <button onClick={() => setPerson(null)} className="rounded-full border px-4 py-2 text-sm" style={{ borderColor: line }}>Close</button>
            </div>
          </div>
        </div>
      )}
      {s.videos.length > 0 && (
        <section className="pb-10">
          <h2 className="text-xl font-bold">Videos</h2>
          <div className="-mx-4 mt-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
            {s.videos.map((v) => (
              <Link key={v.id} to={`/feed?post=${v.id}`} className="relative w-36 shrink-0 snap-start overflow-hidden rounded-2xl" aria-label={v.caption || 'Play video'}>
                {v.thumbnail ? <img src={v.thumbnail} alt="" className="aspect-[9/16] w-full object-cover" loading="lazy" /> : <span className="flex aspect-[9/16] w-full items-center justify-center bg-gray-800 text-3xl">🎬</span>}
                <span className="absolute inset-0 flex items-center justify-center"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-lg text-white">▶</span></span>
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-[11px] leading-tight text-white">{v.caption ? v.caption.slice(0, 60) : v.author}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
      {s.products.length > 0 && (
        <section className="pb-10">
          <h2 className="text-xl font-bold">Shop</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {s.products.map((p) => (
              <Link key={p.id} to={`/products/${p.id}`} className="overflow-hidden rounded-2xl border" style={{ background: card, borderColor: line }}>
                {p.image ? <img src={p.image} alt="" className="aspect-square w-full object-cover" loading="lazy" /> : <span className="flex aspect-square w-full items-center justify-center text-3xl" style={{ background: line }}>🛍️</span>}
                <div className="p-3">
                  <p className="truncate text-sm font-semibold">{p.name}</p>
                  <p className="text-sm font-bold" style={{ color: accent }}>${Number(p.price).toFixed(2).replace(/\.00$/, '')}</p>
                  {p.seller && <p className="truncate text-xs opacity-70">by {p.seller}</p>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

// Open volunteer shifts across the organization's upcoming events (Preview).
function OrgVolunteer({ orgId, accent, dark }: { orgId: string; accent: string; dark: boolean }) {
  const [shifts, setShifts] = useState<{ shift_id: string; event_id: string; event_title: string; role: string; starts_at: string; ends_at: string; spots_left: number }[]>([]);
  useEffect(() => { supabase.rpc('org_open_shifts', { p_org_id: orgId }).then(({ data }) => setShifts((data ?? []) as typeof shifts)); }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = shifts.filter((s) => s.spots_left > 0);
  if (!open.length) return null;
  const card = dark ? '#111827' : '#FFFFFF';
  const line = dark ? '#1F2937' : '#E5E7EB';
  const t = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return (
    <section className="pb-10">
      <h2 className="text-xl font-bold">🙋 Volunteer with us</h2>
      <p className="mt-1 text-sm opacity-75">Help make our events happen. Pick a shift that works for you.</p>
      <ul className="mt-4 flex flex-col gap-2">
        {open.slice(0, 8).map((s) => (
          <li key={s.shift_id}><Link to={`/events/${s.event_id}#volunteer`} className="flex items-center justify-between gap-3 rounded-2xl border p-3" style={{ background: card, borderColor: line }}>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{s.role}</span>
              <span className="block truncate text-xs opacity-70">{s.event_title} · {new Date(s.starts_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}, {t(s.starts_at)}–{t(s.ends_at)}</span>
            </span>
            <span className="shrink-0 rounded-full px-3 py-1 text-xs font-bold text-white" style={{ background: accent }}>{s.spots_left} spot{s.spots_left === 1 ? '' : 's'} left</span>
          </Link></li>
        ))}
      </ul>
      {open.length > 8 && <p className="mt-2 text-xs opacity-70">+ {open.length - 8} more shifts on our event pages</p>}
    </section>
  );
}

// Highlights from past events (Preview): videos posted to the organization's past events.
function OrgHighlights({ orgId }: { orgId: string }) {
  const [items, setItems] = useState<{ id: string; thumbnail: string | null; caption: string | null; event_title: string | null; event_id: string | null }[]>([]);
  // Event filter: All, or one event's highlights.
  const [only, setOnly] = useState<string | null>(null);
  useEffect(() => { supabase.rpc('org_highlight_reel', { p_org_id: orgId }).then(({ data }) => setItems((data ?? []) as typeof items)); }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!items.length) return null;
  const events = [...new Map(items.filter((v) => v.event_id && v.event_title).map((v) => [v.event_id as string, v.event_title as string])).entries()];
  const shown = only ? items.filter((v) => v.event_id === only) : items;
  return (
    <section className="pb-10">
      <h2 className="text-xl font-bold">🎞️ Highlights from past events</h2>
      {events.length > 1 && (
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Filter highlights by event">
          {[[null, 'All'] as [string | null, string], ...events].map(([id, title]) => (
            <button key={id ?? 'all'} role="tab" aria-selected={only === id} onClick={() => setOnly(id)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${only === id ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 bg-white text-gray-700'}`}>{title}</button>
          ))}
        </div>
      )}
      <div className="-mx-4 mt-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
        {shown.map((v) => (
          <Link key={v.id} to={`/feed?post=${v.id}`} className="relative w-36 shrink-0 snap-start overflow-hidden rounded-2xl" aria-label={v.caption || (v.event_title ? `Video from ${v.event_title}` : 'Video')}>
            {v.thumbnail ? <img src={v.thumbnail} alt="" className="aspect-[9/14] w-full object-cover" /> : <span className="flex aspect-[9/14] w-full items-center justify-center bg-gray-800 text-2xl">🎬</span>}
            {v.event_title && <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-6 text-xs font-medium text-white">{v.event_title}</span>}
            <span className="absolute left-2 top-2 rounded-full bg-black/50 px-1.5 text-xs text-white">▶</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
