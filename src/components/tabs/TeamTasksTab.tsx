import { useState } from 'react';
import TeamTab from './TeamTab';
import TasksTab from './TasksTab';
import { useEventTeam } from '../../lib/useEventTeam';

// Team & tasks: who's on the event, and what each person needs to do.
export default function TeamTasksTab({ eventId, eventTitle }: { eventId: string; eventTitle: string }) {
  const { team, myRole, reload } = useEventTeam(eventId);
  const [filter, setFilter] = useState('all');
  const canManageTeam = myRole === 'owner' || myRole === 'admin';
  const canManageTasks = canManageTeam || myRole === 'editor';
  const owner = team.find((m) => m.role === 'owner');
  return (
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
  );
}
