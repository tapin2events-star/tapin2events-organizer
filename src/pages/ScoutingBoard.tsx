import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import BackButton from '../components/BackButton';
import AddCardForm from '../components/scouting/AddCardForm';
import CardSheet from '../components/scouting/CardSheet';
import { STAGES, stageInfo, type Board, type Card, type CardResource, type Show, type Stage } from '../lib/scouting';

interface Person { email: string; full_name: string | null; profile_photo: string | null }

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
  const [showFilter, setShowFilter] = useState<string>('all');
  const [mobileStage, setMobileStage] = useState<Stage>('watching');
  const [adding, setAdding] = useState(false);
  const [openCard, setOpenCard] = useState<Card | null>(null);
  const [sharing, setSharing] = useState(false);
  const [editingShow, setEditingShow] = useState<Show | 'new' | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const isOwner = board?.owner_email === user?.email;

  const load = useCallback(async () => {
    const [{ data: b }, { data: s }, { data: c }, { data: m }] = await Promise.all([
      supabase.from('scout_boards').select('id, name, description, owner_email').eq('id', id).maybeSingle(),
      supabase.from('scout_shows').select('*').eq('board_id', id).order('target_date', { ascending: true, nullsFirst: false }).order('sort_order'),
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
    const emails = [...new Set([...(m ?? []).map((x) => x.user_email), b?.owner_email, ...list.map((x) => x.added_by)].filter(Boolean))] as string[];
    if (emails.length) {
      const { data: ppl } = await supabase.from('public_profiles').select('email, full_name, profile_photo').in('email', emails);
      setNames(new Map((ppl ?? []).map((p) => [p.email, p.full_name || p.email])));
      const byEmail = new Map((ppl ?? []).map((p) => [p.email, p as Person]));
      setMembers([b?.owner_email, ...(m ?? []).map((x) => x.user_email)].filter(Boolean).map((e) => byEmail.get(e as string) ?? { email: e as string, full_name: null, profile_photo: null }));
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  const visible = useMemo(() => cards.filter((c) => showFilter === 'all' || (showFilter === 'none' ? !c.show_id : c.show_id === showFilter)), [cards, showFilter]);
  const byStage = (s: Stage) => visible.filter((c) => c.stage === s).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  const takenResourceIds = useMemo(() => new Set(cards.map((c) => c.resource_id).filter(Boolean) as string[]), [cards]);

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
    const name = r?.display_name ?? c.outside_name ?? 'Artist';
    const show = shows.find((s) => s.id === c.show_id);
    return (
      <button key={c.id} type="button" draggable onDragStart={() => setDragId(c.id)} onDragEnd={() => setDragId(null)} onClick={() => setOpenCard(c)}
        className={`w-full rounded-xl border border-gray-200 bg-white p-3 text-left shadow-sm transition hover:border-marigold ${dragId === c.id ? 'opacity-50' : ''} ${c.stage === 'passed' ? 'opacity-60' : ''}`}>
        <div className="flex items-center gap-2.5">
          {r?.profile_image ? <img src={r.profile_image} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-marigold to-teal font-bold text-white">{name.charAt(0).toUpperCase()}</span>}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-gray-900">{name}</span>
            <span className="block truncate text-xs text-gray-500">{r ? (r.categories ?? []).slice(0, 2).join(' · ') || (r.kind === 'group' ? 'Group' : 'On TapIN') : 'Not on TapIN yet'}</span>
          </span>
          {c.rating ? <span className="shrink-0 text-xs text-amber-500">{'★'.repeat(c.rating)}</span> : null}
        </div>
        {(show || c.tags.length > 0 || c.booking_id) && (
          <div className="mt-2 flex flex-wrap gap-1">
            {show && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">{show.name}</span>}
            {c.booking_id && c.stage === 'in_talks' && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">Awaiting reply</span>}
            {c.tags.slice(0, 3).map((t) => <span key={t} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">{t}</span>)}
          </div>
        )}
        {c.notes && <p className="mt-2 line-clamp-2 text-xs text-gray-500">{c.notes}</p>}
      </button>
    );
  };

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-3"><BackButton fallback="/organizer/scouting" fallbackLabel="Scouting" /></div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-extrabold text-bone">{board.name}</h1>
          <p className="mt-1 text-xs text-muted">Private to your planners. Artists are never notified.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {members.slice(0, 5).map((p) => p.profile_photo
              ? <img key={p.email} src={p.profile_photo} alt={p.full_name ?? ''} title={p.full_name ?? p.email} className="h-8 w-8 rounded-full border-2 border-white object-cover" />
              : <span key={p.email} title={p.full_name ?? p.email} className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-gray-300 text-xs font-bold text-gray-700">{(p.full_name ?? p.email).charAt(0).toUpperCase()}</span>)}
          </div>
          <button onClick={() => setSharing(true)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:border-marigold">{isOwner ? 'Share' : 'Planners'}</button>
          <button onClick={() => setAdding((a) => !a)} className="rounded-lg bg-marigold px-3 py-2 text-sm font-semibold text-white hover:bg-marigold/90">+ Add artist</button>
        </div>
      </div>

      {/* Shows */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {[{ id: 'all', label: `All (${cards.filter((c) => c.stage !== 'passed').length})` }, ...shows.map((s) => ({ id: s.id, label: `${s.name}${s.target_date ? ' · ' + new Date(s.target_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}` })), { id: 'none', label: 'No show yet' }].map((f) => (
          <span key={f.id} className="flex shrink-0 items-center">
            <button onClick={() => setShowFilter(f.id)} className={`rounded-full px-3 py-1.5 text-sm font-medium ${showFilter === f.id ? 'bg-marigold text-white' : 'border border-gray-300 bg-white text-gray-700'}`}>{f.label}</button>
            {showFilter === f.id && shows.some((s) => s.id === f.id) && (
              <button onClick={() => setEditingShow(shows.find((s) => s.id === f.id)!)} className="ml-1 text-xs text-marigold">Edit</button>
            )}
          </span>
        ))}
        <button onClick={() => setEditingShow('new')} className="shrink-0 rounded-full border border-dashed border-gray-400 px-3 py-1.5 text-sm text-gray-600">+ Add show</button>
      </div>

      {adding && (
        <div className="mt-3 max-w-xl">
          <AddCardForm boardId={board.id} shows={shows} takenResourceIds={takenResourceIds} defaultShowId={shows.some((s) => s.id === showFilter) ? showFilter : null}
            onAdded={() => load()} onClose={() => setAdding(false)} />
        </div>
      )}

      {cards.length === 0 && !adding && (
        <p className="mt-6 rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-muted">No artists yet. Tap <strong>+ Add artist</strong>, or use <strong>Save to scouting board</strong> on any artist's profile.</p>
      )}

      {/* Phone: one stage at a time */}
      <div className="mt-4 md:hidden">
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1">
          {STAGES.map((s) => (
            <button key={s.key} onClick={() => setMobileStage(s.key)} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium ${mobileStage === s.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
              {s.label} <span className="text-gray-400">{byStage(s.key).length}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {byStage(mobileStage).length === 0 ? <p className="py-6 text-center text-sm text-muted">Nobody here yet.</p> : byStage(mobileStage).map(cardView)}
        </div>
      </div>

      {/* Computer: drag between columns */}
      <div className="mt-4 hidden gap-3 overflow-x-auto pb-4 md:grid md:grid-cols-5">
        {STAGES.map((s) => (
          <div key={s.key} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragId) moveCard(dragId, s.key); setDragId(null); }}
            className={`flex min-h-[200px] min-w-[200px] flex-col gap-2 rounded-2xl p-2 ${dragId ? 'bg-marigold/5 ring-1 ring-marigold/20' : 'bg-gray-50'}`}>
            <div className="px-1 pb-1">
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${s.color}`}>{s.label} · {byStage(s.key).length}</span>
              <p className="mt-1 text-[11px] text-gray-400">{s.hint}</p>
            </div>
            {byStage(s.key).map(cardView)}
          </div>
        ))}
      </div>

      {openCard && (
        <CardSheet card={openCard} resource={openCard.resource_id ? resources.get(openCard.resource_id) ?? null : null} shows={shows}
          addedByName={openCard.added_by ? names.get(openCard.added_by) ?? null : null} onClose={() => setOpenCard(null)} onChanged={() => load()} />
      )}
      {sharing && <ShareDialog board={board} isOwner={!!isOwner} members={members} onClose={() => setSharing(false)} onChanged={load} onLeft={() => navigate('/organizer/scouting')} />}
      {editingShow && <ShowDialog boardId={board.id} show={editingShow === 'new' ? null : editingShow} onClose={() => setEditingShow(null)} onChanged={() => { load(); }} />}
      {isOwner && (
        <div className="mt-8 text-right">
          <button className="text-xs text-gray-400 hover:text-red-600" onClick={async () => {
            if (!window.confirm(`Delete "${board.name}" and everything on it? This can't be undone.`)) return;
            await supabase.from('scout_boards').delete().eq('id', board.id);
            navigate('/organizer/scouting');
          }}>Delete board</button>
        </div>
      )}
      <span className="sr-only">{stageInfo(mobileStage).hint}</span>
    </div>
  );
}

function ShareDialog({ board, isOwner, members, onClose, onChanged, onLeft }: { board: Board; isOwner: boolean; members: Person[]; onClose: () => void; onChanged: () => void; onLeft: () => void }) {
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<{ email: string; full_name: string | null; profile_photo: string | null }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const t = window.setTimeout(async () => {
      const { data } = await supabase.rpc('search_people', { p_query: q.trim() });
      const taken = new Set(members.map((m) => m.email));
      setResults(((data ?? []) as { email: string; full_name: string | null; profile_photo: string | null }[]).filter((p) => !taken.has(p.email)));
    }, 250);
    return () => window.clearTimeout(t);
  }, [q, members]);
  async function add(email: string) {
    const { error } = await supabase.from('scout_board_members').insert({ board_id: board.id, user_email: email, added_by: user?.email });
    setMsg(error ? "Couldn't add them." : 'Added. They\u2019ll get a notification.');
    setQ(''); onChanged();
  }
  async function remove(email: string) {
    await supabase.from('scout_board_members').delete().eq('board_id', board.id).eq('user_email', email);
    if (email === user?.email) { onLeft(); return; }
    onChanged();
  }
  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:rounded-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Planners">
        <div className="flex items-center justify-between"><p className="font-display text-lg font-bold text-gray-900">Planners</p><button onClick={onClose} aria-label="Close" className="p-2 text-gray-400">✕</button></div>
        <p className="text-xs text-gray-500">Planners can add artists, move cards, and edit notes and shows.</p>
        {isOwner && (
          <>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add a planner by name or email" className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base text-gray-900" />
            {results.length > 0 && (
              <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200">
                {results.map((p) => (
                  <li key={p.email} className="flex items-center gap-3 p-2">
                    <span className="min-w-0 flex-1 truncate text-sm text-gray-900">{p.full_name || 'TapIN member'}</span>
                    <button onClick={() => add(p.email)} className="rounded-lg bg-marigold px-3 py-1.5 text-xs font-semibold text-white">Add</button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        {msg && <p className="mt-2 text-xs text-green-700">{msg}</p>}
        <ul className="mt-3 flex flex-col gap-1">
          {members.map((p, i) => (
            <li key={p.email} className="flex items-center gap-3 rounded-lg p-2">
              <span className="min-w-0 flex-1 truncate text-sm text-gray-900">{p.full_name || p.email}{i === 0 && <span className="text-gray-400"> · owner</span>}{p.email === user?.email && <span className="text-gray-400"> (you)</span>}</span>
              {i > 0 && (isOwner || p.email === user?.email) && <button onClick={() => remove(p.email)} className="text-xs text-red-600">{p.email === user?.email ? 'Leave' : 'Remove'}</button>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ShowDialog({ boardId, show, onClose, onChanged }: { boardId: string; show: Show | null; onClose: () => void; onChanged: () => void }) {
  const { user } = useAuth();
  const [name, setName] = useState(show?.name ?? '');
  const [date, setDate] = useState(show?.target_date ?? '');
  const [eventId, setEventId] = useState(show?.event_id ?? '');
  const [events, setEvents] = useState<{ id: string; title: string; start_date: string | null }[]>([]);
  useEffect(() => {
    if (!user?.id) return;
    supabase.from('events').select('id, title, start_date').eq('organizer_id', user.id).gte('start_date', new Date(Date.now() - 86400000).toISOString()).order('start_date').limit(50)
      .then(({ data }) => setEvents((data ?? []) as { id: string; title: string; start_date: string | null }[]));
  }, [user?.id]);
  async function save() {
    if (!name.trim()) return;
    const row = { board_id: boardId, name: name.trim().slice(0, 100), target_date: date || null, event_id: eventId || null };
    if (show) await supabase.from('scout_shows').update(row).eq('id', show.id);
    else await supabase.from('scout_shows').insert(row);
    onChanged(); onClose();
  }
  async function remove() {
    if (!show || !window.confirm(`Remove "${show.name}"? Artists penciled in for it stay on the board.`)) return;
    await supabase.from('scout_shows').delete().eq('id', show.id);
    onChanged(); onClose();
  }
  const input = 'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900';
  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:rounded-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Show">
        <p className="font-display text-lg font-bold text-gray-900">{show ? 'Edit show' : 'Add a show'}</p>
        <label className="mt-3 block text-xs font-medium text-gray-600">Name<input className={input} value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder="e.g. Spring Showcase, March" autoFocus /></label>
        <label className="mt-3 block text-xs font-medium text-gray-600">Target date <span className="font-normal text-gray-400">(optional)</span><input type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="mt-3 block text-xs font-medium text-gray-600">Linked event <span className="font-normal text-gray-400">(optional, lets you send lineup invites from cards)</span>
          <select className={input} value={eventId} onChange={(e) => setEventId(e.target.value)}>
            <option value="">Not created yet</option>
            {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}{ev.start_date ? ` · ${new Date(ev.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}</option>)}
            {show?.event_id && !events.some((e) => e.id === show.event_id) && <option value={show.event_id}>Current linked event</option>}
          </select>
        </label>
        <div className="mt-4 flex items-center justify-between">
          {show ? <button onClick={remove} className="text-sm text-red-600">Remove show</button> : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700">Cancel</button>
            <button onClick={save} disabled={!name.trim()} className="rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}
