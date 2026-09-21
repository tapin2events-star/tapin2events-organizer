import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import type { TapEvent } from '../lib/types';
import OverviewTab from '../components/tabs/OverviewTab';
import SalesTab from '../components/tabs/SalesTab';
import TasksTab from '../components/tabs/TasksTab';
import TeamTab from '../components/tabs/TeamTab';
import VendorApplicationsTab from '../components/tabs/VendorApplicationsTab';
import ProductManager from '../components/products/ProductManager';
import ProductOrdersPanel from '../components/products/ProductOrdersPanel';

const TABS = ['Overview', 'Sales', 'Products', 'Tasks', 'Team', 'Vendor applications'] as const;
type Tab = (typeof TABS)[number];

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<TapEvent | null>(null);
  const [seriesEvents, setSeriesEvents] = useState<{ id: string; start_date: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('Overview');

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

  if (loading) return <p className="text-muted">Loading…</p>;
  if (!event || !id) return <p className="text-magenta">Event not found.</p>;

  return (
    <div>
      {event.poster_url && (
        <div className="mb-6 aspect-[21/9] w-full overflow-hidden rounded-2xl bg-gray-100">
          <img src={event.poster_url} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">{event.category}</p>
          <h1 className="font-display text-3xl font-extrabold text-bone">{event.title}</h1>
          <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${event.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>
            {event.status === 'published' ? 'Published' : 'Draft'}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              const nextStatus = event.status === 'published' ? 'draft' : 'published';
              const { error } = await supabase.from('events').update({ status: nextStatus }).eq('id', id);
              if (!error) setEvent({ ...event, status: nextStatus });
            }}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
              event.status === 'published'
                ? 'border border-gray-300 text-bone hover:border-magenta hover:text-magenta'
                : 'bg-mint text-ink hover:bg-mint/90'
            }`}
          >
            {event.status === 'published' ? 'Unpublish' : 'Publish event'}
          </button>
          <Link
            to={`/organizer/events/${id}/checkin`}
            className="rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-ink hover:bg-marigold/90"
          >
            Check in guests
          </Link>
          <Link
            to={`/organizer/events/${id}/edit`}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-bone hover:border-marigold hover:text-marigold"
          >
            Edit event
          </Link>
        </div>
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
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition ${
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
      {tab === 'Sales' && <SalesTab eventId={id} />}
      {tab === 'Products' && (
        <>
          <ProductManager ownerType="event" ownerId={id} sellerEmail={event.organizer_email} />
          <ProductOrdersPanel ownerType="event" ownerId={id} />
        </>
      )}
      {tab === 'Tasks' && <TasksTab eventId={id} eventTitle={event.title} />}
      {tab === 'Team' && <TeamTab eventId={id} eventTitle={event.title} />}
      {tab === 'Vendor applications' && <VendorApplicationsTab eventId={id} />}
    </div>
  );
}
