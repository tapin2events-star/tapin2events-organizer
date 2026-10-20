import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useBrandedTab, useOrgWhiteLabel } from '../lib/whiteLabel';
import WhiteLabelHeader from '../components/events/WhiteLabelHeader';
import type { DomainOrg } from '../lib/customDomain';

// The home page of an organization's own domain: its upcoming white-labeled events, in its branding.
interface Ev { id: string; title: string; start_date: string | null; location_name: string | null; poster_url: string | null; event_type: string | null; ticket_price: number | null }
export default function OrgDomainHome({ org }: { org: DomainOrg }) {
  const { brand } = useOrgWhiteLabel(org.slug);
  const [events, setEvents] = useState<Ev[] | null>(null);
  useBrandedTab(brand, 'Events');
  useEffect(() => { supabase.rpc('org_white_label_events', { p_org_id: org.org_id }).then(({ data }) => setEvents((data ?? []) as Ev[])); }, [org.org_id]);
  const accent = brand?.primary ?? '#0F1B3D';
  const day = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).replace(':00 ', ' ') : 'Date to be announced');
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <div className="mx-auto max-w-2xl px-4 py-10" style={{ paddingTop: 'calc(2.5rem + env(safe-area-inset-top, 0px))' }}>
        {brand ? <WhiteLabelHeader brand={brand} /> : <p className="text-xl font-extrabold text-gray-900">{org.name}</p>}
        <h1 className="mt-5 font-display text-2xl font-bold text-gray-900">Upcoming events</h1>
        {events === null ? (
          <p className="mt-4 text-sm text-gray-500">Loading…</p>
        ) : events.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-white/60 p-6 text-center text-sm text-gray-500">No upcoming events right now. Check back soon!</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {events.map((e) => (
              <Link key={e.id} to={`/events/${e.id}`} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md">
                {e.poster_url ? <img src={e.poster_url} alt="" className="aspect-[4/3] w-full object-cover" /> : <div className="aspect-[4/3] w-full" style={{ background: accent }} />}
                <div className="p-4">
                  <p className="font-semibold text-gray-900 [overflow-wrap:anywhere]">{e.title}</p>
                  <p className="mt-0.5 text-sm text-gray-500">{day(e.start_date)}{e.location_name ? ` · ${e.location_name}` : ''}</p>
                  <p className="mt-2 text-sm font-semibold" style={{ color: accent }}>{e.event_type === 'free' ? 'Register' : 'Get tickets'} &rarr;</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
