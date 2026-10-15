import { useEffect, useState } from 'react';
import GalaTab from '../components/tabs/GalaTab';
import VolunteersTab from '../components/tabs/VolunteersTab';
import AttendeesTab from '../components/tabs/AttendeesTab';
import FeatureFeedback from '../components/feedback/FeatureFeedback';
import PromoteTab from '../components/promote/PromoteTab';
import { NetworkingSwitch } from '../components/business/NetworkingCards';
import InvoicesSection from '../components/business/InvoicesSection';
import DonationsTab from '../components/business/DonationsTab';
import RegistrationTab from '../components/business/RegistrationTab';
import TiersTab from '../components/business/TiersTab';
import BusinessPageTab from '../components/business/BusinessPageTab';
import { useFeature } from '../lib/preview';
import TeamTasksTab from '../components/tabs/TeamTasksTab';
import ShareQR from '../components/ShareQR';
import ScoutingTab from '../components/tabs/ScoutingTab';
import BackButton from '../components/BackButton';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEscapeKey } from '../lib/useEscapeKey';
import CancelEventDialog from '../components/dashboard/CancelEventDialog';
import DeleteEventDialog from '../components/dashboard/DeleteEventDialog';
import { supabase } from '../lib/supabaseClient';
import type { TapEvent } from '../lib/types';
import OverviewTab from '../components/tabs/OverviewTab';
import SalesTab from '../components/tabs/SalesTab';
import MessagesTab from '../components/tabs/MessagesTab';
import BookingsManager from '../components/bookings/BookingsManager';
import VendorApplicationsTab from '../components/tabs/VendorApplicationsTab';
import LineupScheduleTab from '../components/tabs/LineupScheduleTab';
import ProductManager from '../components/products/ProductManager';
import ProductOrdersPanel from '../components/products/ProductOrdersPanel';
import { OrganizerEventSkeleton } from '../components/ui/Skeleton';

