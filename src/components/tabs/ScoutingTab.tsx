import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import AddCardForm from '../scouting/AddCardForm';
import CardSheet from '../scouting/CardSheet';
import { STAGES, type Card, type Stage } from '../../lib/scouting';
import { useEventScouting } from '../../lib/useEventScouting';
import type { TapEvent } from '../../lib/types';

// Event dashboard > Scouting: the prospects penciled in for this event. Everyone on the
// event's team can see and work these cards; the rest of the season board stays private.
export default function ScoutingTab({ event }: { event: TapEvent }) {
  const { shows, cards, resources, names, load } = useEventScouting(event.id);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<Card | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const takenResourceIds = useMemo(() => new Set(cards.map((c) => c.resource_id).filter(Boolean) as string[]), [cards]);

  async function start() {
    setStarting(true); setError(null);
    const { error: e } = await supabase.rpc('start_event_scouting', { p_event_id: event.id });
    setStarting(false);
    if (e) return setError("Couldn't start scouting. Please try again.");
    load();
  }
  async function move(c: Card, stage: Stage) {
    await supabase.from('scout_cards').update({ stage }).eq('id', c.id);
    load();
  }

  if (shows === null) return <p className="mt-6 text-sm text-muted">Loading…</p>;
  if (shows.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-surface p-6 text-center">
        <p className="font-display text-lg font-semibold text-bone">Scout artists for this event</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">Keep a private list of artists you'd like for this show, with notes, ratings, and stages. Everyone on this event's team can work it together. Artists are never notified.</p>
        <button onClick={start} disabled={starting} className="mt-4 rounded-lg bg-marigold px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{starting ? 'Starting…' : 'Start scouting for this event'}</button>
        <p className="mt-3 text-xs text-muted">Already planning on a season board? Open it from <Link to="/organizer/scouting" className="font-medium text-marigold">Scouting</Link> and link one of its shows to this event.</p>
        {error && <p role="alert" className="mt-2 text-sm text-magenta">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm text-muted">Prospects penciled in for this event. Your event team can see and update them; artists are never notified.</p>
          <p className="text-xs text-muted">
            From {shows.length === 1 ? 'board show' : 'board shows'}: {shows.map((s) => s.name).join(', ')} ·{' '}
            <Link to={`/organizer/scouting/${shows[0].board_id}`} className="font-medium text-marigold">Open full board</Link>
          </p>
        </div>
        <button onClick={() => setAdding((a) => !a)} className="rounded-lg bg-marigold px-3 py-2 text-sm font-semibold text-white">+ Add artist</button>
      </div>
      {adding && (
        <div className="mt-3 max-w-xl">
          <AddCardForm boardId={shows[0].board_id} shows={shows} takenResourceIds={takenResourceIds} defaultShowId={shows[0].id} onAdded={load} onClose={() => setAdding(false)} />
        </div>
      )}
      {cards.length === 0 && !adding && <p className="mt-4 rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-muted">No prospects yet. Tap <strong>+ Add artist</strong>.</p>}
      <div className="mt-4 flex flex-col gap-5">
        {STAGES.map((s) => {
          const list = cards.filter((c) => c.stage === s.key).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
          if (!list.length) return null;
          return (
            <section key={s.key}>
              <p className="mb-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${s.color}`}>{s.label} · {list.length}</span></p>
              <ul className="flex flex-col gap-2">
                {list.map((c) => {
                  const r = c.resource_id ? resources.get(c.resource_id) : null;
                  const name = r?.display_name ?? c.outside_name ?? 'Artist';
                  return (
                    <li key={c.id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3">
                      <button type="button" onClick={() => setOpen(c)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                        {r?.profile_image ? <img src={r.profile_image} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-marigold to-teal font-bold text-white">{name.charAt(0).toUpperCase()}</span>}
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-gray-900">{name}{c.rating ? <span className="ml-1.5 text-xs text-amber-500">{'★'.repeat(c.rating)}</span> : null}</span>
                          <span className="block truncate text-xs text-gray-500">{c.notes || (r ? (r.categories ?? []).slice(0, 2).join(' · ') : 'Not on TapIN yet')}</span>
                        </span>
                      </button>
                      <select value={c.stage} onChange={(e) => move(c, e.target.value as Stage)} aria-label={`Stage for ${name}`} className="shrink-0 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700">
                        {STAGES.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
                      </select>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
      {open && (
        <CardSheet card={open} resource={open.resource_id ? resources.get(open.resource_id) ?? null : null} shows={shows}
          addedByName={open.added_by ? names.get(open.added_by) ?? null : null} onClose={() => setOpen(null)} onChanged={load} />
      )}
    </div>
  );
}
