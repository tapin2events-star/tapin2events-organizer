import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import TicketStubCard from '../components/TicketStubCard';
import PayoutsCard from '../components/PayoutsCard';
import MyResourceBookings from '../components/resources/MyResourceBookings';
import FilterPillGroup from '../components/FilterPillGroup';
import type { TapEvent } from '../lib/types';

export default function Dashboard() {
  const { user } = useAuth();
  const [events, setEvents] = useState<TapEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);
  const [chargesEnabled, setChargesEnabled] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'free' | 'paid'>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'upcoming' | 'past'>('all');
  const [vendorFilter, setVendorFilter] = useState<'all' | 'pending_vendors'>('all');
  const [eventsWithPendingVendors, setEventsWithPendingVendors] = useState<Set<string>>(new Set());
  // Events where the current user isn't the organizer but has been given
  // vendor-management access as a team member (narrower than full access).
  const [vendorManagerEventIds, setVendorManagerEventIds] = useState<Set<string>>(new Set());
  // Separately: events the organizer owns where they've delegated vendor
  // management to someone else -- the organizer should be able to see who
  // they've handed that off to, not just the person who received it.
  const [eventsWithVendorManagerAssigned, setEventsWithVendorManagerAssigned] = useState<Map<string, string>>(new Map());
  const [accessFilter, setAccessFilter] = useState<'all' | 'vendor_management'>('all');
  const [seriesPassFilter, setSeriesPassFilter] = useState<'all' | 'has_series_passes'>('all');
  const [eventsWithSeriesPasses, setEventsWithSeriesPasses] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: ownEvents, error }, { data: myCollabs }] = await Promise.all([
        supabase.from('events').select('*').eq('organizer_id', user.id).order('start_date', { ascending: true, nullsFirst: false }),
        user.email
          ? supabase.from('event_collaborations').select('event_id, role, permissions').eq('collaborator_email', user.email)
          : Promise.resolve({ data: [] as { event_id: string; role: string; permissions: string[] }[] }),
      ]);

      // Team members (including vendor managers) need to see the event on
      // their own dashboard too, not just the organizer -- collaborator
      // access previously granted permission on the underlying data but the
      // event never actually showed up in this list to navigate into.
      const collabEventIds = (myCollabs ?? []).map((c) => c.event_id);
      const vendorMgrIds = new Set((myCollabs ?? []).filter((c) => c.permissions?.includes('manage_vendors')).map((c) => c.event_id));
      setVendorManagerEventIds(vendorMgrIds);

      const ownIds = new Set((ownEvents ?? []).map((e) => e.id));
      const collabOnlyIds = collabEventIds.filter((id) => !ownIds.has(id));
      const { data: collabEvents } = collabOnlyIds.length
        ? await supabase.from('events').select('*').in('id', collabOnlyIds)
        : { data: [] as TapEvent[] };

      const data = [...(ownEvents ?? []), ...(collabEvents ?? [])];
      if (!error) setEvents(data as TapEvent[]);

      const eventIds = data.map((e) => e.id);
      if (eventIds.length > 0) {
        const { data: pendingVendors } = await supabase
          .from('event_vendor_applications')
          .select('event_id')
          .in('event_id', eventIds)
          .eq('status', 'pending');
        setEventsWithPendingVendors(new Set((pendingVendors ?? []).map((v) => v.event_id)));

        const { data: seriesPassTickets } = await supabase
          .from('tickets')
          .select('event_id')
          .in('event_id', eventIds)
          .eq('ticket_type', 'series_pass')
          .eq('status', 'confirmed');
        setEventsWithSeriesPasses(new Set((seriesPassTickets ?? []).map((t) => t.event_id)));

        const { data: assignedVendorMgrs } = await supabase
          .from('event_collaborations')
          .select('event_id, collaborator_email')
          .in('event_id', eventIds)
          .contains('permissions', ['manage_vendors']);
        setEventsWithVendorManagerAssigned(new Map((assignedVendorMgrs ?? []).map((c) => [c.event_id, c.collaborator_email])));
      }

      if (user.email) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('stripe_account_id, stripe_charges_enabled')
          .eq('email', user.email)
          .single();
        setStripeAccountId(profile?.stripe_account_id ?? null);
        setChargesEnabled(!!profile?.stripe_charges_enabled);
      }
      setLoading(false);
    })();
  }, [user]);

  const filteredEvents = useMemo(() => {
    const now = new Date();
    return events
      .filter((e) => statusFilter === 'all' || e.status === statusFilter)
      .filter((e) => typeFilter === 'all' || (typeFilter === 'free' ? e.event_type === 'free' : e.event_type !== 'free'))
      .filter((e) => vendorFilter === 'all' || eventsWithPendingVendors.has(e.id))
      .filter(
        (e) =>
          accessFilter === 'all' ||
          vendorManagerEventIds.has(e.id) ||
          (e.organizer_id === user?.id && eventsWithVendorManagerAssigned.has(e.id))
      )
      .filter((e) => seriesPassFilter === 'all' || eventsWithSeriesPasses.has(e.id))
      .filter((e) => {
        if (timeFilter === 'all' || !e.start_date) return true;
        const isUpcoming = new Date(e.start_date) >= now;
        return timeFilter === 'upcoming' ? isUpcoming : !isUpcoming;
      });
  }, [events, statusFilter, typeFilter, timeFilter, vendorFilter, eventsWithPendingVendors, seriesPassFilter, eventsWithSeriesPasses, accessFilter, vendorManagerEventIds, eventsWithVendorManagerAssigned, user?.id]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-bone">Organizer Dashboard</h1>
          <p className="text-sm text-muted">Everything you're organizing, in one place.</p>
        </div>
        <Link
          to="/organizer/new"
          className="rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-ink hover:bg-marigold/90"
        >
          + Create event
        </Link>
      </div>

      {!loading && <PayoutsCard hasAccount={!!stripeAccountId} chargesEnabled={chargesEnabled} />}

      {!loading && events.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium ${
              showFilters || statusFilter !== 'all' || typeFilter !== 'all' || timeFilter !== 'all' || vendorFilter !== 'all' || seriesPassFilter !== 'all'
                ? 'border-marigold bg-marigold/10 text-marigold'
                : 'border-gray-300 bg-surface2 text-bone'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 5h16M7 12h10M10 19h4" strokeLinecap="round" /></svg>
            Filters
          </button>

          {showFilters && (
            <div className="mt-3 flex flex-col gap-4 rounded-xl border border-gray-200 bg-surface2 p-4">
              <FilterPillGroup
                label="Status"
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: 'all', label: 'All statuses' },
                  { value: 'published', label: 'Published' },
                  { value: 'draft', label: 'Draft' },
                ]}
              />
              <FilterPillGroup
                label="Type"
                value={typeFilter}
                onChange={setTypeFilter}
                options={[
                  { value: 'all', label: 'Free & paid' },
                  { value: 'free', label: 'Free only' },
                  { value: 'paid', label: 'Paid only' },
                ]}
              />
              <FilterPillGroup
                label="Date"
                value={timeFilter}
                onChange={setTimeFilter}
                options={[
                  { value: 'all', label: 'Any date' },
                  { value: 'upcoming', label: 'Upcoming' },
                  { value: 'past', label: 'Past' },
                ]}
              />
              {eventsWithPendingVendors.size > 0 && (
                <FilterPillGroup
                  label="Vendors"
                  value={vendorFilter}
                  onChange={setVendorFilter}
                  options={[
                    { value: 'all', label: 'All events' },
                    { value: 'pending_vendors', label: 'Has pending vendor applications' },
                  ]}
                />
              )}
              {eventsWithSeriesPasses.size > 0 && (
                <FilterPillGroup
                  label="Series passes"
                  value={seriesPassFilter}
                  onChange={setSeriesPassFilter}
                  options={[
                    { value: 'all', label: 'All events' },
                    { value: 'has_series_passes', label: 'Has series pass sales' },
                  ]}
                />
              )}
              {(vendorManagerEventIds.size > 0 || eventsWithVendorManagerAssigned.size > 0) && (
                <FilterPillGroup
                  label="Vendor management access"
                  value={accessFilter}
                  onChange={setAccessFilter}
                  options={[
                    { value: 'all', label: 'All events' },
                    { value: 'vendor_management', label: 'I can manage vendors' },
                  ]}
                />
              )}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-16 text-center">
          <p className="font-display text-xl font-semibold text-bone">No events yet</p>
          <p className="mt-1 text-sm text-muted">Create your first event to start selling tickets.</p>
          <Link
            to="/organizer/new"
            className="mt-4 inline-block rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-ink hover:bg-marigold/90"
          >
            + Create event
          </Link>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center">
          <p className="text-muted">No events match these filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredEvents.map((event) => (
            <div key={event.id} className="relative">
              {vendorManagerEventIds.has(event.id) && event.organizer_id !== user?.id && (
                <span className="absolute right-3 top-3 z-10 rounded-full bg-purple-100 px-2.5 py-1 text-xs font-semibold text-purple">
                  Vendor Manager
                </span>
              )}
              {event.organizer_id === user?.id && eventsWithVendorManagerAssigned.has(event.id) && (
                <span
                  title={`Vendor manager: ${eventsWithVendorManagerAssigned.get(event.id)}`}
                  className="absolute right-3 top-3 z-10 rounded-full bg-purple-100 px-2.5 py-1 text-xs font-semibold text-purple"
                >
                  Vendor Manager Assigned
                </span>
              )}
              <TicketStubCard event={event} />
            </div>
          ))}
        </div>
      )}

      <MyResourceBookings />
    </div>
  );
}
