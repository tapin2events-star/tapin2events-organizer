import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import type { TapEvent } from '../lib/types';

export default function PublicEventDetail() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<TapEvent | null>(null);
  const [organizerName, setOrganizerName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase.from('events').select('*').eq('id', id).single();
      const ev = data as TapEvent | null;
      setEvent(ev);
      if (ev?.organizer_email) {
        const { data: org } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('email', ev.organizer_email)
          .single();
        setOrganizerName(org?.full_name ?? null);
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="p-10 text-center text-gray-500">Loading…</div>;
  if (!event) return <div className="p-10 text-center text-magenta">Event not found.</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Link to="/discover" className="text-sm text-marigold hover:underline">&larr; Back to Discover</Link>

        {event.poster_url ? (
          <div className="mt-4 aspect-[21/9] w-full overflow-hidden rounded-2xl bg-gray-100">
            <img src={event.poster_url} alt="" className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="mt-4 flex aspect-[21/9] w-full items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-teal-100" />
        )}

        <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-gray-500">{event.category}</p>
            <h1 className="font-display text-3xl font-extrabold text-gray-900">{event.title}</h1>
            {event.start_date && (
              <p className="mt-1 text-gray-500">
                {new Date(event.start_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                {' at '}
                {new Date(event.start_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </p>
            )}
          </div>
          {event.event_type === 'free' ? (
            <span className="rounded-full border border-green-600 px-3 py-1 text-sm font-medium text-green-600">Free</span>
          ) : (
            <span className="text-2xl font-bold text-gray-900">${event.ticket_price}</span>
          )}
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="md:col-span-2">
            <h2 className="font-display text-lg font-semibold text-gray-900">About this event</h2>
            <p className="mt-2 whitespace-pre-wrap text-gray-600">{event.description || 'No description provided.'}</p>

            <h2 className="mt-8 font-display text-lg font-semibold text-gray-900">Location</h2>
            <p className="mt-2 text-gray-600">
              {event.is_online ? 'Virtual event' : (event.location_name || 'Venue TBD')}
            </p>
            {event.location_address && !event.is_online && (
              <p className="text-sm text-gray-400">{event.location_address}</p>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="text-xs uppercase tracking-widest text-gray-400">Organized by</p>
            <p className="mt-1 font-medium text-gray-900">{organizerName || event.organizer_email}</p>

            <div className="mt-5 rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
              Online ticket purchasing is coming soon. Contact the organizer directly for now.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