// Ordered by how often organizers use them: daily checks first, then running the event, then setup.
const TABS = ['Overview', 'Sales', 'Attendees', 'Messages', 'Promote', 'Team & tasks', 'Volunteers', 'Gala', 'Lineup & bookings', 'Tickets', 'Registration', 'Products', 'Donations', 'Vendor applications', 'Business page'] as const;
type Tab = (typeof TABS)[number];

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<TapEvent | null>(null);
  const [seriesEvents, setSeriesEvents] = useState<{ id: string; start_date: string; status?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  // ?tab=Lineup (etc.) opens that tab, e.g. from the Planning page.
  // Older links (?tab=Lineup, ?tab=Bookings) open the matching view inside "Lineup & bookings".
  const tabParam = new URLSearchParams(window.location.search).get('tab') ?? '';
  const [tab, setTab] = useState<Tab>(() => (tabParam === 'Lineup' || tabParam === 'Bookings' ? 'Lineup & bookings' : tabParam === 'Ticket Sales' ? 'Sales' : (TABS as readonly string[]).includes(tabParam) ? (tabParam as Tab) : 'Overview'));
  const { user } = useAuth();
  const navigate = useNavigate();
  // Cancel / delete (organizer only). An event with any tickets, registrations,
  // or payments can only be cancelled; the database enforces this too.
  const [manageOpen, setManageOpen] = useState(false);
  // Open the menu in whichever direction fits beside its button.
  const [menuAlignRight, setMenuAlignRight] = useState(false);
  const [dialog, setDialog] = useState<'cancel' | 'delete' | null>(null);
  const [seriesChildren, setSeriesChildren] = useState<TapEvent[]>([]);
  const [hasSales, setHasSales] = useState<boolean | undefined>(undefined);
  useEscapeKey(() => setManageOpen(false), manageOpen);
  const isOwner = !!event && !!user && event.organizer_id === user.id;
  // Bookings belong to whoever made them, so only the event's owner sees this tab.
  // Helpers and vendor managers see a smaller dashboard.
  const [teamRole, setTeamRole] = useState<string | null>(null);
  useEffect(() => { if (id) supabase.rpc('event_team_role', { p_event_id: id }).then(({ data }) => setTeamRole((data as string | null) ?? null)); }, [id]);
  const limitedTabs: Record<string, readonly string[]> = { helper: ['Overview', 'Team & tasks'], vendor_manager: ['Overview', 'Vendor applications', 'Team & tasks'] };
  const businessOn = useFeature('business');
  const invoicesOn = useFeature('invoices');
  const networkingOn = useFeature('networking');
  const promoteOn = useFeature('promote');
  const volunteersOn = useFeature('volunteers');
  const galaOn = useFeature('gala');
  const [hostOrgName, setHostOrgName] = useState<string | null>(null);
  useEffect(() => {
    const orgId = (event as { organization_id?: string | null } | null)?.organization_id;
    if (!orgId) { setHostOrgName(null); return; }
    supabase.from('organizations').select('name').eq('id', orgId).maybeSingle().then(({ data }) => setHostOrgName((data as { name: string } | null)?.name ?? null));
  }, [(event as { organization_id?: string | null } | null)?.organization_id]); // eslint-disable-line react-hooks/exhaustive-deps
  const programOn = useFeature('program_v2');
  const visibleTabs = TABS.filter((t) => (t !== 'Gala' || galaOn) && (t !== 'Volunteers' || volunteersOn) && (t !== 'Promote' || promoteOn) && (t !== 'Donations' || (businessOn && (event?.event_kind ?? 'community') !== 'business')) && (t !== 'Registration' || businessOn) && (t !== 'Tickets' || (businessOn && !event?.is_seating_enabled)) && (t !== 'Business page' || (businessOn && !!event && event.event_kind !== undefined && event.event_kind !== 'community')) && (!teamRole || !limitedTabs[teamRole] || limitedTabs[teamRole].includes(t)));
  useEffect(() => {
    if (!isOwner || !event) return;
    (async () => {
      const { data: kids } = event.parent_event_id ? { data: [] } : await supabase.from('events').select('*').eq('parent_event_id', event.id);
      const children = (kids ?? []) as TapEvent[];
      setSeriesChildren(children);
      const ids = [event.id, ...children.map((c) => c.id)];
      const [t, o, v] = await Promise.all([
        supabase.from('tickets').select('id', { count: 'exact', head: true }).in('event_id', ids),
        supabase.from('orders').select('id', { count: 'exact', head: true }).in('event_id', ids).eq('payment_status', 'paid'),
        supabase.from('event_vendor_applications').select('id', { count: 'exact', head: true }).in('event_id', ids).eq('status', 'paid'),
      ]);
      setHasSales((t.count ?? 0) + (o.count ?? 0) + (v.count ?? 0) > 0);
    })();
  }, [isOwner, event?.id, event?.parent_event_id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!id) return;
    supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setEvent(data as TapEvent);
        setLoading(false);
        const seriesId = data?.parent_event_id || data?.id;
        if (data?.is_recurring && seriesId) {
          supabase
            .from('events')
            .select('id, start_date, status')
            .or(`id.eq.${seriesId},parent_event_id.eq.${seriesId}`)
            .order('start_date', { ascending: true })
            .then(({ data: siblings }) => setSeriesEvents(siblings ?? []));
        }
      });
  }, [id]);

  if (loading) return <OrganizerEventSkeleton />;
  if (!event || !id) return <p className="text-magenta">Event not found.</p>;

  return (
    <div>
      {event.poster_url && (
        <div className="mb-6 aspect-[21/9] w-full overflow-hidden rounded-2xl bg-gray-100">
          <img src={event.poster_url} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      <div className="mb-3"><BackButton fallback="/organizer" fallbackLabel="Organizer Dashboard" /></div>
      <div className="mb-6 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-muted">{event.category}</p>
          <h1 className="font-display text-3xl font-extrabold text-bone">{event.title}</h1>
          <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${event.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>
            {event.status === 'published' ? 'Published' : 'Draft'}
          </span>
        </div>
        <div className="flex flex-wrap gap-2 xl:shrink-0 xl:flex-nowrap">
          {(() => {
            // Repeating events: publish/unpublish this date and every upcoming date together
            // (with a "just this date" option).
            const isSeries = !!event.is_recurring && seriesEvents.length > 1;
            const nextStatus = event.status === 'published' ? 'draft' : 'published';
            const setStatus = async (allUpcoming: boolean) => {
              const ids = allUpcoming
                ? seriesEvents.filter((e) => e.id === id || (e.status !== 'cancelled' && e.start_date && event.start_date && e.start_date >= event.start_date)).map((e) => e.id)
                : [id as string];
              const { error } = await supabase.from('events').update({ status: nextStatus }).in('id', ids);
              if (!error) {
                setEvent({ ...event, status: nextStatus });
                setSeriesEvents((prev) => prev.map((e) => (ids.includes(e.id) ? { ...e, status: nextStatus } : e)));
              }
            };
            return (
              <span className="flex flex-col items-start gap-1">
                <button
                  onClick={() => setStatus(isSeries)}
                  className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold ${
                    event.status === 'published'
                      ? 'border border-gray-300 text-bone hover:border-magenta hover:text-magenta'
                      : 'bg-mint text-ink hover:bg-mint/90'
                  }`}
                >
                  {event.status === 'published' ? (isSeries ? 'Unpublish all upcoming' : 'Unpublish') : (isSeries ? 'Publish all upcoming dates' : 'Publish event')}
                </button>
                {isSeries && (
                  <button onClick={() => setStatus(false)} className="px-1 text-xs font-medium text-muted hover:text-marigold">
                    {event.status === 'published' ? 'Unpublish just this date' : 'Publish just this date'}
                  </button>
                )}
              </span>
            );
          })()}
          <Link
            to={`/organizer/events/${id}/checkin`}
            className="whitespace-nowrap rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-ink hover:bg-marigold/90"
          >
            Check in guests
          </Link>
          <Link
            to={`/organizer/events/${id}/edit`}
            className="whitespace-nowrap rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-bone hover:border-marigold hover:text-marigold"
          >
            Edit event
          </Link>
          {/* Drafts open as a preview (banner, ticket buttons off); published events show the live page. */}
          <Link
            to={`/events/${id}`}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-bone hover:border-marigold hover:text-marigold"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z" /><circle cx="12" cy="12" r="3" />
            </svg>
            {event.status === 'draft' ? 'Preview' : 'View live page'}
          </Link>
          <ShareQR path={`/events/${id}`} title={event.title}
            subtitle={event.start_date ? new Date(event.start_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : undefined}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-bone hover:border-marigold hover:text-marigold" />
          {isOwner && (event.status !== 'cancelled' || hasSales === false) && (
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setMenuAlignRight(r.left + 200 > window.innerWidth - 8);
                  setManageOpen((o) => !o);
                }}
                aria-expanded={manageOpen}
                aria-label="More options"
                className="whitespace-nowrap rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-bone hover:border-marigold hover:text-marigold"
              >
                More ⋯
              </button>
              {manageOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setManageOpen(false)} />
                  <div className={`absolute z-20 mt-1 w-48 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 text-sm shadow-lg ${menuAlignRight ? 'right-0' : 'left-0'}`}>
                    {hasSales === undefined ? (
                      <p className="px-4 py-2.5 text-gray-400">Checking…</p>
                    ) : hasSales ? (
                      <button type="button" onClick={() => { setManageOpen(false); setDialog('cancel'); }} className="block w-full px-4 py-2.5 text-left text-magenta hover:bg-red-50">
                        Cancel event
                      </button>
                    ) : (
                      <button type="button" onClick={() => { setManageOpen(false); setDialog('delete'); }} className="block w-full px-4 py-2.5 text-left text-magenta hover:bg-red-50">
                        {seriesChildren.length > 0 ? 'Delete series' : 'Delete event'}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      {dialog === 'cancel' && (
        <CancelEventDialog eventId={event.id} eventTitle={event.title} onClose={() => setDialog(null)} onCancelled={() => setEvent({ ...event, status: 'cancelled' })} />
      )}
      {dialog === 'delete' && (
        <DeleteEventDialog event={event} seriesChildren={seriesChildren} onClose={() => setDialog(null)} onDeleted={() => navigate('/organizer')} />
      )}
      </div>

      {event.is_recurring && seriesEvents.length > 1 && (() => {
        // Pick a date in the series: a dropdown with previous/next arrows.
        const idx = Math.max(seriesEvents.findIndex((e) => e.id === id), 0);
        const now = Date.now();
        const nextUp = seriesEvents.findIndex((e) => e.start_date && new Date(e.start_date).getTime() >= now);
        const label = (e: { start_date: string | null }, i: number) =>
          `#${i + 1} · ${e.start_date ? new Date(e.start_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'Date TBA'}`;
        const go = (i: number) => { const e = seriesEvents[i]; if (e && e.id !== id) navigate(`/organizer/events/${e.id}`); };
        const arrow = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-700 disabled:opacity-30';
        return (
          <div className="mb-6 rounded-xl border border-gray-200 bg-surface2 p-3">
            <div className="flex items-center justify-between gap-2 px-1">
              <p className="text-xs font-medium uppercase tracking-widest text-muted">Recurring series · {seriesEvents.length} dates</p>
              {nextUp >= 0 && nextUp !== idx && (
                <button type="button" onClick={() => go(nextUp)} className="text-xs font-medium text-marigold">Jump to next upcoming</button>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button type="button" onClick={() => go(idx - 1)} disabled={idx === 0} aria-label="Previous date" className={arrow}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
              <select value={seriesEvents[idx]?.id ?? ''} onChange={(ev) => navigate(`/organizer/events/${ev.target.value}`)} aria-label="Choose a date in this series"
                className="h-11 min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 text-base font-medium text-gray-900">
                {seriesEvents.map((e, i) => (
                  <option key={e.id} value={e.id}>
                    {label(e, i)}{e.start_date && new Date(e.start_date).getTime() < now ? ' (past)' : i === nextUp ? ' (next up)' : ''}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => go(idx + 1)} disabled={idx >= seriesEvents.length - 1} aria-label="Next date" className={arrow}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
              </button>
            </div>
          </div>
        );
      })()}

      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-gray-300">
        {visibleTabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 whitespace-nowrap px-4 py-2 text-sm font-medium transition ${
              tab === t
                ? 'border-b-2 border-marigold text-marigold'
                : 'text-muted hover:text-bone'
            }`}
          >
            {t === 'Business page' && programOn ? 'Program' : t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && networkingOn && (isOwner || teamRole === 'admin' || teamRole === 'editor' || !teamRole) && <NetworkingSwitch eventId={event.id} eventTitle={event.title} />}
      {tab === 'Overview' && (event as { template_id?: string | null }).template_id && isOwner && <FeatureFeedback feature="templates" label="starting from a template" className="mb-4" />}
      {tab === 'Overview' && <OverviewTab event={event} />}
      {tab === 'Business page' && <BusinessPageTab event={event} onEventChange={setEvent} />}
      {tab === 'Tickets' && <TiersTab event={event} />}
      {tab === 'Registration' && <RegistrationTab event={event} onEventChange={setEvent} onGoAttendees={() => setTab('Attendees')} />}
      {tab === 'Attendees' && <AttendeesTab event={event} />}
      {tab === 'Donations' && <DonationsTab event={event} onEventChange={setEvent} />}
      {tab === 'Lineup & bookings' && <LineupWithScouting event={event} isOwner={isOwner} eventId={id!} initialView={tabParam === 'Bookings' ? 'bookings' : undefined} />}
      {tab === 'Promote' && promoteOn && <PromoteTab eventId={id!} />}
      {tab === 'Volunteers' && volunteersOn && <VolunteersTab event={event} />}
      {tab === 'Gala' && galaOn && <GalaTab event={event} />}
      {tab === 'Sales' && invoicesOn && event.is_seating_enabled && (event.seating_sections ?? []).some((s) => Number(s.price) > 0) && (
        <div className="mb-8"><InvoicesSection eventId={id!} ticketPrice={0} sections={(event.seating_sections ?? []).map((s) => ({ name: s.name, price: Number(s.price) || 0, seats: (s.num_tables ?? 0) * (s.seats_per_table ?? 0) }))} /></div>
      )}
      {tab === 'Sales' && <SalesTab eventId={id} onGoAttendees={() => setTab('Attendees')} hostName={hostOrgName ?? 'You'} />}
      {tab === 'Messages' && <MessagesTab eventId={id} />}
      {tab === 'Products' && (
        <>
          <ProductManager ownerType="event" ownerId={id} sellerEmail={event.organizer_email} />
          <ProductOrdersPanel ownerType="event" ownerId={id} />
        </>
      )}
      {tab === 'Team & tasks' && <TeamTasksTab eventId={id} eventTitle={event.title} />}
      {tab === 'Vendor applications' && <VendorApplicationsTab eventId={id} />}
    </div>
  );
}

// Lineup tab: the schedule, with Scouting one tap away.
// Lineup & bookings: Scouting -> Bookings -> Lineup & schedule (the order the work happens).
// Bookings belong to whoever made them, so only the event's owner sees that view.
function LineupWithScouting({ event, isOwner, eventId, initialView }: { event: TapEvent; isOwner: boolean; eventId: string; initialView?: 'bookings' }) {
  type View = 'scouting' | 'bookings' | 'schedule';
  const views: View[] = isOwner ? ['scouting', 'bookings', 'schedule'] : ['scouting', 'schedule'];
  const [view, setView] = useState<View>(() => {
    const h = window.location.hash.slice(1);
    if (h === 'scouting') return 'scouting';
    if ((h === 'bookings' || initialView === 'bookings') && isOwner) return 'bookings';
    return 'schedule';
  });
  return (
    <div>
      <div className="mb-4 inline-flex rounded-xl bg-gray-100 p-1 text-sm" role="tablist" aria-label="Lineup views">
        {views.map((v) => (
          <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
            className={`rounded-lg px-4 py-1.5 font-medium ${view === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
            {v === 'schedule' ? 'Lineup & schedule' : v === 'bookings' ? 'Bookings' : 'Scouting'}
          </button>
        ))}
      </div>
      {view === 'schedule' ? <LineupScheduleTab event={event} isOwner={isOwner} /> : view === 'bookings' && isOwner ? <BookingsManager eventId={eventId} /> : <ScoutingTab event={event} />}
    </div>
  );
}
