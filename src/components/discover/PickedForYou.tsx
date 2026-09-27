import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { TapEvent } from '../../lib/types';
import { groupsFor, normalizeInterests, type InterestGroup } from '../../lib/interests';
import DiscoverEventCard from './DiscoverEventCard';
import InterestPicker from './InterestPicker';

const DAY = 24 * 60 * 60 * 1000;
const MAX_PICKS = 10;
const DISMISS_KEY = 'tapin_interest_prompt_dismissed';

interface Signals {
  interests: InterestGroup[];
  fromSaved: Map<InterestGroup, number>;
  fromTickets: Map<InterestGroup, number>;
  ticketEventIds: Set<string>;
}

function isUpcoming(e: TapEvent, now: number) {
  const end = e.end_date ?? e.start_date;
  return !!end && new Date(end).getTime() >= now;
}

// "Picked for you" on Discover. Scores upcoming events by category matches
// to the person's chosen interests (strongest), categories of events they've
// saved or have tickets for, and how soon the event is. Each pick shows why.
export default function PickedForYou({
  events,
  savedIds,
  userId,
  userEmail,
  onToggleSave,
}: {
  events: TapEvent[];
  savedIds: string[];
  userId: string;
  userEmail: string;
  onToggleSave: (eventId: string) => void;
}) {
  const [signals, setSignals] = useState<Signals | null>(null);
  const [editing, setEditing] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  async function loadSignals() {
    const [{ data: profile }, { data: tickets }] = await Promise.all([
      supabase.from('profiles').select('interests, saved_event_ids').eq('email', userEmail).single(),
      supabase.from('tickets').select('event_id').eq('attendee_email', userEmail).in('status', ['confirmed', 'checked_in']),
    ]);
    const saved = (profile?.saved_event_ids as string[]) ?? [];
    const ticketIds = [...new Set((tickets ?? []).map((t) => t.event_id as string))];
    const lookup = [...new Set([...saved, ...ticketIds])];
    const { data: signalEvents } = lookup.length
      ? await supabase.from('events').select('id, category').in('id', lookup)
      : { data: [] as { id: string; category: string }[] };
    const catById = new Map((signalEvents ?? []).map((e) => [e.id, e.category]));
    const tally = (ids: string[]) => {
      const m = new Map<InterestGroup, number>();
      ids.forEach((id) => groupsFor(catById.get(id)).forEach((g) => m.set(g, (m.get(g) ?? 0) + 1)));
      return m;
    };
    setSignals({
      interests: normalizeInterests(profile?.interests as string[]),
      fromSaved: tally(saved),
      fromTickets: tally(ticketIds),
      ticketEventIds: new Set(ticketIds),
    });
  }

  useEffect(() => {
    loadSignals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail]);

  async function saveInterests(groups: InterestGroup[]) {
    await supabase.from('profiles').update({ interests: groups }).eq('email', userEmail);
    setSignals((s) => (s ? { ...s, interests: groups } : s));
    setEditing(false);
  }

  const picks = useMemo(() => {
    if (!signals) return [];
    const now = Date.now();
    const chosen = new Set(signals.interests);
    const scored: { event: TapEvent; score: number; reason: string }[] = [];
    for (const e of events) {
      if (!isUpcoming(e, now) || savedIds.includes(e.id) || signals.ticketEventIds.has(e.id) || e.organizer_id === userId) continue;
      const catGroups = groupsFor(e.category);
      const titleGroups = [...groupsFor(e.title)].filter((g) => !catGroups.has(g));
      let score = 0;
      let reason = '';
      const weigh = (g: InterestGroup, weight: number) => {
        if (chosen.has(g)) {
          score += 3 * weight;
          if (!reason || !reason.startsWith("You're")) reason = `You're into ${g}`;
        }
        const s = signals.fromSaved.get(g) ?? 0;
        const t = signals.fromTickets.get(g) ?? 0;
        if (s + t > 0) {
          score += Math.min((s + t) * 1.5, 3) * weight;
          if (!reason) reason = t >= s ? "Like events you've gotten tickets for" : "Like events you've saved";
        }
      };
      catGroups.forEach((g) => weigh(g, 1));
      titleGroups.forEach((g) => weigh(g, 0.5)); // a title hint counts, but less than the category
      if (score === 0) continue;
      const days = e.start_date ? (new Date(e.start_date).getTime() - now) / DAY : 999;
      if (days <= 14) score += 1;
      else if (days <= 30) score += 0.5;
      scored.push({ event: e, score, reason });
    }
    // One pick per recurring series (its soonest date), so a weekly event
    // doesn't fill the whole row with copies of itself.
    const seenSeries = new Set<string>();
    return scored
      .sort((a, b) => b.score - a.score || (a.event.start_date ?? '').localeCompare(b.event.start_date ?? ''))
      .filter((p) => {
        const key = p.event.parent_event_id ?? p.event.id;
        if (seenSeries.has(key)) return false;
        seenSeries.add(key);
        return true;
      })
      .slice(0, MAX_PICKS);
  }, [signals, events, savedIds, userId]);

  if (!signals) return null;

  const hasSignals = signals.interests.length > 0 || signals.fromSaved.size > 0 || signals.fromTickets.size > 0;

  // No interests and nothing saved or booked yet: ask, unless they said not now.
  if ((!hasSignals && !dismissed) || editing) {
    return (
      <div className="mt-6 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-teal-50 p-5">
        <p className="font-display text-lg font-bold text-gray-900">{editing ? 'Your interests' : 'What are you into?'}</p>
        <p className="mt-0.5 text-sm text-gray-600">Pick a few and we'll suggest events for you.</p>
        <div className="mt-3">
          <InterestPicker
            initial={signals.interests}
            onSave={saveInterests}
            saveLabel={editing ? 'Save interests' : 'Show my picks'}
            cancelLabel={editing ? 'Cancel' : 'Not now'}
            onCancel={() => {
              if (editing) {
                setEditing(false);
                return;
              }
              setDismissed(true);
              try {
                localStorage.setItem(DISMISS_KEY, '1');
              } catch {
                // private browsing: the prompt just shows again next visit
              }
            }}
          />
        </div>
      </div>
    );
  }

  if (!hasSignals) return null;

  return (
    <div className="mt-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-gray-900">✨ Picked for you</h2>
        <button type="button" onClick={() => setEditing(true)} className="-my-2 shrink-0 py-2 text-sm font-medium text-marigold hover:underline">
          Edit interests
        </button>
      </div>
      {picks.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">No picks right now. We'll suggest events that match your interests as they're posted.</p>
      ) : (
        <div className="-mx-1 mt-3 flex snap-x gap-4 overflow-x-auto px-1 pb-3">
          {picks.map((p) => (
            <div key={p.event.id} className="w-[280px] shrink-0 snap-start">
              <p className="mb-1.5 truncate text-xs font-semibold text-marigold">{p.reason}</p>
              <DiscoverEventCard event={p.event} isSaved={savedIds.includes(p.event.id)} onToggleSave={onToggleSave} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
