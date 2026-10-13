import { useCallback, useEffect, useMemo, useState } from 'react';
import StartEventSheet from '../components/scouting/StartEventSheet';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import BackButton from '../components/BackButton';
import AddCardForm from '../components/scouting/AddCardForm';
import CardSheet from '../components/scouting/CardSheet';
import ShareSheet from '../components/scouting/ShareSheet';
import Sheet from '../components/scouting/Sheet';
import { STAGES, type Board, type Card, type CardResource, type Show, type Stage } from '../lib/scouting';

interface Person { email: string; full_name: string | null; profile_photo: string | null }
const MAIN: Stage[] = ['watching', 'reach_out', 'in_talks', 'confirmed'];

export default function ScoutingBoard() {
  const { id = '' } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [board, setBoard] = useState<Board | null | undefined>(undefined);
  const [shows, setShows] = useState<Show[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [resources, setResources] = useState<Map<string, CardResource>>(new Map());
  const [members, setMembers] = useState<Person[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [showFilter, setShowFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sheet, setSheet] = useState<null | 'add' | 'share' | 'shows' | 'rename' | 'delete' | 'start'>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openCard, setOpenCard] = useState<Card | null>(null);
  const [showPassed, setShowPassed] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const isOwner = board?.owner_email === user?.email;

  const load = useCallback(async () => {
    const [{ data: b }, { data: s }, { data: c }, { data: m }] = await Promise.all([
      supabase.from('scout_boards').select('id, name, description, owner_email').eq('id', id).maybeSingle(),
      supabase.from('scout_shows').select('*').eq('board_id', id).order('target_date', { ascending: true, nullsFirst: false }).order('created_at'),
      supabase.from('scout_cards').select('*').eq('board_id', id).order('updated_at', { ascending: false }),
      supabase.from('scout_board_members').select('user_email').eq('board_id', id),
    ]);
    setBoard((b as Board) ?? null);
    setShows((s ?? []) as Show[]);
    const list = (c ?? []) as Card[];
    setCards(list);
    const rids = [...new Set(list.map((x) => x.resource_id).filter(Boolean))] as string[];
    if (rids.length) {
      const { data: rs } = await supabase.from('resources').select('id, display_name, profile_image, categories, kind, city').in('id', rids);
      setResources(new Map((rs ?? []).map((r) => [r.id, r as CardResource])));
    }
    const emails = [...new Set([b?.owner_email, ...(m ?? []).map((x) => x.user_email), ...list.map((x) => x.added_by)].filter(Boolean))] as string[];
    if (emails.length) {
      const { data: ppl } = await supabase.from('public_profiles').select('email, full_name, profile_photo').in('email', emails);
      const byEmail = new Map((ppl ?? []).map((p) => [p.email, p as Person]));
      setNames(new Map((ppl ?? []).map((p) => [p.email, p.full_name || p.email])));
      setMembers([b?.owner_email, ...(m ?? []).map((x) => x.user_email)].filter(Boolean).map((e) => byEmail.get(e as string) ?? { email: e as string, full_name: null, profile_photo: null }));
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  const nameOf = (c: Card) => (c.resource_id ? resources.get(c.resource_id)?.display_name : null) ?? c.outside_name ?? 'Artist';
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return cards.filter((c) =>
      (showFilter === 'all' || (showFilter === 'none' ? !c.show_id : c.show_id === showFilter)) &&
      (!term || nameOf(c).toLowerCase().includes(term) || c.tags.some((t) => t.toLowerCase().includes(term))));
  }, [cards, showFilter, search, resources]); // eslint-disable-line react-hooks/exhaustive-deps
  const inStage = (s: Stage) => visible.filter((c) => c.stage === s).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  const takenResourceIds = useMemo(() => new Set(cards.map((c) => c.resource_id).filter(Boolean) as string[]), [cards]);
  const active = cards.filter((c) => c.stage !== 'passed');

  async function moveCard(cardId: string, stage: Stage) {
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, stage } : c)));
    await supabase.from('scout_cards').update({ stage }).eq('id', cardId);
  }

  if (board === undefined) return <p className="text-sm text-muted">Loading…</p>;
  if (board === null) {
    return (
      <div className="mx-auto max-w-2xl">
        <BackButton fallback="/organizer/scouting" fallbackLabel="Scouting" />
        <p className="mt-4 rounded-xl border border-gray-200 bg-surface p-6 text-center text-sm text-muted">This board doesn't exist or hasn't been shared with you.</p>
      </div>
    );
  }

  const cardView = (c: Card) => {
    const r = c.resource_id ? resources.get(c.resource_id) : null;
    const name = nameOf(c);
    const show = shows.find((s) => s.id === c.show_id);
    const detail = c.stage === 'in_talks' && c.booking_id ? 'Waiting for their reply' : show?.name ?? c.tags[0] ?? (r ? (r.categories ?? [])[0] : 'Not on TapIN yet');
    return (
      <button key={c.id} type="button" draggable onDragStart={() => setDragId(c.id)} onDragEnd={() => setDragId(null)} onClick={() => setOpenCard(c)}
        className={`flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm ring-1 ring-gray-200 transition hover:ring-marigold ${dragId === c.id ? 'opacity-40' : ''}`}>
        {r?.profile_image ? <img src={r.profile_image} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" /> : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-marigold to-teal font-bold text-white">{name.charAt(0).toUpperCase()}</span>}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-gray-900">{name}</span>
          <span className="block truncate text-xs text-gray-500">{detail}</span>
        </span>
        {c.rating ? <span className="shrink-0 text-xs text-amber-500" aria-label={`${c.rating} stars`}>{'★'.repeat(c.rating)}</span> : null}
      </button>
    );
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-3"><BackButton fallback="/organizer/scouting" fallbackLabel="Scouting" /></div>

      {/* Header: two clear actions, everything else in the ⋯ menu */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-extrabold text-bone sm:text-3xl">{board.name}</h1>
          <button onClick={() => setSheet('share')} className="mt-0.5 text-xs text-muted hover:text-marigold">
            🔒 Private · {members.length} {members.length === 1 ? 'planner' : 'planners'}
          </button>
        </div>
        <div className="relative flex shrink-0 items-center gap-2">
          <button onClick={() => setSheet('share')} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:border-marigold">Share</button>
          <button onClick={() => setMenuOpen((o) => !o)} aria-label="More options" className="rounded-xl border border-gray-300 bg-white px-2.5 py-2 text-gray-600 hover:border-marigold">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-11 z-30 w-48 rounded-xl border border-gray-200 bg-white p-1 shadow-lg" onMouseLeave={() => setMenuOpen(false)}>
              <button onClick={() => { setMenuOpen(false); setSheet('start'); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-marigold hover:bg-gray-50">Start an event</button>
              <button onClick={() => { setMenuOpen(false); setSheet('shows'); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">Manage shows</button>
              {isOwner && <button onClick={() => { setMenuOpen(false); setSheet('rename'); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">Rename board</button>}
              {isOwner && <button onClick={() => { setMenuOpen(false); setSheet('delete'); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50">Delete board</button>}
            </div>
          )}
        </div>
      </div>

      {active.length === 0 && cards.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-gray-300 bg-surface p-8 text-center">
          <p className="font-display text-xl font-bold text-bone">Start your list</p>
          <ol className="mx-auto mt-4 max-w-sm space-y-2 text-left text-sm text-muted">
            <li><strong className="text-bone">1.</strong> Add artists you're interested in, on TapIN or not.</li>
            <li><strong className="text-bone">2.</strong> Move them along as things progress: Watching, Reach out, In talks, Confirmed.</li>
            <li><strong className="text-bone">3.</strong> Send a lineup invite or booking when you're ready.</li>
          </ol>
          <button onClick={() => setSheet('add')} className="mt-6 rounded-xl bg-marigold px-5 py-3 text-sm font-semibold text-white">+ Add your first artist</button>
          <p className="mt-3 text-xs text-muted">Tip: tap <strong>Save to scouting board</strong> on any artist's profile.</p>
        </div>
      ) : (
        <>
          {/* Toolbar: add, filter by show, search */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button onClick={() => setSheet('add')} className="rounded-xl bg-marigold px-4 py-2.5 text-sm font-semibold text-white hover:bg-marigold/90">+ Add artist</button>
            {shows.length > 0 && (
              <select value={showFilter} onChange={(e) => setShowFilter(e.target.value)} aria-label="Filter by show"
                className="rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700">
                <option value="all">All shows</option>
                {shows.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                <option value="none">No show yet</option>
              </select>
            )}
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find an artist" aria-label="Find an artist"
              className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 sm:max-w-xs" />
          </div>

          {/* Stages: columns on a computer (drag to move), a simple list on a phone (tap to move) */}
          <div className="mt-5 grid gap-5 md:grid-cols-4 md:gap-3">
            {MAIN.map((key) => {
              const s = STAGES.find((x) => x.key === key)!;
              const list = inStage(key);
              return (
                <section key={key} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragId) moveCard(dragId, key); setDragId(null); }}
                  className={`rounded-3xl md:min-h-[260px] md:p-2.5 ${dragId ? 'md:bg-marigold/5 md:ring-1 md:ring-marigold/30' : 'md:bg-gray-50'}`}>
                  <h2 className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold text-bone md:text-gray-700">
                    {s.label}<span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">{list.length}</span>
                  </h2>
                  <div className="flex flex-col gap-2">
                    {list.length === 0 ? <p className="px-1 py-2 text-xs text-gray-400 md:py-6 md:text-center">{dragId ? 'Drop here' : 'No one here yet'}</p> : list.map(cardView)}
                  </div>
                </section>
              );
            })}
          </div>

          {inStage('passed').length > 0 && (
            <div className="mt-6">
              <button onClick={() => setShowPassed((v) => !v)} className="text-sm font-medium text-gray-500 hover:text-gray-700">
                {showPassed ? 'Hide' : 'Show'} passed ({inStage('passed').length})
              </button>
              {showPassed && <div className="mt-2 grid gap-2 opacity-70 sm:grid-cols-2 md:grid-cols-4">{inStage('passed').map(cardView)}</div>}
            </div>
          )}
          <p className="mt-6 hidden text-xs text-gray-400 md:block">Tip: drag a card to another column to move it, or tap it for details.</p>
        </>
      )}

      {/* Sheets */}
      {sheet === 'add' && (
        <Sheet title="Add an artist" onClose={() => setSheet(null)}>
          <AddCardForm boardId={board.id} shows={shows} takenResourceIds={takenResourceIds} defaultShowId={shows.some((s) => s.id === showFilter) ? showFilter : null}
            onAdded={() => load()} onClose={() => setSheet(null)} />
        </Sheet>
      )}
      {sheet === 'share' && <ShareSheet boardId={board.id} boardName={board.name} isOwner={!!isOwner} members={members} onClose={() => setSheet(null)} onChanged={load} onLeft={() => navigate('/organizer/scouting')} />}
      {sheet === 'shows' && <ShowsSheet boardId={board.id} shows={shows} onClose={() => setSheet(null)} onChanged={load} />}
      {sheet === 'start' && board && <StartEventSheet boardId={board.id} boardName={board.name} shows={shows as { id: string; name: string; target_date: string | null; event_id: string | null }[]} onClose={() => setSheet(null)} />}
      {sheet === 'rename' && <RenameSheet board={board} onClose={() => setSheet(null)} onChanged={load} />}
      {sheet === 'delete' && (
        <Sheet title="Delete this board?" onClose={() => setSheet(null)}>
          <p className="text-sm text-gray-600">"{board.name}" and everything on it will be deleted for all planners. This can't be undone.</p>
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setSheet(null)} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-700">Cancel</button>
            <button onClick={async () => { await supabase.from('scout_boards').delete().eq('id', board.id); navigate('/organizer/scouting'); }} className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white">Delete board</button>
          </div>
        </Sheet>
      )}
      {openCard && (
        <CardSheet card={openCard} resource={openCard.resource_id ? resources.get(openCard.resource_id) ?? null : null} shows={shows}
          addedByName={openCard.added_by ? names.get(openCard.added_by) ?? null : null} onClose={() => setOpenCard(null)} onChanged={load} />
      )}
    </div>
  );
}

function RenameSheet({ board, onClose, onChanged }: { board: Board; onClose: () => void; onChanged: () => void }) {
  const [name, setName] = useState(board.name);
  return (
    <Sheet title="Rename board" onClose={onClose}>
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className="w-full rounded-xl border border-gray-300 px-3 py-3 text-base text-gray-900" autoFocus aria-label="Board name" />
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-700">Cancel</button>
        <button disabled={!name.trim()} onClick={async () => { await supabase.from('scout_boards').update({ name: name.trim() }).eq('id', board.id); onChanged(); onClose(); }} className="rounded-xl bg-marigold px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Save</button>
      </div>
    </Sheet>
  );
}

function ShowsSheet({ boardId, shows, onClose, onChanged }: { boardId: string; shows: Show[]; onClose: () => void; onChanged: () => void }) {
  const { user } = useAuth();
  const [editing, setEditing] = useState<Show | 'new' | null>(shows.length ? null : 'new');
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [eventId, setEventId] = useState('');
  const [events, setEvents] = useState<{ id: string; title: string; start_date: string | null }[]>([]);
  useEffect(() => {
    if (!user?.id) return;
    supabase.from('events').select('id, title, start_date').eq('organizer_id', user.id).gte('start_date', new Date(Date.now() - 86400000).toISOString()).order('start_date').limit(50)
      .then(({ data }) => setEvents((data ?? []) as { id: string; title: string; start_date: string | null }[]));
  }, [user?.id]);
  useEffect(() => {
    if (editing && editing !== 'new') { setName(editing.name); setDate(editing.target_date ?? ''); setEventId(editing.event_id ?? ''); }
    else { setName(''); setDate(''); setEventId(''); }
  }, [editing]);
  async function save() {
    if (!name.trim()) return;
    const row = { board_id: boardId, name: name.trim().slice(0, 100), target_date: date || null, event_id: eventId || null };
    if (editing && editing !== 'new') await supabase.from('scout_shows').update(row).eq('id', editing.id);
    else await supabase.from('scout_shows').insert(row);
    onChanged(); setEditing(null);
  }
  async function remove(s: Show) {
    await supabase.from('scout_shows').delete().eq('id', s.id);
    onChanged(); setEditing(null);
  }
  const field = 'mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900';
  return (
    <Sheet title="Shows" onClose={onClose}>
      <p className="-mt-2 text-sm text-gray-500">Plan artists for specific shows, like four shows a year. Link a show to an event to send lineup invites from cards and let that event's team see its prospects.</p>
      {!editing ? (
        <>
          <ul className="mt-4 flex flex-col gap-2">
            {shows.map((s) => (
              <li key={s.id}>
                <button onClick={() => setEditing(s)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 p-3 text-left hover:border-marigold">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-gray-900">{s.name}</span>
                    <span className="block text-xs text-gray-500">{s.target_date ? new Date(s.target_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'No date yet'}{s.event_id ? ' · linked to an event' : ''}</span>
                  </span>
                  <span className="text-xs text-marigold">Edit</span>
                </button>
              </li>
            ))}
          </ul>
          <button onClick={() => setEditing('new')} className="mt-3 w-full rounded-xl border border-dashed border-gray-400 py-2.5 text-sm font-medium text-gray-600">+ Add a show</button>
        </>
      ) : (
        <div className="mt-4">
          <label className="block text-xs font-medium text-gray-500">Name<input className={field} value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder="e.g. Spring Showcase, March" autoFocus /></label>
          <label className="mt-3 block text-xs font-medium text-gray-500">Target date (optional)<input type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="mt-3 block text-xs font-medium text-gray-500">Linked event (optional)
            <select className={field} value={eventId} onChange={(e) => setEventId(e.target.value)}>
              <option value="">Not created yet</option>
              {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}{ev.start_date ? ` · ${new Date(ev.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}</option>)}
              {editing !== 'new' && editing.event_id && !events.some((e) => e.id === editing.event_id) && <option value={editing.event_id}>Current linked event</option>}
            </select>
          </label>
          <div className="mt-5 flex items-center justify-between">
            {editing !== 'new' ? <button onClick={() => remove(editing)} className="text-sm text-gray-400 hover:text-red-600">Remove show</button> : <span />}
            <div className="flex gap-2">
              <button onClick={() => setEditing(shows.length ? null : 'new')} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-700">{shows.length ? 'Back' : 'Cancel'}</button>
              <button onClick={save} disabled={!name.trim()} className="rounded-xl bg-marigold px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>
      )}
    </Sheet>
  );
}
