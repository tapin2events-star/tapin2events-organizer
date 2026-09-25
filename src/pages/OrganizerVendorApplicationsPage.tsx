import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import VendorApplicationsTab from '../components/tabs/VendorApplicationsTab';

interface EventSummary {
  id: string;
  title: string;
  start_date: string | null;
  organizer_id: string;
  total: number;
  pending: number;
}

// One place for organizers to review vendor applications across every event
// they run -- plus events where they're on the team (including as a Vendor
// Manager). Each event reuses the same VendorApplicationsTab that lives on
// the event's own page, so approving/rejecting behaves identically.
export default function OrganizerVendorApplicationsPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlyPending, setOnlyPending] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: own }, { data: collabs }] = await Promise.all([
        supabase.from('events').select('id, title, start_date, organizer_id').eq('organizer_id', user.id),
        user.email
          ? supabase.from('event_collaborations').select('event_id').eq('collaborator_email', user.email)
          : Promise.resolve({ data: [] as { event_id: string }[] }),
      ]);
      const ownIds = new Set((own ?? []).map((e) => e.id));
      const extraIds = [...new Set((collabs ?? []).map((c) => c.event_id))].filter((id) => !ownIds.has(id));
      const { data: extra } = extraIds.length
        ? await supabase.from('events').select('id, title, start_date, organizer_id').in('id', extraIds)
        : { data: [] as Omit<EventSummary, 'total' | 'pending'>[] };

      const allEvents = [...(own ?? []), ...(extra ?? [])];
      const ids = allEvents.map((e) => e.id);
      const { data: apps } = ids.length
        ? await supabase.from('event_vendor_applications').select('event_id, status').in('event_id', ids)
        : { data: [] as { event_id: string; status: string }[] };

      const totals = new Map<string, number>();
      const pendings = new Map<string, number>();
      (apps ?? []).forEach((a) => {
        totals.set(a.event_id, (totals.get(a.event_id) ?? 0) + 1);
        if (a.status === 'pending') pendings.set(a.event_id, (pendings.get(a.event_id) ?? 0) + 1);
      });

      const summaries = allEvents
        .map((e) => ({ ...e, total: totals.get(e.id) ?? 0, pending: pendings.get(e.id) ?? 0 }))
        .filter((e) => e.total > 0)
        .sort((a, b) => b.pending - a.pending || (a.start_date ?? '').localeCompare(b.start_date ?? ''));

      setEvents(summaries);
      setExpanded(new Set(summaries.filter((e) => e.pending > 0).map((e) => e.id)));
      setLoading(false);
    })();
  }, [user]);

  const visible = useMemo(() => (onlyPending ? events.filter((e) => e.pending > 0) : events), [events, onlyPending]);
  const totalPending = events.reduce((sum, e) => sum + e.pending, 0);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link to="/organizer" className="text-sm font-medium text-marigold">&larr; Organizer Dashboard</Link>
      <h1 className="mt-2 font-display text-3xl font-extrabold text-bone">Vendor Applications</h1>
      <p className="mt-1 text-muted">Review vendor applications across all of your events in one place.</p>

      {loading ? (
        <p className="mt-6 text-muted">Loading…</p>
      ) : events.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-14 text-center">
          <p className="font-display text-lg font-semibold text-bone">No vendor applications yet</p>
          <p className="mt-1 text-sm text-muted">
            When vendors apply through the "Become a Vendor" form on your event pages, their applications will show up here.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-bone">
              <span className="font-semibold">{totalPending}</span> pending across{' '}
              <span className="font-semibold">{events.length}</span> event{events.length === 1 ? '' : 's'}
            </p>
            <div className="flex gap-1.5">
              {([
                { value: false, label: 'All' },
                { value: true, label: 'Pending only' },
              ] as const).map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => setOnlyPending(opt.value)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium ${onlyPending === opt.value ? 'bg-marigold text-white' : 'bg-gray-100 text-muted hover:bg-gray-200'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="mt-6 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center text-sm text-muted">
              Nothing waiting on you. Every application has been reviewed.
            </p>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              {visible.map((e) => (
                <div key={e.id} className="overflow-hidden rounded-xl border border-gray-200 bg-surface">
                  <button onClick={() => toggle(e.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-bone">{e.title}</p>
                      <p className="text-xs text-muted">
                        {e.start_date ? new Date(e.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date TBD'}
                        {' · '}
                        {e.total} application{e.total === 1 ? '' : 's'}
                        {e.organizer_id !== user?.id && ' · Team member'}
                      </p>
                    </div>
                    {e.pending > 0 && (
                      <span className="shrink-0 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700">
                        {e.pending} pending
                      </span>
                    )}
                    <span className="shrink-0 text-muted">{expanded.has(e.id) ? '▲' : '▼'}</span>
                  </button>
                  {expanded.has(e.id) && (
                    <div className="border-t border-gray-200 p-4">
                      <div className="mb-3 text-right">
                        <Link to={`/organizer/events/${e.id}`} className="text-xs font-medium text-marigold">Open event &rarr;</Link>
                      </div>
                      <VendorApplicationsTab eventId={e.id} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
