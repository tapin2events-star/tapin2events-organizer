import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { CardResource, Show } from '../../lib/scouting';

// Add an artist: one search box for TapIN, with a simple fallback for anyone not on TapIN yet.
export default function AddCardForm({ boardId, shows, takenResourceIds, defaultShowId, onAdded, onClose }: {
  boardId: string; shows: Show[]; takenResourceIds: Set<string>; defaultShowId: string | null; onAdded: (name: string) => void; onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<CardResource[]>([]);
  const [searched, setSearched] = useState(false);
  const [outside, setOutside] = useState(false);
  const [outsideName, setOutsideName] = useState('');
  const [outsideLink, setOutsideLink] = useState('');
  const [showId, setShowId] = useState(defaultShowId ?? '');
  const [added, setAdded] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const term = q.trim().replace(/[%_,()]/g, ' ');
    if (term.length < 2) { setResults([]); setSearched(false); return; }
    const t = window.setTimeout(async () => {
      const { data } = await supabase.from('resources').select('id, display_name, profile_image, categories, kind, city')
        .eq('status', 'active').neq('verification_status', 'rejected').ilike('display_name', `%${term}%`).order('display_name').limit(8);
      setResults((data ?? []) as CardResource[]);
      setSearched(true);
    }, 250);
    return () => window.clearTimeout(t);
  }, [q]);

  async function add(payload: Record<string, unknown>, name: string) {
    setError(null);
    const { error: e } = await supabase.from('scout_cards').insert({ board_id: boardId, show_id: showId || null, ...payload });
    if (e) return setError("Couldn't add them. Please try again.");
    setAdded((a) => [...a, name]);
    onAdded(name);
  }

  const input = 'w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-base text-gray-900';
  return (
    <div className="flex flex-col gap-3">
      {!outside ? (
        <>
          <input className={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search artists, vendors, or groups" autoFocus aria-label="Search TapIN" />
          {results.length > 0 && (
            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
              {results.map((r) => {
                const taken = takenResourceIds.has(r.id) || added.includes(r.display_name);
                return (
                  <li key={r.id}>
                    <button type="button" disabled={taken} onClick={() => add({ resource_id: r.id }, r.display_name)} className="flex w-full items-center gap-3 p-3 text-left hover:bg-gray-50 disabled:opacity-60">
                      {r.profile_image ? <img src={r.profile_image} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 font-bold text-gray-600">{r.display_name.charAt(0)}</span>}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-gray-900">{r.display_name}</span>
                        <span className="block truncate text-xs text-gray-500">{[...(r.categories ?? []).slice(0, 2), r.city].filter(Boolean).join(' · ')}</span>
                      </span>
                      <span className={`text-sm font-semibold ${taken ? 'text-green-700' : 'text-marigold'}`}>{taken ? '✓ Added' : '+ Add'}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {searched && results.length === 0 && <p className="text-sm text-gray-500">No one on TapIN by that name.</p>}
          <button type="button" onClick={() => { setOutside(true); setOutsideName(q.trim()); }} className="self-start text-sm font-medium text-marigold">
            Not on TapIN? Add them by name
          </button>
        </>
      ) : (
        <>
          <input className={input} value={outsideName} maxLength={120} onChange={(e) => setOutsideName(e.target.value)} placeholder="Name or stage name" autoFocus aria-label="Name" />
          <input className={input} value={outsideLink} maxLength={500} onChange={(e) => setOutsideLink(e.target.value)} placeholder="Instagram or link (optional)" inputMode="url" aria-label="Link" />
          <div className="flex items-center gap-3">
            <button type="button" disabled={!outsideName.trim()} onClick={() => { add({ outside_name: outsideName.trim(), outside_link: outsideLink.trim() || null }, outsideName.trim()); setOutsideName(''); setOutsideLink(''); }}
              className="rounded-xl bg-marigold px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Add to board</button>
            <button type="button" onClick={() => setOutside(false)} className="text-sm text-gray-500">Search TapIN instead</button>
          </div>
        </>
      )}
      {shows.length > 0 && (
        <label className="text-xs font-medium text-gray-500">For which show?
          <select value={showId} onChange={(e) => setShowId(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900">
            <option value="">Not decided yet</option>
            {shows.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      )}
      {added.length > 0 && <p className="text-sm text-green-700">Added {added.join(', ')}.</p>}
      {error && <p role="alert" className="text-sm text-magenta">{error}</p>}
      <button type="button" onClick={onClose} className="mt-1 rounded-xl border border-gray-300 bg-white py-2.5 text-sm font-medium text-gray-700">Done</button>
    </div>
  );
}
