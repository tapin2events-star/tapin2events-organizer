import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import QrScanButtons from '../components/networking/QrScanButtons';
import { ListSkeleton } from '../components/ui/Skeleton';

interface NetEvent { event_id: string; title: string; start_date: string | null; poster_url: string | null; joined: boolean; members: number; requests: number; connections: number }

// Networking home (Preview): your QR and scanner, your card, the events you're going to with networking,
// and the people you've met.
export default function NetworkHome() {
  const { user } = useAuth();
  const [events, setEvents] = useState<NetEvent[] | null>(null);
  const [card, setCard] = useState<{ name: string | null; title: string | null; company: string | null } | null>(null);
  const [met, setMet] = useState<number | null>(null);
  useEffect(() => {
    supabase.rpc('my_networking_events').then(({ data }) => setEvents(((data ?? []) as NetEvent[]).map((e) => ({ ...e, members: Number(e.members), requests: Number(e.requests), connections: Number(e.connections) }))));
    supabase.rpc('people_ive_met').then(({ data }) => setMet((data ?? []).length));
    if (user) supabase.from('profiles').select('full_name, pro_title, pro_company').eq('id', user.id).maybeSingle().then(({ data }) => {
      const d = data as { full_name: string | null; pro_title: string | null; pro_company: string | null } | null;
      setCard({ name: d?.full_name ?? null, title: d?.pro_title ?? null, company: d?.pro_company ?? null });
    });
  }, [user]);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl font-extrabold text-bone">🤝 Networking</h1>
      <p className="mt-1 text-sm text-muted">Meet people at events. Show your code or scan theirs to connect instantly.</p>

      <div className="mt-5"><QrScanButtons name={card?.name} /></div>

      <Link to="/connections" className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-surface p-4 hover:border-marigold">
        <span className="min-w-0">
          <span className="block font-semibold text-bone">Your card</span>
          <span className="block truncate text-sm text-muted">{card ? [card.title, card.company].filter(Boolean).join(' · ') || 'Add your title and company' : '…'}</span>
        </span>
        <span className="shrink-0 text-sm font-medium text-marigold">Edit ›</span>
      </Link>

      <h2 className="mt-7 font-display text-lg font-bold text-bone">Your events with networking</h2>
      {events === null ? <ListSkeleton rows={2} className="mt-3" /> : events.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-gray-300 p-5 text-center text-sm text-muted">None right now. When an event you're going to turns on networking, it shows up here.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {events.map((e) => (
            <li key={e.event_id}><Link to={`/events/${e.event_id}/network`} className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-surface p-3 hover:border-marigold">
              {e.poster_url ? <img src={e.poster_url} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" /> : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-xl">🤝</span>}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-bone">{e.title}</span>
                <span className="block truncate text-xs text-muted">{e.start_date ? new Date(e.start_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Date TBA'} · {e.members} joined{e.joined ? ` · ${e.connections} connection${e.connections === 1 ? '' : 's'}` : ''}</span>
              </span>
              {e.requests > 0 ? <span className="shrink-0 rounded-full bg-indigo-600 px-2.5 py-1 text-xs font-bold text-white">{e.requests} new</span>
                : <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${e.joined ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900'}`}>{e.joined ? 'Joined' : 'Join'}</span>}
            </Link></li>
          ))}
        </ul>
      )}

      <Link to="/connections" className="mt-7 flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-surface p-4 hover:border-marigold">
        <span><span className="block font-semibold text-bone">People I've met</span><span className="block text-sm text-muted">{met === null ? '…' : `${met} ${met === 1 ? 'person' : 'people'}`} · everyone you've connected with</span></span>
        <span className="shrink-0 text-sm font-medium text-marigold">Open ›</span>
      </Link>
    </div>
  );
}
