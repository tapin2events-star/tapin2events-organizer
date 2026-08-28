import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import TicketStubCard from '../components/TicketStubCard';
import type { TapEvent } from '../lib/types';

export default function Dashboard() {
  const { user } = useAuth();
  const [events, setEvents] = useState<TapEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('organizer_id', user.id)
        .order('start_date', { ascending: true, nullsFirst: false });
      if (!error && data) setEvents(data as TapEvent[]);
      setLoading(false);
    })();
  }, [user]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-bone">Your events</h1>
          <p className="text-sm text-muted">Everything you're organizing, in one place.</p>
        </div>
        <Link
          to="/organizer/new"
          className="rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-ink hover:bg-marigold/90"
        >
          + Create event
        </Link>
      </div>

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
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => (
            <TicketStubCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
