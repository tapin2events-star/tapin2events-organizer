import { useState } from 'react';
import TeamTab from './TeamTab';
import TasksTab from './TasksTab';
import VolunteersTab from './VolunteersTab';
import { useEventTeam } from '../../lib/useEventTeam';
import type { TapEvent } from '../../lib/types';

// Team & tasks: who's on the event, what each person needs to do, and volunteer shifts.
export default function TeamTasksTab({ eventId, eventTitle, event, initialView = 'team' }: { eventId: string; eventTitle: string; event?: TapEvent; initialView?: 'team' | 'volunteers' }) {
  const { team, myRole, reload } = useEventTeam(eventId);
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState<'team' | 'volunteers'>(initialView);
  const canManageTeam = myRole === 'owner' || myRole === 'admin';
  const canManageTasks = canManageTeam || myRole === 'editor';
  const owner = team.find((m) => m.role === 'owner');
  const setViewAndUrl = (v: 'team' | 'volunteers') => {
    setView(v);
    const u = new URL(window.location.href);
    if (v === 'volunteers') u.searchParams.set('view', 'volunteers'); else u.searchParams.delete('view');
    window.history.replaceState(window.history.state, '', u.pathname + u.search + u.hash);
  };
  return (
    <div className="flex flex-col gap-6">
      {event && (
        <div className="flex gap-1.5" role="tablist" aria-label="Team & tasks views">
          {([['team', '👥 Team & tasks'], ['volunteers', '🙋 Volunteers']] as const).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={view === k} onClick={() => setViewAndUrl(k)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${view === k ? 'bg-[#0F1B3D] text-white' : 'border border-gray-200 bg-white text-gray-700'}`}>{l}</button>
          ))}
        </div>
      )}
      {view === 'volunteers' && event ? <VolunteersTab event={event} /> : (
        <div className="flex flex-col gap-8">
          {owner && (
            <p className="-mb-4 text-xs text-muted">
              Organizer: <button className={`font-medium ${filter === owner.email ? 'text-marigold' : 'text-bone'}`} onClick={() => setFilter(filter === owner.email ? 'all' : owner.email)}>{owner.full_name || owner.email}</button>
              {owner.open_tasks ? ` · ${owner.open_tasks} open task${owner.open_tasks === 1 ? '' : 's'}` : ''}
            </p>
          )}
          <TeamTab eventId={eventId} eventTitle={eventTitle} team={team} canManageTeam={canManageTeam} filter={filter} onPick={setFilter} onChanged={reload} />
          <TasksTab eventId={eventId} team={team} canManage={canManageTasks} filter={filter} onFilter={setFilter} onTeamChanged={reload} />
        </div>
      )}
    </div>
  );
}
