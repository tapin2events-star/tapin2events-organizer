import { useEffect, useState } from 'react';
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
import TasksTab from '../components/tabs/TasksTab';
import TeamTab from '../components/tabs/TeamTab';
import VendorApplicationsTab from '../components/tabs/VendorApplicationsTab';
import LineupScheduleTab from '../components/tabs/LineupScheduleTab';
import ProductManager from '../components/products/ProductManager';
import ProductOrdersPanel from '../components/products/ProductOrdersPanel';
import { OrganizerEventSkeleton } from '../components/ui/Skeleton';

const TABS = ['Overview', 'Lineup & schedule', 'Ticket Sales', 'Messages', 'Products', 'Bookings', 'Tasks', 'Team', 'Vendor applications'] as const;
type Tab = (typeof TABS)[number];

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<TapEvent | null>(null);
  const [seriesEvents, setSeriesEvents] = useState<{ id: string; start_date: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('Overview');
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
  const visibleTabs = TABS.filter((t) => t !== 'Bookings' || isOwner);
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
            .select('id, start_date')
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

      <div className="mb-6 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-muted">{event.category}</p>
          <h1 className="font-display text-3xl font-extrabold text-bone">{event.title}</h1>
          <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${event.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>
            {event.status === 'published' ? 'Published' : 'Draft'}
          </span>
        </div>
        <div className="flex flex-wrap gap-2 xl:shrink-0 xl:flex-nowrap">
          <button
            onClick={async () => {
              const nextStatus = event.status === 'published' ? 'draft' : 'published';
              const { error } = await supabase.from('events').update({ status: nextStatus }).eq('id', id);
              if (!error) setEvent({ ...event, status: nextStatus });
            }}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold ${
              event.status === 'published'
                ? 'border border-gray-300 text-bone hover:border-magenta hover:text-magenta'
                : 'bg-mint text-ink hover:bg-mint/90'
            }`}
          >
            {event.status === 'published' ? 'Unpublish' : 'Publish event'}
          </button>
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

      {event.is_recurring && seriesEvents.length > 1 && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-surface2 p-4">
          <p className="text-xs uppercase tracking-widest text-muted">Part of a recurring series ({seriesEvents.length} occurrences)</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {seriesEvents.map((e, i) => (
              <Link
                key={e.id}
                to={`/organizer/events/${e.id}`}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                  e.id === id ? 'border-marigold bg-marigold/10 text-marigold' : 'border-gray-300 text-bone hover:border-marigold'
                }`}
              >
                #{i + 1} · {new Date(e.start_date).toLocaleDateString()}
              </Link>
            ))}
          </div>
        </div>
      )}

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
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && <OverviewTab event={event} />}
      {tab === 'Lineup & schedule' && <LineupScheduleTab event={event} isOwner={isOwner} />}
      {tab === 'Ticket Sales' && <SalesTab eventId={id} />}
      {tab === 'Messages' && <MessagesTab eventId={id} />}
      {tab === 'Products' && (
        <>
          <ProductManager ownerType="event" ownerId={id} sellerEmail={event.organizer_email} />
          <ProductOrdersPanel ownerType="event" ownerId={id} />
        </>
      )}
      {tab === 'Bookings' && isOwner && <BookingsManager eventId={id} />}
      {tab === 'Tasks' && <TasksTab eventId={id} eventTitle={event.title} />}
      {tab === 'Team' && <TeamTab eventId={id} eventTitle={event.title} />}
      {tab === 'Vendor applications' && <VendorApplicationsTab eventId={id} />}
    </div>
  );
}
