import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

// Counts of things waiting on the signed-in person, for the side menu.
export interface NavBadges { bookings: number; vendorApps: number; resourceRequests: number; groupInvites: number }
const EMPTY: NavBadges = { bookings: 0, vendorApps: 0, resourceRequests: 0, groupInvites: 0 };

export function useNavBadges(email: string | undefined, userId: string | undefined, refreshKey: unknown) {
  const [badges, setBadges] = useState<NavBadges>(EMPTY);
  useEffect(() => {
    if (!email || !userId) { setBadges(EMPTY); return; }
    let cancelled = false;
    (async () => {
      const { data: myEvents } = await supabase.from('events').select('id').eq('organizer_id', userId).limit(500);
      const eventIds = (myEvents ?? []).map((e) => e.id);
      const [bk, va, rr, gi] = await Promise.all([
        // Organizer needs to respond to a counter offer.
        supabase.from('resource_bookings').select('id', { count: 'exact', head: true }).eq('organizer_email', email).eq('status', 'counter_offered'),
        eventIds.length
          ? supabase.from('event_vendor_applications').select('id', { count: 'exact', head: true }).in('event_id', eventIds).eq('status', 'pending')
          : Promise.resolve({ count: 0 }),
        // New booking requests for my resource profile.
        supabase.from('resource_bookings').select('id', { count: 'exact', head: true }).eq('resource_email', email).eq('status', 'pending'),
        supabase.rpc('my_groups'),
      ]);
      if (cancelled) return;
      setBadges({
        bookings: bk.count ?? 0,
        vendorApps: va.count ?? 0,
        resourceRequests: rr.count ?? 0,
        groupInvites: ((gi.data ?? []) as { status: string }[]).filter((g) => g.status === 'invited').length,
      });
    })();
    return () => { cancelled = true; };
  }, [email, userId, refreshKey]);
  return badges;
}
