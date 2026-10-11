import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import type { MyBoard } from '../../lib/scouting';

// "Save to scouting board" on artist/group profiles. Private: the artist is never told.
export default function SaveToBoard({ resourceId, name }: { resourceId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [boards, setBoards] = useState<MyBoard[] | null>(null);
  const [savedOn, setSavedOn] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase.rpc('my_scout_boards');
      const list = (data ?? []) as MyBoard[];
      setBoards(list);
      if (list.length) {
        const { data: cards } = await supabase.from('scout_cards').select('board_id').eq('resource_id', resourceId).in('board_id', list.map((b) => b.id));
        setSavedOn(new Set((cards ?? []).map((c) => c.board_id)));
      }
    })();
  }, [open, resourceId]);

  async function save(b: MyBoard) {
    if (savedOn.has(b.id)) return;
    const { error } = await supabase.from('scout_cards').insert({ board_id: b.id, resource_id: resourceId });
    if (error) { setMsg("Couldn't save. Please try again."); return; }
    setSavedOn(new Set([...savedOn, b.id]));
    setMsg(`Saved ${name} to ${b.name}.`);
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => { setOpen((o) => !o); setMsg(null); }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-marigold">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
        Save to scouting board
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-2 w-72 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
          <p className="px-2 pb-1 text-xs text-gray-500">Private. {name} won't be notified.</p>
          {boards === null ? <p className="p-2 text-sm text-gray-500">Loading…</p> : boards.length === 0 ? (
            <div className="p-2 text-sm text-gray-600">You don't have a scouting board yet. <Link to="/organizer/scouting" className="font-medium text-marigold">Create one</Link></div>
          ) : (
            <ul className="max-h-64 overflow-y-auto">
              {boards.map((b) => (
                <li key={b.id}>
                  <button type="button" onClick={() => save(b)} disabled={savedOn.has(b.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-gray-50 disabled:text-gray-400">
                    <span className="truncate">{b.name}</span>
                    {savedOn.has(b.id) ? <span className="shrink-0 text-xs text-green-700">✓ Saved</span> : <span className="shrink-0 text-xs text-marigold">Save</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {msg && <p className="px-2 pt-1 text-xs text-green-700">{msg}</p>}
        </div>
      )}
    </div>
  );
}
