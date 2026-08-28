import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import type { TapEvent } from '../lib/types';
import OverviewTab from '../components/tabs/OverviewTab';
import SalesTab from '../components/tabs/SalesTab';
import TasksTab from '../components/tabs/TasksTab';
import TeamTab from '../components/tabs/TeamTab';
import VendorApplicationsTab from '../components/tabs/VendorApplicationsTab';

const TABS = ['Overview', 'Sales', 'Tasks', 'Team', 'Vendor applications'] as const;
type Tab = (typeof TABS)[number];

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<TapEvent | null>(null);
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

      <div className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">{event.category}</p>
          <h1 className="font-display text-3xl font-extrabold text-bone">{event.title}</h1>
        </div>
        <Link
          to={`/events/${id}/edit`}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-bone hover:border-marigold hover:text-marigold"
        >
          Edit event
        </Link>
      </div>

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
      {tab === 'Tasks' && <TasksTab eventId={id} />}
      {tab === 'Team' && <TeamTab eventId={id} />}
      {tab === 'Vendor applications' && <VendorApplicationsTab eventId={id} />}
    </div>
  );
}
