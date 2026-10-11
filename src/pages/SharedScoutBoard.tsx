import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { STAGES, type Stage } from '../lib/scouting';

interface SharedCard { id: string; stage: Stage; rating: number | null; tags: string[]; show_id: string | null; notes: string | null; name: string; image: string | null; categories: string[] | null; resource_id: string | null; link: string | null }
interface Shared { name: string; owner_name: string | null; shows: { id: string; name: string; target_date: string | null }[]; cards: SharedCard[] }

// A scouting board opened from a view-only link. No account needed; nothing can be changed.
export default function SharedScoutBoard() {
  const { token = '' } = useParams<{ token: string }>();
  const [data, setData] = useState<Shared | null | undefined>(undefined);
  const [showFilter, setShowFilter] = useState('all');
  useEffect(() => { supabase.rpc('scout_board_shared', { p_token: token }).then(({ data: d }) => setData((d as Shared) ?? null)); }, [token]);

  if (data === undefined) return <p className="text-sm text-muted">Loading…</p>;
  if (data === null) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-gray-200 bg-surface p-8 text-center">
        <p className="font-display text-xl font-bold text-bone">This link isn't active</p>
        <p className="mt-2 text-sm text-muted">The board's owner may have turned it off, or it expired. Ask them for a new link.</p>
        <Link to="/" className="mt-4 inline-block text-sm font-medium text-marigold">Go to TapIN</Link>
      </div>
    );
  }
  const cards = data.cards.filter((c) => showFilter === 'all' || c.show_id === showFilter);
  const showName = (id: string | null) => data.shows.find((s) => s.id === id)?.name;

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-xs font-semibold uppercase tracking-widest text-marigold">View only</p>
      <h1 className="mt-1 font-display text-3xl font-extrabold text-bone">{data.name}</h1>
      <p className="mt-1 text-sm text-muted">Shared by {data.owner_name || 'a TapIN organizer'} · scouting board</p>
      {data.shows.length > 0 && (
        <select value={showFilter} onChange={(e) => setShowFilter(e.target.value)} aria-label="Filter by show" className="mt-4 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700">
          <option value="all">All shows</option>
          {data.shows.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}
      <div className="mt-5 grid gap-5 md:grid-cols-4 md:gap-3">
        {STAGES.filter((s) => s.key !== 'passed').map((s) => {
          const list = cards.filter((c) => c.stage === s.key);
          return (
            <section key={s.key} className="rounded-3xl md:bg-gray-50 md:p-2.5">
              <h2 className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold text-bone md:text-gray-700">{s.label}<span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600">{list.length}</span></h2>
              <div className="flex flex-col gap-2">
                {list.length === 0 ? <p className="px-1 py-2 text-xs text-gray-400">No one here</p> : list.map((c) => (
                  <div key={c.id} className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-gray-200">
                    <div className="flex items-center gap-3">
                      {c.image ? <img src={c.image} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-marigold to-teal font-bold text-white">{c.name.charAt(0).toUpperCase()}</span>}
                      <span className="min-w-0 flex-1">
                        {c.resource_id ? <Link to={`/resources/${c.resource_id}`} className="block truncate text-sm font-semibold text-gray-900 hover:text-marigold">{c.name}</Link>
                          : c.link ? <a href={c.link} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-semibold text-gray-900 hover:text-marigold">{c.name} ↗</a>
                          : <span className="block truncate text-sm font-semibold text-gray-900">{c.name}</span>}
                        <span className="block truncate text-xs text-gray-500">{showName(c.show_id) ?? (c.categories ?? [])[0] ?? ''}</span>
                      </span>
                      {c.rating ? <span className="text-xs text-amber-500">{'★'.repeat(c.rating)}</span> : null}
                    </div>
                    {c.notes && <p className="mt-2 text-xs text-gray-600">{c.notes}</p>}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      <p className="mt-8 text-center text-xs text-muted">Made with <Link to="/" className="font-medium text-marigold">TapIN</Link>, where organizers find and book local artists.</p>
    </div>
  );
}
