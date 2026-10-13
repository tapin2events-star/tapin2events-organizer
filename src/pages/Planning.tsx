import { useEffect, useState } from 'react';
import MeetingsTab from '../components/planning/MeetingsTab';
import { meetingWhen, type MeetingRow, type PlanTarget, type PollRow } from '../lib/meetings';
import PlanningTaskSheet from '../components/planning/PlanningTaskSheet';
import PlanningTeam from '../components/planning/PlanningTeam';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import EventCover from '../components/EventCover';

interface PlanEvent {
  id: string; title: string; status: 'draft' | 'published'; start_date: string | null; is_test: boolean; poster_url: string | null; category: string | null; event_type: string; is_owner: boolean;
  has_details: boolean; has_photo: boolean; has_date: boolean; has_location: boolean; tickets_ready: boolean; needs_payouts: boolean;
  lineup_confirmed: number; lineup_total: number; open_tasks: number; overdue_tasks: number; tickets_sold: number; capacity: number | null; prospects: number;
  my_role: string | null; organization_id: string | null; org_name: string | null; org_slug: string | null; org_logo: string | null; org_color: string | null;
}
interface PlanTask { id: string; event_id: string; event_title: string; title: string; status: string; due_date: string | null; assigned_to: string | null; assignee_name: string | null; organization_id: string | null; can_manage: boolean }
interface Board { id: string; name: string; card_count?: number; organization_id: string | null; org_name: string | null; org_logo: string | null; is_owner: boolean }
interface MyOrg { id: string; name: string; slug: string; logo_url: string | null; role: string; status?: string }

const decode = (t: string) => t.replace(/&#8217;|&rsquo;/g, '’').replace(/&amp;/g, '&').replace(/&#39;/g, "'");
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'No date yet');
const daysUntil = (iso: string | null) => (iso ? Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000) : null);

// "Hosted by" chip for organization events.
function HostChip({ e }: { e: { org_name: string | null; org_logo: string | null; org_color: string | null } }) {
  if (!e.org_name) return null;
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ background: e.org_color || '#0F1B3D' }}>
      {e.org_logo && <img src={e.org_logo} alt="" className="h-3.5 w-3.5 rounded-full object-cover" />}
      <span className="truncate">{e.org_name}</span>
    </span>
  );
}

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
type View = 'all' | 'events' | 'drafts' | 'tasks' | 'team' | 'meetings' | 'scouting';
const VIEWS: View[] = ['all', 'team', 'meetings', 'scouting', 'drafts', 'events', 'tasks'];

