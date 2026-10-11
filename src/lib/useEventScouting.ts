import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import type { Card, CardResource, Show } from './scouting';

// Scouting cards penciled in for one event (from any board show linked to it).
export function useEventScouting(eventId: string) {
  const [shows, setShows] = useState<Show[] | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [resources, setResources] = useState<Map<string, CardResource>>(new Map());
  const [names, setNames] = useState<Map<string, string>>(new Map());

  const load = useCallback(async () => {
    const { data: s } = await supabase.from('scout_shows').select('*').eq('event_id', eventId).order('created_at');
    const list = (s ?? []) as Show[];
    setShows(list);
    if (!list.length) { setCards([]); return; }
    const { data: c } = await supabase.from('scout_cards').select('*').in('show_id', list.map((x) => x.id)).order('updated_at', { ascending: false });
    const cs = (c ?? []) as Card[];
    setCards(cs);
    const rids = [...new Set(cs.map((x) => x.resource_id).filter(Boolean))] as string[];
    if (rids.length) {
      const { data: rs } = await supabase.from('resources').select('id, display_name, profile_image, categories, kind, city').in('id', rids);
      setResources(new Map((rs ?? []).map((r) => [r.id, r as CardResource])));
    }
    const emails = [...new Set(cs.map((x) => x.added_by).filter(Boolean))] as string[];
    if (emails.length) {
      const { data: ppl } = await supabase.from('public_profiles').select('email, full_name').in('email', emails);
      setNames(new Map((ppl ?? []).map((p) => [p.email, p.full_name || p.email])));
    }
  }, [eventId]);
  useEffect(() => { load(); }, [load]);
  return { shows, cards, resources, names, load };
}
