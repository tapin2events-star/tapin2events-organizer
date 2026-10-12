import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export interface TeamMember { email: string; full_name: string | null; profile_photo: string | null; role: string; status: string; open_tasks: number }
export const ROLE_LABEL: Record<string, string> = { owner: 'Organizer', admin: 'Admin', editor: 'Editor', viewer: 'Viewer', vendor_manager: 'Vendor Manager', helper: 'Helper' };

// An event's team with each person's open-task count, plus my own role.
export function useEventTeam(eventId: string) {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [myRole, setMyRole] = useState<string | null>(null);
  const load = useCallback(async () => {
    const [{ data: t }, { data: r }] = await Promise.all([
      supabase.rpc('event_team', { p_event_id: eventId }),
      supabase.rpc('event_team_role', { p_event_id: eventId }),
    ]);
    setTeam(((t ?? []) as TeamMember[]).map((m) => ({ ...m, open_tasks: Number(m.open_tasks) || 0 })));
    setMyRole((r as string | null) ?? null);
  }, [eventId]);
  useEffect(() => { load(); }, [load]);
  return { team, myRole, reload: load };
}
