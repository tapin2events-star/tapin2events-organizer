import { useEffect, useState } from 'react';
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
        <div className="-mt-10 flex flex-wrap items-end gap-4">
          {org.logo_url ? <img src={org.logo_url} alt="" className="h-24 w-24 rounded-3xl border-4 object-cover shadow-md" style={{ borderColor: dark ? '#0B1020' : '#fff' }} /> : <span className="flex h-24 w-24 items-center justify-center rounded-3xl border-4 text-3xl font-bold text-white shadow-md" style={{ background: b.primary, borderColor: dark ? '#0B1020' : '#fff' }}>{org.name.charAt(0)}</span>}
          <div className="min-w-0 flex-1 pb-1">
            <h1 className="text-3xl font-extrabold">{org.name}{org.verified && <span className="ml-2 text-xl" style={{ color: b.accent }} title="Verified">✓</span>}</h1>
            <p className="text-sm opacity-70">{org.kind === 'nonprofit' ? 'Nonprofit' : 'Organization'}{org.city ? ` · ${org.city}${org.state ? `, ${org.state}` : ''}` : ''}</p>
          </div>
          {canManage && <Link to={`/business/${org.slug}/manage`} className="mb-1 rounded-full px-4 py-2 text-sm font-semibold text-white" style={{ background: b.primary }}>Manage</Link>}
        </div>
        {org.tagline && <p className="mt-5 text-lg font-medium">{org.tagline}</p>}
        {org.description && <p className="mt-3 whitespace-pre-wrap leading-relaxed opacity-80">{org.description}</p>}
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          {org.website && <a href={org.website} target="_blank" rel="noopener noreferrer" className="font-medium" style={{ color: b.accent }}>Website ↗</a>}
          {org.contact_email && <a href={`mailto:${org.contact_email}`} className="font-medium" style={{ color: b.accent }}>Contact</a>}
        </div>

        <h2 className="mt-10 text-xl font-bold">Upcoming events</h2>
        {events.length === 0 ? <p className="mt-2 pb-16 text-sm opacity-70">No upcoming events right now.</p> : (
          <div className="mt-4 grid gap-4 pb-16 sm:grid-cols-2">
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
      </div>
    </div>
  );
}
