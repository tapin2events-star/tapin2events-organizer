import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import EventCover from '../components/EventCover';

interface PlanEvent {
  id: string; title: string; status: 'draft' | 'published'; start_date: string | null; is_test: boolean; poster_url: string | null; category: string | null; event_type: string; is_owner: boolean;
  has_details: boolean; has_photo: boolean; has_date: boolean; has_location: boolean; tickets_ready: boolean; needs_payouts: boolean;
  lineup_confirmed: number; lineup_total: number; open_tasks: number; overdue_tasks: number; tickets_sold: number; capacity: number | null; prospects: number;
}
interface PlanTask { id: string; event_id: string; event_title: string; title: string; status: string; due_date: string | null; assigned_to: string | null; assignee_name: string | null }
interface Board { id: string; name: string; cards?: number; card_count?: number; prospects?: number; updated_at?: string }

const decode = (t: string) => t.replace(/&#8217;|&rsquo;/g, '’').replace(/&amp;/g, '&').replace(/&#39;/g, "'");
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'No date yet');
const daysUntil = (iso: string | null) => (iso ? Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000) : null);

// One checklist chip: done (green check) or needs attention (amber, links to the fix).
function Chip({ ok, label, to, neutral = false }: { ok: boolean; label: string; to: string; neutral?: boolean }) {
  const cls = ok ? 'bg-green-50 text-green-800' : neutral ? 'bg-gray-100 text-gray-600' : 'bg-amber-50 text-amber-900 ring-1 ring-amber-200';
  return (
    <Link to={to} className={`inline-flex min-h-[32px] items-center gap-1 rounded-full px-2.5 text-xs font-medium ${cls}`}>
      <span aria-hidden="true">{ok ? '✓' : neutral ? '·' : '!'}</span>{label}
    </Link>
  );
}

