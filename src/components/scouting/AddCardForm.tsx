import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { CardResource, Show } from '../../lib/scouting';

// Add an artist to a board: someone on TapIN, or anyone by name + link.
export default function AddCardForm({ boardId, shows, takenResourceIds, defaultShowId, onAdded, onClose }: {
  boardId: string; shows: Show[]; takenResourceIds: Set<string>; defaultShowId: string | null; onAdded: () => void; onClose: () => void;
}) {
  const [mode, setMode] = useState<'tapin' | 'outside'>('tapin');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<CardResource[]>([]);
  const [outsideName, setOutsideName] = useState('');
  const [outsideLink, setOutsideLink] = useState('');
  const [showId, setShowId] = useState(defaultShowId ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const term = q.trim().replace(/[%_,()]/g, ' ');
    if (mode !== 'tapin' || term.length < 2) { setResults([]); return; }
    const t = window.setTimeout(async () => {
      const { data } = await supabase.from('resources').select('id, display_name, profile_image, categories, kind, city')
        .eq('status', 'active').neq('verification_status', 'rejected').ilike('display_name', `%${term}%`).order('display_name').limit(8);
      setResults((data ?? []) as CardResource[]);
    }, 250);
    return () => window.clearTimeout(t);
  }, [q, mode]);

  async function add(payload: Record<string, unknown>) {
    setError(null);
    const { error: e } = await supabase.from('scout_cards').insert({ board_id: boardId, show_id: showId || null, ...payload });
    if (e) return setError("Couldn't add them. Please try again.");
    onAdded();
  }

  const input = 'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900';
  return (
    <div className="rounded-2xl border border-marigold/40 bg-marigold/5 p-3">
      <div className="flex gap-1 rounded-lg bg-white p-1 text-sm">
        {(['tapin', 'outside'] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)} className={`flex-1 rounded-md px-3 py-1.5 font-medium ${mode === m ? 'bg-marigold text-white' : 'text-gray-600'}`}>
            {m === 'tapin' ? 'On TapIN' : 'Not on TapIN yet'}
          </button>
        ))}
      </div>
      {shows.length > 0 && (
        <label className="mt-3 block text-xs font-medium text-gray-600">Pencil in for
          <select value={showId} onChange={(e) => setShowId(e.target.value)} className={input}>
            <option value="">No show yet</option>
            {shows.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      )}
      {mode === 'tapin' ? (
        <>
          <input className={`${input} mt-3`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search artists, resources, groups" autoFocus />
          {results.length > 0 && (
            <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
              {results.map((r) => {
                const taken = takenResourceIds.has(r.id);
                return (
                  <li key={r.id}>
                    <button type="button" disabled={taken} onClick={() => add({ resource_id: r.id })} className="flex w-full items-center gap-3 p-2 text-left hover:bg-gray-50 disabled:opacity-50">
                      {r.profile_image ? <img src={r.profile_image} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 font-bold text-gray-600">{r.display_name.charAt(0)}</span>}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-gray-900">{r.display_name}</span>
                        <span className="block truncate text-xs text-gray-500">{[...(r.categories ?? []).slice(0, 2), r.city].filter(Boolean).join(' · ')}</span>
                      </span>
                      <span className="text-xs font-semibold text-marigold">{taken ? 'On board' : 'Add'}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          <label className="text-xs font-medium text-gray-600">Name<input className={input} value={outsideName} maxLength={120} onChange={(e) => setOutsideName(e.target.value)} placeholder="Artist or stage name" /></label>
          <label className="text-xs font-medium text-gray-600">Instagram or link <span className="font-normal text-gray-400">(optional)</span><input className={input} value={outsideLink} maxLength={500} onChange={(e) => setOutsideLink(e.target.value)} placeholder="https://instagram.com/…" inputMode="url" /></label>
          <button type="button" disabled={!outsideName.trim()} onClick={() => add({ outside_name: outsideName.trim(), outside_link: outsideLink.trim() || null })} className="self-start rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Add to board</button>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-magenta">{error}</p>}
      <button type="button" onClick={onClose} className="mt-2 text-sm text-gray-500">Done</button>
    </div>
  );
}
