import { useEffect, useSyncExternalStore } from 'react';
import { supabase } from './supabaseClient';
import { useAuth } from '../context/AuthContext';

// What the signed-in person told us in the welcome flow, plus what they've actually done. Drives the welcome
// redirect, the role-based menu and the getting-started checklist. Shared and cached across the app.
export type Role = 'attendee' | 'artist' | 'services' | 'organizer' | 'organization';
export interface SetupState {
  full_name: string | null; photo: string | null; city: string | null; interests: string[];
  roles: Role[]; onboarded: boolean; checklist_dismissed: boolean; show_all_tools: boolean; is_admin: boolean;
  has_events: boolean; has_published_event: boolean; has_resource: boolean; has_org: boolean; payouts_ready: boolean;
  follows_orgs: number; saved_events: number; has_ticket: boolean; has_networking_card: boolean;
}
let state: SetupState | null = null;
let forUser: string | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export async function reloadSetup() {
  const { data } = await supabase.rpc('my_setup_state');
  state = (data ?? null) as SetupState | null;
  emit();
}

export function useSetup() {
  const { user } = useAuth();
  const s = useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => state, () => null);
  useEffect(() => {
    if (!user?.id) { state = null; forUser = null; emit(); return; }
    if (forUser !== user.id) { forUser = user.id; state = null; loading = reloadSetup().finally(() => { loading = null; }); }
    else if (!state && !loading) loading = reloadSetup().finally(() => { loading = null; });
  }, [user?.id]);
  return s;
}

// Roles they chose, plus roles implied by what they've done.
export function effectiveRoles(s: SetupState | null): Set<Role> {
  const r = new Set<Role>(s?.roles ?? []);
  if (s?.has_events) r.add('organizer');
  if (s?.has_resource) r.add('artist');
  if (s?.has_org) r.add('organization');
  return r;
}