// Planning: what needs attention across your upcoming events, drafts, tasks and scouting.
export default function Planning() {
  const [events, setEvents] = useState<PlanEvent[] | null>(null);
  const [tasks, setTasks] = useState<PlanTask[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  useEffect(() => {
    supabase.rpc('planning_overview').then(({ data }) => setEvents(((data ?? []) as PlanEvent[])));
    supabase.rpc('planning_tasks').then(({ data }) => setTasks((data ?? []) as PlanTask[]));
    supabase.rpc('my_scout_boards').then(({ data }) => setBoards(((data ?? []) as Board[]).slice(0, 6)));
  }, []);

  const upcoming = (events ?? []).filter((e) => e.status === 'published');
  const drafts = (events ?? []).filter((e) => e.status === 'draft');
  const today = new Date().toISOString().slice(0, 10);
  const needsCount = upcoming.filter((e) => !e.has_details || !e.has_photo || !e.tickets_ready || e.needs_payouts || e.overdue_tasks > 0 || (e.lineup_total > 0 && e.lineup_confirmed < e.lineup_total)).length;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-bone">Planning</h1>
          <p className="mt-1 text-sm text-muted">What needs your attention across your events, drafts, tasks and scouting.</p>
        </div>
        <Link to="/organizer/new" className="rounded-xl bg-marigold px-4 py-2.5 text-sm font-semibold text-white">+ New event</Link>
      </div>

      {/* Event readiness */}
      <section className="mt-6">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-bone">Upcoming events</h2>
          {upcoming.length > 0 && <span className="text-xs text-muted">{needsCount ? `${needsCount} need${needsCount === 1 ? 's' : ''} attention` : 'All set'}</span>}
        </div>
        {events === null ? <div className="mt-3 h-32 animate-pulse rounded-2xl bg-gray-100" /> : upcoming.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-muted">No upcoming published events. <Link to="/organizer/new" className="font-medium text-marigold">Create one</Link></p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {upcoming.map((e) => {
              const base = `/organizer/events/${e.id}`;
              const d = daysUntil(e.start_date);
              return (
                <li key={e.id} className="rounded-2xl border border-gray-200 bg-surface p-3 sm:p-4">
                  <div className="flex gap-3">
                    <Link to={base} className="shrink-0">{e.poster_url ? <img src={e.poster_url} alt="" className="h-16 w-16 rounded-xl object-cover" /> : <EventCover category={e.category} size="sm" className="h-16 w-16 rounded-xl" />}</Link>
                    <div className="min-w-0 flex-1">
                      <Link to={base} className="line-clamp-2 font-semibold text-bone hover:underline">{decode(e.title)}{e.is_test && <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">TEST</span>}</Link>
                      <p className="text-xs text-muted">{when(e.start_date)}{d !== null && d >= 0 ? ` · ${d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`}` : ''} · {e.tickets_sold}{e.capacity ? ` / ${e.capacity}` : ''} {e.event_type === 'free' ? 'registered' : 'sold'}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Chip ok={e.has_details && e.has_photo && e.has_location} label={!e.has_photo ? 'Add a photo' : !e.has_details ? 'Add a description' : !e.has_location ? 'Add a location' : 'Details & photo'} to={`${base}/edit`} />
                    <Chip ok={e.tickets_ready && !e.needs_payouts} label={e.needs_payouts ? 'Set up payouts' : e.tickets_ready ? 'Tickets set up' : 'Set up tickets'} to={e.needs_payouts ? '/organizer' : `${base}/edit`} />
                    <Chip ok={e.lineup_total > 0 && e.lineup_confirmed === e.lineup_total} neutral={e.lineup_total === 0} label={e.lineup_total === 0 ? 'No lineup yet' : `Lineup: ${e.lineup_confirmed} of ${e.lineup_total} confirmed`} to={`${base}?tab=Lineup`} />
                    <Chip ok={e.open_tasks === 0} label={e.open_tasks === 0 ? 'No open tasks' : `${e.open_tasks} open task${e.open_tasks === 1 ? '' : 's'}${e.overdue_tasks ? ` (${e.overdue_tasks} overdue)` : ''}`} to={`${base}?tab=Team %26 tasks`} />
                    {e.prospects > 0 && <Chip ok neutral label={`${e.prospects} prospect${e.prospects === 1 ? '' : 's'} scouted`} to={`${base}?tab=Lineup`} />}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Drafts */}
      {drafts.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl font-bold text-bone">Drafts to finish</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {drafts.map((e) => {
              const missing = [!e.has_date && 'date', !e.has_location && 'location', !e.has_photo && 'photo', !e.has_details && 'description', !e.tickets_ready && 'tickets'].filter(Boolean) as string[];
              return (
                <li key={e.id}><Link to={`/organizer/events/${e.id}/edit`} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-surface p-3 hover:border-marigold">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-bone">{decode(e.title)}</span>
                    <span className="text-xs text-muted">{missing.length ? `Still needs: ${missing.join(', ')}` : 'Ready to publish'}{e.prospects ? ` · ${e.prospects} scouted` : ''}</span>
                  </span>
                  <span className="shrink-0 text-sm font-medium text-marigold">{missing.length ? 'Finish ›' : 'Publish ›'}</span>
                </Link></li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Tasks */}
      <section className="mt-8">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-bone">Open tasks</h2>
          <Link to="/my-activity#tasks" className="text-sm font-medium text-marigold">Assigned to me ›</Link>
        </div>
        {tasks.length === 0 ? <p className="mt-3 rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-muted">No open tasks across your events.</p> : (
          <ul className="mt-3 flex flex-col gap-2">
            {tasks.slice(0, 15).map((t) => {
              const overdue = t.due_date && t.due_date < today;
              return (
                <li key={t.id}><Link to={`/organizer/events/${t.event_id}?tab=Team %26 tasks`} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-surface p-3 hover:border-marigold">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-bone">{t.title}</span>
                    <span className="block truncate text-xs text-muted">{decode(t.event_title)} · {t.assignee_name || t.assigned_to || 'Unassigned'}</span>
                  </span>
                  {t.due_date && <span className={`shrink-0 text-xs font-semibold ${overdue ? 'text-red-600' : 'text-muted'}`}>{overdue ? 'Overdue · ' : ''}{new Date(t.due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                </Link></li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Scouting */}
      <section className="mt-8 mb-6">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-bone">Scouting boards</h2>
          <Link to="/organizer/scouting" className="text-sm font-medium text-marigold">All boards ›</Link>
        </div>
        <p className="text-sm text-muted">Keep a running list of artists you'd love to book. When a show takes shape, open the board and choose <strong>Start an event</strong>.</p>
        {boards.length === 0 ? (
          <Link to="/organizer/scouting" className="mt-3 block rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm font-medium text-marigold">+ Start a scouting board</Link>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map((b) => (
              <Link key={b.id} to={`/organizer/scouting/${b.id}`} className="rounded-xl border border-gray-200 bg-surface p-3 hover:border-marigold">
                <span className="block truncate font-medium text-bone">{b.name}</span>
                <span className="text-xs text-muted">{Number(b.card_count ?? 0)} artist{Number(b.card_count ?? 0) === 1 ? '' : 's'}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
