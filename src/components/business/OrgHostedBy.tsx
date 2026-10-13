import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import EventCover from '../EventCover';
import OrgFollowButton from './OrgFollowButton';
import type { Organization } from '../../lib/business';

// "Hosted by" for events that belong to an organization.
export function OrgHostedBy({ org }: { org: Organization }) {
  return (
    <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Hosted by</p>
      <div className="mt-2 flex items-center gap-3">
        <Link to={`/o/${org.slug}`} className="shrink-0">
          {org.logo_url ? <img src={org.logo_url} alt="" className="h-14 w-14 rounded-2xl object-cover" /> : <span className="flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-bold text-white" style={{ background: org.brand.primary }}>{org.name.charAt(0)}</span>}
        </Link>
        <div className="min-w-0 flex-1">
          <Link to={`/o/${org.slug}`} className="block truncate font-semibold text-gray-900 hover:underline">{org.name}{org.verified && <span className="ml-1" style={{ color: org.brand.accent }} title="Verified">✓</span>}</Link>
          <p className="truncate text-xs text-gray-500">{org.kind === 'nonprofit' ? 'Nonprofit' : org.kind === 'community' ? 'Community group' : 'Organization'}{org.city ? ` · ${org.city}${org.state ? `, ${org.state}` : ''}` : ''}</p>
        </div>
      </div>
      {org.tagline && <p className="mt-2 text-sm text-gray-600">{org.tagline}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <OrgFollowButton orgId={org.id} color={org.brand.primary} />
        <Link to={`/o/${org.slug}`} className="text-sm font-semibold" style={{ color: org.brand.primary }}>View page ›</Link>
      </div>
    </div>
  );
}

// "More from [organization]": a few of their other upcoming events.
export function MoreFromOrg({ org, currentEventId }: { org: Organization; currentEventId: string }) {
  const [events, setEvents] = useState<{ id: string; title: string; start_date: string | null; location_name: string | null; poster_url: string | null; category: string | null }[]>([]);
  useEffect(() => {
    supabase.from('events').select('id, title, start_date, location_name, poster_url, category')
      .eq('organization_id', org.id).eq('status', 'published').neq('id', currentEventId).is('parent_event_id', null)
      .gte('start_date', new Date().toISOString()).order('start_date').limit(4)
      .then(({ data }) => setEvents((data ?? []) as typeof events));
  }, [org.id, currentEventId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (events.length === 0) return null;
  return (
    <section className="mt-10">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-xl font-bold text-gray-900">More from {org.name}</h2>
        <Link to={`/o/${org.slug}`} className="shrink-0 text-sm font-semibold" style={{ color: org.brand.primary }}>See all ›</Link>
      </div>
      <div className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0">
        {events.map((e) => (
          <Link key={e.id} to={`/events/${e.id}`} className="w-64 shrink-0 snap-start overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:shadow-md sm:w-auto">
            {e.poster_url ? <img src={e.poster_url} alt="" className="h-32 w-full object-cover" /> : <EventCover category={e.category} title={e.title} className="h-32 w-full" />}
            <div className="p-3">
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: org.brand.primary }}>{e.start_date ? new Date(e.start_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Date TBA'}</p>
              <p className="mt-0.5 line-clamp-2 font-semibold text-gray-900">{e.title}</p>
              {e.location_name && <p className="truncate text-xs text-gray-500">{e.location_name}</p>}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
