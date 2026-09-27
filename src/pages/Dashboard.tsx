import { useEffect, useMemo, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import NeedsAttention from '../components/dashboard/NeedsAttention';
import EventActions from '../components/dashboard/EventActions';
import { loadEarnings, money, summarize } from '../lib/earnings';
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
  const [vendorFilter, setVendorFilter] = useState<'all' | 'pending_vendors' | 'vendor_manager'>('all');
  const [eventsWithPendingVendors, setEventsWithPendingVendors] = useState<Set<string>>(new Set());
  const [pendingVendorAppCount, setPendingVendorAppCount] = useState(0);
  // Events where the current user isn't the organizer but has been given
  // vendor-management access as a team member (narrower than full access).
  const [vendorManagerEventIds, setVendorManagerEventIds] = useState<Set<string>>(new Set());
  // Separately: events the organizer owns where they've delegated vendor
  // management to someone else -- the organizer should be able to see who
  // they've handed that off to, not just the person who received it.
  const [eventsWithVendorManagerAssigned, setEventsWithVendorManagerAssigned] = useState<Map<string, string>>(new Map());
  const [seriesPassFilter, setSeriesPassFilter] = useState<'all' | 'has_series_passes'>('all');
  const [bookingFilter, setBookingFilter] = useState<'all' | 'pending' | 'booked'>('all');
  const [eventsWithPendingBookings, setEventsWithPendingBookings] = useState<Set<string>>(new Set());
  const [eventsWithBookedResources, setEventsWithBookedResources] = useState<Set<string>>(new Set());
  const [eventsWithSeriesPasses, setEventsWithSeriesPasses] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');
  // Which of your events have tickets/registrations/payments (can't be deleted),
  // plus headline earnings for the summary card.
  const [salesEventIds, setSalesEventIds] = useState<Set<string> | null>(null);
  const [earnings, setEarnings] = useState<{ all: number; month: number; tickets: number } | null>(null);
  useEffect(() => {
    if (!user?.id || !user.email) return;
    loadEarnings(user.id, user.email)
      .then((d) => {
        setSalesEventIds(new Set([...d.tickets.map((t) => t.event_id), ...d.orders.map((o) => o.event_id), ...d.vendorFees.map((v) => v.event_id)]));
        const all = summarize(d, 'all');
        setEarnings({ all: all.earned, month: summarize(d, 'month').earned, tickets: all.totals.ticketsSold });
      })
      // If this can't load, still offer Delete: the database refuses to delete
      // any event with sales and explains why, so nothing can be lost.
      .catch(() => setSalesEventIds(new Set()));
  }, [user?.id, user?.email]);

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
        setPendingVendorAppCount((pendingVendors ?? []).length);

        const { data: seriesPassTickets } = await supabase
          .from('tickets')
          .select('event_id')
          .in('event_id', eventIds)
          .eq('ticket_type', 'series_pass')
          .eq('status', 'confirmed');
        setEventsWithSeriesPasses(new Set((seriesPassTickets ?? []).map((t) => t.event_id)));

        // Resource bookings: "pending" means waiting on someone (the resource
        // hasn't answered, or they countered and it's your turn); "booked"
        // means the resource is locked in.
        const { data: bookings } = await supabase
          .from('resource_bookings')
          .select('event_id, status')
          .in('event_id', eventIds);
        setEventsWithPendingBookings(new Set((bookings ?? []).filter((b) => ['pending', 'counter_offered'].includes(b.status)).map((b) => b.event_id)));
        setEventsWithBookedResources(new Set((bookings ?? []).filter((b) => ['accepted', 'confirmed', 'completed'].includes(b.status)).map((b) => b.event_id)));

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
      .filter((e) => {
        if (vendorFilter === 'pending_vendors') return eventsWithPendingVendors.has(e.id);
        // Vendor manager covers both sides: events you were given vendor
        // management on, and your own events where you've assigned someone.
        if (vendorFilter === 'vendor_manager') {
          return vendorManagerEventIds.has(e.id) || (e.organizer_id === user?.id && eventsWithVendorManagerAssigned.has(e.id));
        }
        return true;
      })
      .filter((e) => seriesPassFilter === 'all' || eventsWithSeriesPasses.has(e.id))
      .filter((e) => {
        if (bookingFilter === 'pending') return eventsWithPendingBookings.has(e.id);
        if (bookingFilter === 'booked') return eventsWithBookedResources.has(e.id);
        return true;
      })
      .filter((e) => {
        if (timeFilter === 'all' || !e.start_date) return true;
        const isUpcoming = new Date(e.start_date) >= now;
        return timeFilter === 'upcoming' ? isUpcoming : !isUpcoming;
      })
      .filter((e) => {
        // Every word must match the title, venue, category, or date.
        const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
        if (!words.length) return true;
        const date = e.start_date ? new Date(e.start_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '';
        const hay = [e.title, e.location_name, e.location_address, e.category, date, e.is_online ? 'online virtual' : '', e.status].filter(Boolean).join(' ').toLowerCase();
        return words.every((w) => hay.includes(w));
      });
  }, [search, events, statusFilter, typeFilter, timeFilter, vendorFilter, eventsWithPendingVendors, seriesPassFilter, eventsWithSeriesPasses, bookingFilter, eventsWithPendingBookings, eventsWithBookedResources, vendorManagerEventIds, eventsWithVendorManagerAssigned, user?.id]);

  const location = useLocation();
  useEffect(() => {
    if (loading || location.hash !== '#resource-bookings') return;
    setTimeout(() => document.getElementById('resource-bookings')?.scrollIntoView({ behavior: 'smooth' }), 150);
  }, [loading, location.hash]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-bone">Organizer Dashboard</h1>
          <p className="text-sm text-muted">Everything you're organizing, in one place.</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
          <Link to="/organizer/import" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-bone hover:border-marigold hover:text-marigold">
            Import events
          </Link>
        <Link
          to="/organizer/new"
          className="rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-ink hover:bg-marigold/90"
        >
          + Create event
        </Link>
        </div>
      </div>

      {!loading && user?.id && user.email && <NeedsAttention events={events} userId={user.id} userEmail={user.email} />}

      <Link
        to="/organizer/vendor-applications"
        className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-surface2 px-4 py-3 hover:border-marigold"
      >
        <div>
          <p className="font-semibold text-bone">Vendor Applications</p>
          <p className="text-xs text-muted">Review vendor applications across all your events</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {pendingVendorAppCount > 0 && (
            <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700">{pendingVendorAppCount} pending</span>
          )}
          <span className="text-muted">&rarr;</span>
        </div>
      </Link>

      {!loading && <PayoutsCard hasAccount={!!stripeAccountId} chargesEnabled={chargesEnabled} />}

      {!loading && earnings && (
        <Link to="/organizer/earnings" className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 hover:border-marigold">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Earnings</p>
            <p className="font-display text-2xl font-extrabold text-gray-900">{money(earnings.all)} <span className="text-sm font-medium text-gray-500">all time</span></p>
            <p className="text-xs text-gray-500">{money(earnings.month)} this month · {earnings.tickets} tickets &amp; registrations</p>
          </div>
          <span className="shrink-0 text-sm font-semibold text-marigold">See details &rarr;</span>
        </Link>
      )}

      {!loading && events.length > 0 && (
        <div className="mb-4">
          <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your events"
              aria-label="Search your events"
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-base text-gray-900 outline-none focus:border-marigold"
            />
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium ${
              showFilters || statusFilter !== 'all' || typeFilter !== 'all' || timeFilter !== 'all' || vendorFilter !== 'all' || seriesPassFilter !== 'all' || bookingFilter !== 'all'
                ? 'border-marigold bg-marigold/10 text-marigold'
                : 'border-gray-300 bg-surface2 text-bone'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 5h16M7 12h10M10 19h4" strokeLinecap="round" /></svg>
            Filters
          </button>
          </div>

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
              <FilterPillGroup
                label="Vendors"
                value={vendorFilter}
                onChange={setVendorFilter}
                options={[
                  { value: 'all', label: 'All events' },
                  { value: 'pending_vendors', label: 'Pending applications' },
                  { value: 'vendor_manager', label: 'Vendor manager' },
                ]}
              />
              <FilterPillGroup
                label="Resource bookings"
                value={bookingFilter}
                onChange={setBookingFilter}
                options={[
                  { value: 'all', label: 'All events' },
                  { value: 'pending', label: 'Pending bookings' },
                  { value: 'booked', label: 'Resources booked' },
                ]}
              />
              <FilterPillGroup
                label="Series passes"
                value={seriesPassFilter}
                onChange={setSeriesPassFilter}
                options={[
                  { value: 'all', label: 'All events' },
                  { value: 'has_series_passes', label: 'Has series pass sales' },
                ]}
              />
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
          <p className="text-muted">{search.trim() ? `No events match "${search.trim()}".` : 'No events match these filters.'}</p>
          {search.trim() && (
            <button type="button" onClick={() => setSearch('')} className="mt-2 py-2 text-sm font-medium text-marigold hover:underline">Clear search</button>
          )}
          {vendorFilter === 'vendor_manager' && (
            <p className="mt-2 text-sm text-muted">
              To assign one, open an event, go to its <span className="font-medium text-bone">Team</span> tab, and invite someone with the <span className="font-medium text-bone">Vendor Manager</span> role.
            </p>
          )}
          {vendorFilter === 'pending_vendors' && (
            <p className="mt-2 text-sm text-muted">None of your events have vendor applications waiting for review right now.</p>
          )}
          {bookingFilter === 'pending' && (
            <p className="mt-2 text-sm text-muted">No resource bookings are waiting on a response right now.</p>
          )}
          {bookingFilter === 'booked' && (
            <p className="mt-2 text-sm text-muted">
              You haven't booked any resources for your events yet. Browse <Link to="/resources" className="font-medium text-marigold">Resources</Link> to find artists and vendors.
            </p>
          )}
          {seriesPassFilter === 'has_series_passes' && (
            <p className="mt-2 text-sm text-muted">No series passes have been sold for your events yet.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
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
              {event.organizer_id === user?.id && (
                <EventActions
                  event={event}
                  seriesChildren={events.filter((c) => c.parent_event_id === event.id)}
                  hasSales={salesEventIds === null ? undefined : [event.id, ...events.filter((c) => c.parent_event_id === event.id).map((c) => c.id)].some((id) => salesEventIds.has(id))}
                  onDeleted={(ids) => setEvents((prev) => prev.filter((e) => !ids.includes(e.id)))}
                  onCancelled={(id) => setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, status: 'cancelled' } : e)))}
                />
              )}
              <TicketStubCard event={event} />
            </div>
          ))}
        </div>
      )}

      <div id="resource-bookings" className="scroll-mt-24">
        <MyResourceBookings />
      </div>
    </div>
  );
}