export default function Planning() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  // The section shown comes from the address (#events, #tasks…), so Back and links work.
  const view: View = (VIEWS as string[]).includes(location.hash.slice(1)) ? (location.hash.slice(1) as View) : 'all';
  // Switching tabs keeps the "Planning for" choice (?for=) in the address.
  const setView = (v: View) => navigate({ search: location.search, hash: v === 'all' ? '' : v }, { replace: true });
  const [query, setQuery] = useState('');
  // "Planning for": everything, just me, or one organization (?for=me / ?for=<org slug>).
  const [orgs, setOrgs] = useState<MyOrg[]>([]);
  const forParam = new URLSearchParams(location.search).get('for') ?? '';
  const scopeOrg = orgs.find((o) => o.slug === forParam) ?? null;
  const scope: 'all' | 'me' | 'org' = forParam === 'me' ? 'me' : scopeOrg ? 'org' : 'all';
  const setScope = (v: string) => {
    const sp = new URLSearchParams(location.search);
    if (v) sp.set('for', v); else sp.delete('for');
    try { if (v) localStorage.setItem('tapin_planning_for', v); else localStorage.removeItem('tapin_planning_for'); } catch { /* storage unavailable */ }
    navigate({ search: sp.toString() ? `?${sp}` : '', hash: location.hash }, { replace: true });
  };
  // Opening Planning with no choice in the address: use the one you picked last time.
  useEffect(() => {
    if (new URLSearchParams(location.search).has('for')) return;
    let saved: string | null = null;
    try { saved = localStorage.getItem('tapin_planning_for'); } catch { /* storage unavailable */ }
    if (saved) navigate({ search: `?for=${encodeURIComponent(saved)}`, hash: location.hash }, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const inScope = (orgId: string | null) => scope === 'all' || (scope === 'me' ? !orgId : orgId === scopeOrg?.id);
  const [needsOnly, setNeedsOnly] = useState(false);
  const [taskFilter, setTaskFilter] = useState<'all' | 'mine' | 'overdue' | 'unassigned'>('all');
  const [taskSheet, setTaskSheet] = useState<null | 'new' | PlanTask>(null);
  const [taskMsg, setTaskMsg] = useState<string | null>(null);
  const [events, setEvents] = useState<PlanEvent[] | null>(null);
  const [tasks, setTasks] = useState<PlanTask[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [polls, setPolls] = useState<PollRow[]>([]);
  useEffect(() => {
    supabase.rpc('my_meetings').then(({ data }) => setMeetings((data ?? []) as MeetingRow[]));
    supabase.rpc('my_polls').then(({ data }) => setPolls((data ?? []) as PollRow[]));
  }, [reloadKey]);
  const [busiest, setBusiest] = useState<{ name: string; overdue: number } | null>(null);
  useEffect(() => {
    supabase.rpc('planning_people').then(({ data }) => {
      const top = ((data ?? []) as { full_name: string | null; email: string; overdue_tasks: number }[]).find((p) => Number(p.overdue_tasks) > 0);
      setBusiest(top ? { name: (top.full_name || top.email).split(' ')[0], overdue: Number(top.overdue_tasks) } : null);
    });
  }, [reloadKey]);
  useEffect(() => {
    supabase.rpc('planning_overview').then(({ data }) => setEvents(((data ?? []) as PlanEvent[])));
    supabase.rpc('planning_tasks').then(({ data }) => setTasks((data ?? []) as PlanTask[]));
    supabase.rpc('my_scout_boards').then(({ data }) => setBoards((data ?? []) as Board[]));
    supabase.rpc('my_organizations').then(({ data }) => setOrgs(((data ?? []) as MyOrg[]).filter((o) => o.status !== 'deleted')));
  }, [reloadKey]);

  const q = query.trim().toLowerCase();
  const matches = (t: string) => !q || decode(t).toLowerCase().includes(q);
  const needsAttention = (e: PlanEvent) => !e.has_details || !e.has_photo || !e.has_location || !e.tickets_ready || e.needs_payouts || e.overdue_tasks > 0 || (e.lineup_total > 0 && e.lineup_confirmed < e.lineup_total);
  const scopedEvents = (events ?? []).filter((e) => inScope(e.organization_id));
  const allUpcoming = scopedEvents.filter((e) => e.status === 'published');
  const upcoming = allUpcoming.filter((e) => matches(e.title) && (!needsOnly || needsAttention(e)));
  const drafts = scopedEvents.filter((e) => e.status === 'draft' && matches(e.title));
  const today = new Date().toISOString().slice(0, 10);
  const needsCount = allUpcoming.filter(needsAttention).length;
  const me = (user?.email ?? '').toLowerCase();
  const scopedTasks = tasks.filter((t) => inScope(t.organization_id));
  const taskEvents = scopedEvents.filter((e) => e.is_owner || e.my_role === 'owner' || e.my_role === 'admin' || e.my_role === 'editor')
    .map((e) => ({ id: e.id, title: e.title, start_date: e.start_date }));
  async function completeTask(t: PlanTask) {
    const { error } = await supabase.from('event_tasks').update({ status: 'completed' }).eq('id', t.id);
    if (!error) { setTasks((list) => list.filter((x) => x.id !== t.id)); setTaskMsg(`Marked "${t.title}" done.`); setTimeout(() => setTaskMsg(null), 3000); }
  }
  const shownTasks = scopedTasks
    .filter((t) => matches(t.title) || matches(t.event_title))
    .filter((t) => taskFilter === 'all' ? true : taskFilter === 'mine' ? (t.assigned_to ?? '').toLowerCase() === me : taskFilter === 'overdue' ? !!t.due_date && t.due_date < today : !t.assigned_to);
  const overdueCount = scopedTasks.filter((t) => t.due_date && t.due_date < today).length;
  const scopedBoards = boards.filter((b) => inScope(b.organization_id));
  const scopedMeetings = meetings.filter((m) => inScope(m.organization_id));
  const scopedPolls = polls.filter((p) => inScope(p.organization_id));
  const nextMeeting = scopedMeetings.find((m) => m.status === 'scheduled' && new Date(m.starts_at).getTime() > Date.now() - 30 * 60000) ?? null;
  const pendingAnswers = scopedPolls.filter((p) => !p.i_voted).length + scopedMeetings.filter((m) => m.status === 'scheduled' && m.my_rsvp === 'pending' && new Date(m.starts_at).getTime() > Date.now()).length;
  // Where you can schedule meetings/polls: events where you're organizer/Admin/Editor, and organizations where you're Owner/Admin/Editor.
  const planTargets: PlanTarget[] = [
    ...orgs.filter((o) => ['owner', 'admin', 'editor'].includes(o.role)).map((o) => ({ kind: 'org' as const, id: o.id, label: o.name, orgId: o.id })),
    ...scopedEvents.filter((e) => e.is_owner || ['owner', 'admin', 'editor'].includes(e.my_role ?? '')).map((e) => ({ kind: 'event' as const, id: e.id, label: e.title, orgId: e.organization_id })),
  ];
  const defaultTarget = scope === 'org' && scopeOrg && ['owner', 'admin', 'editor'].includes(scopeOrg.role) ? `org:${scopeOrg.id}` : '';
  const draftCount = scopedEvents.filter((e) => e.status === 'draft').length;
  const shownBoards = scopedBoards.filter((b) => matches(b.name)).slice(0, view === 'scouting' ? 100 : 6);
  const show = (v: View) => view === 'all' || view === v;
  const tabs: { v: View; label: string; count?: number; alert?: number }[] = [
    { v: 'all', label: 'Overview' },
    { v: 'team', label: 'Team' },
    { v: 'meetings', label: 'Meetings', count: scopedMeetings.filter((m) => m.status === 'scheduled' && new Date(m.starts_at).getTime() > Date.now() - 30 * 60000).length + scopedPolls.length, alert: pendingAnswers },
    { v: 'scouting', label: 'Scouting', count: scopedBoards.length },
    { v: 'drafts', label: 'Drafts', count: draftCount },
    { v: 'events', label: 'Events', count: allUpcoming.length, alert: needsCount },
    { v: 'tasks', label: 'Tasks', count: scopedTasks.length, alert: overdueCount },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-bone">Planning</h1>
          <p className="mt-1 text-sm text-muted">What needs your attention across your events, drafts, tasks and scouting.</p>
        </div>
        <Link to="/organizer/new" className="rounded-xl bg-marigold px-4 py-2.5 text-sm font-semibold text-white">+ New event</Link>
      </div>

      {/* Section switcher (sticky) + search */}
      <div className="sticky top-[calc(3.6rem+env(safe-area-inset-top,0px))] z-20 -mx-4 md:top-0 mt-4 border-b border-gray-200 bg-[var(--color-bg,#F7F7FB)]/95 px-4 pb-3 pt-2 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-3">
        {orgs.length > 0 && (
          <label className="mb-2 flex items-center gap-2 text-sm">
            <span className="shrink-0 font-medium text-muted">Planning for</span>
            <select value={scope === 'all' ? '' : forParam} onChange={(e) => setScope(e.target.value)} aria-label="Planning for"
              className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900 sm:flex-none">
              <option value="">Everything</option>
              <option value="me">Just me (events I host myself)</option>
              {orgs.map((o) => <option key={o.id} value={o.slug}>{o.name}</option>)}
            </select>
          </label>
        )}
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Planning sections">
          {tabs.map((t) => (
            <button key={t.v} role="tab" aria-selected={view === t.v} onClick={() => setView(t.v)}
              className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium ${view === t.v ? 'bg-marigold text-white' : 'border border-gray-300 bg-white text-gray-700'}`}>
              {t.label}
              {t.count !== undefined && <span className={`rounded-full px-1.5 text-xs ${view === t.v ? 'bg-white/25' : 'bg-gray-100 text-gray-600'}`}>{t.count}</span>}
              {!!t.alert && <span className="h-2 w-2 rounded-full bg-amber-500" title={`${t.alert} need${t.alert === 1 ? 's' : ''} attention`} />}
            </button>
          ))}
        </div>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search events, tasks and boards" aria-label="Search planning"
          className="mt-2 block w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 sm:text-sm" />
      </div>

      {/* Overview: next meeting */}
      {view === 'all' && (nextMeeting || pendingAnswers > 0) && (
        <button onClick={() => setView('meetings')} className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-3 text-left">
          <span className="text-2xl" aria-hidden="true">📅</span>
          <span className="min-w-0 flex-1">
            {nextMeeting ? <>
              <span className="block truncate text-sm font-semibold text-bone">Next meeting: {nextMeeting.title}</span>
              <span className="block truncate text-xs text-muted">{meetingWhen(nextMeeting.starts_at)} · {nextMeeting.going} going{nextMeeting.my_rsvp === 'pending' ? ' · you haven’t replied' : ''}</span>
            </> : <span className="block text-sm font-semibold text-bone">Meetings & polls</span>}
            {pendingAnswers > 0 && <span className="block text-xs font-semibold text-amber-800">{pendingAnswers} waiting for your answer</span>}
          </span>
          <span className="shrink-0 text-sm font-medium text-marigold">Open ›</span>
        </button>
      )}

      {/* Overview: quick summary tiles */}
      {view === 'all' && events !== null && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[
            { v: 'team' as View, n: busiest ? busiest.overdue : 0, label: busiest ? `overdue for ${busiest.name}` : 'teammates behind', warn: !!busiest },
            { v: 'scouting' as View, n: scopedBoards.length, label: scopedBoards.length === 1 ? 'scouting board' : 'scouting boards', warn: false },
            { v: 'drafts' as View, n: draftCount, label: 'drafts to finish', warn: false },
            { v: 'events' as View, n: needsCount, label: needsCount === 1 ? 'event needs attention' : 'events need attention', warn: needsCount > 0 },
            { v: 'tasks' as View, n: overdueCount, label: overdueCount === 1 ? 'overdue task' : 'overdue tasks', warn: overdueCount > 0 },
          ].map((tile) => (
            <button key={tile.v} onClick={() => { if (tile.v === 'events' && tile.n > 0) setNeedsOnly(true); setView(tile.v); }}
              className={`rounded-2xl border p-3 text-left ${tile.warn ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-surface'}`}>
              <span className={`block font-display text-2xl font-extrabold ${tile.warn ? 'text-amber-900' : 'text-bone'}`}>{tile.n}</span>
              <span className={`text-xs ${tile.warn ? 'text-amber-900' : 'text-muted'}`}>{tile.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Meetings */}
      {view === 'meetings' && (
        <section className="mt-6">
          <MeetingsTab meetings={scopedMeetings} polls={scopedPolls} targets={planTargets} defaultTarget={defaultTarget} canSchedule={planTargets.length > 0 || scope !== 'org'} query={query} onChanged={() => setReloadKey((k) => k + 1)} />
        </section>
      )}

      {/* Team */}
      {view === 'team' && (
        <section className="mt-6">
          <PlanningTeam query={query} tasks={scopedTasks} events={(events ?? []).filter((e) => e.is_owner)} onChanged={() => setReloadKey((k) => k + 1)} scope={scope} scopeOrgId={scopeOrg?.id ?? null} />
        </section>
      )}

      {/* Scouting */}
      {show('scouting') && (
      <section className="mt-8 mb-6">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-bone">Scouting boards</h2>
          <Link to="/organizer/scouting" className="text-sm font-medium text-marigold">All boards ›</Link>
        </div>
        <p className="text-sm text-muted">Keep a running list of artists you'd love to book. When a show takes shape, open the board and choose <strong>Start an event</strong>.</p>
        {shownBoards.length === 0 && scopedBoards.length > 0 ? <p className="mt-3 text-sm text-muted">No boards match.</p> : scopedBoards.length === 0 ? (
          <Link to="/organizer/scouting" className="mt-3 block rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm font-medium text-marigold">+ Start a scouting board</Link>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {shownBoards.map((b) => (
              <Link key={b.id} to={`/organizer/scouting/${b.id}`} className="rounded-xl border border-gray-200 bg-surface p-3 hover:border-marigold">
                <span className="block truncate font-medium text-bone">{b.name}</span>
                <span className="text-xs text-muted">{Number(b.card_count ?? 0)} artist{Number(b.card_count ?? 0) === 1 ? '' : 's'}{b.org_name ? ` · ${b.org_name}` : ''}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
      )}
      {/* Drafts */}
      {show('drafts') && (view === 'drafts' || drafts.length > 0) && (
        <section className="mt-8">
          <h2 className="font-display text-xl font-bold text-bone">Drafts to finish</h2>
          {drafts.length === 0 && <p className="mt-3 rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-muted">{q ? 'No drafts match.' : 'No drafts. Everything you started is published.'}</p>}
          <ul className="mt-3 flex flex-col gap-2">
            {drafts.map((e) => {
              const missing = [!e.has_date && 'date', !e.has_location && 'location', !e.has_photo && 'photo', !e.has_details && 'description', !e.tickets_ready && 'tickets'].filter(Boolean) as string[];
              return (
                <li key={e.id}><Link to={`/organizer/events/${e.id}/edit`} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-surface p-3 hover:border-marigold">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-bone">{decode(e.title)}</span>
                    {e.org_name && <span className="block"><HostChip e={e} /></span>}
                    <span className="text-xs text-muted">{missing.length ? `Still needs: ${missing.join(', ')}` : 'Ready to publish'}{e.prospects ? ` · ${e.prospects} scouted` : ''}</span>
                  </span>
                  <span className="shrink-0 text-sm font-medium text-marigold">{missing.length ? 'Finish ›' : 'Publish ›'}</span>
                </Link></li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Event readiness */}
      {show('events') && (
      <section className="mt-6">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-bone">Upcoming events</h2>
          {allUpcoming.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={needsOnly} onChange={(e) => setNeedsOnly(e.target.checked)} className="h-4 w-4 accent-marigold" />
              Needs attention only{needsCount ? ` (${needsCount})` : ''}
            </label>
          )}
        </div>
        {events === null ? <div className="mt-3 h-32 animate-pulse rounded-2xl bg-gray-100" /> : upcoming.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-muted">
            {allUpcoming.length === 0 ? <>No upcoming published events. <Link to="/organizer/new" className="font-medium text-marigold">Create one</Link></> : needsOnly && !q ? 'Everything is set. Nice work!' : 'No events match.'}
          </p>
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
                      {e.org_name && <div className="mt-0.5"><HostChip e={e} /></div>}
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
      )}

      {/* Tasks */}
      {show('tasks') && (
      <section className="mt-8">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-bone">Open tasks</h2>
          <span className="flex items-center gap-3">
            <Link to="/activity#tasks" className="text-sm font-medium text-marigold">Assigned to me ›</Link>
            {taskEvents.length > 0 && <button onClick={() => setTaskSheet('new')} className="rounded-xl bg-marigold px-3 py-2 text-sm font-semibold text-white">+ New task</button>}
          </span>
        </div>
        {taskMsg && <p role="status" className="mt-2 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">{taskMsg}</p>}
        {scopedTasks.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {([['all', 'All'], ['mine', 'Mine'], ['overdue', `Overdue${overdueCount ? ` (${overdueCount})` : ''}`], ['unassigned', 'Unassigned']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setTaskFilter(k)} className={`min-h-[36px] rounded-full px-3 text-sm font-medium ${taskFilter === k ? 'bg-marigold text-white' : 'bg-gray-100 text-gray-600'}`}>{l}</button>
            ))}
          </div>
        )}
        {shownTasks.length === 0 ? <p className="mt-3 rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-muted">{scopedTasks.length === 0 ? 'No open tasks here.' : 'No tasks match.'}</p> : (
          <ul className="mt-3 flex flex-col gap-2">
            {shownTasks.slice(0, view === 'tasks' ? 100 : 8).map((t) => {
              const overdue = t.due_date && t.due_date < today;
              return (
                <li key={t.id} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-surface p-2 pl-3">
                  {(t.can_manage || (t.assigned_to ?? '').toLowerCase() === me) && (
                    <button onClick={() => completeTask(t)} aria-label={`Mark "${t.title}" done`} title="Mark done"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-gray-300 text-transparent hover:border-green-600 hover:text-green-600">✓</button>
                  )}
                  <Link to={`/organizer/events/${t.event_id}?tab=Team %26 tasks`} className="min-w-0 flex-1 py-1">
                    <span className="block truncate text-sm font-medium text-bone">{t.title}</span>
                    <span className="block truncate text-xs text-muted">{decode(t.event_title)} · <span className={t.assigned_to ? '' : 'font-semibold text-amber-700'}>{t.assignee_name || t.assigned_to || 'Unassigned'}</span></span>
                  </Link>
                  {t.due_date && <span className={`shrink-0 text-xs font-semibold ${overdue ? 'text-red-600' : 'text-muted'}`}>{overdue ? 'Overdue · ' : ''}{new Date(t.due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                  {t.can_manage && <button onClick={() => setTaskSheet(t)} className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium text-marigold hover:bg-marigold/10">{t.assigned_to ? 'Reassign' : 'Assign'}</button>}
                </li>
              );
            })}
          </ul>
        )}
        {view === 'all' && shownTasks.length > 8 && <button onClick={() => setView('tasks')} className="mt-2 text-sm font-medium text-marigold">See all {shownTasks.length} tasks ›</button>}
      </section>
      )}

      {taskSheet && (
        <PlanningTaskSheet
          events={taskSheet === 'new' ? taskEvents : [{ id: taskSheet.event_id, title: taskSheet.event_title, start_date: null }]}
          task={taskSheet === 'new' ? null : taskSheet}
          onClose={() => setTaskSheet(null)}
          onDone={(m) => { setTaskSheet(null); setTaskMsg(m); setTimeout(() => setTaskMsg(null), 3500); setReloadKey((k) => k + 1); }}
        />
      )}
    </div>
  );
}
