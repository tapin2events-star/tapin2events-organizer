import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import BackButton from '../components/BackButton';
import { ListSkeleton } from '../components/ui/Skeleton';
import type { MyBoard } from '../lib/scouting';

// Your scouting boards (and ones shared with you).
export default function ScoutingBoards() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [boards, setBoards] = useState<MyBoard[] | null>(null);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { supabase.rpc('my_scout_boards').then(({ data }) => setBoards((data ?? []) as MyBoard[])); }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !user?.email) return;
    setCreating(true); setError(null);
    const { data, error: err } = await supabase.from('scout_boards').insert({ owner_email: user.email, name: name.trim().slice(0, 100) }).select('id').single();
    setCreating(false);
    if (err || !data) return setError("Couldn't create the board. Please try again.");
    navigate(`/organizer/scouting/${data.id}`);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-3"><BackButton fallback="/organizer" fallbackLabel="Organizer Dashboard" /></div>
      <h1 className="font-display text-3xl font-extrabold text-bone">Scouting</h1>
      <p className="mt-1 text-sm text-muted">Keep track of artists you want for upcoming shows, privately, with your co-planners.</p>

      <form onSubmit={create} className="mt-5 flex flex-wrap gap-2 rounded-2xl border border-gray-200 bg-surface p-3">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="New board name, e.g. Queens Speech 2027"
          className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900" />
        <button type="submit" disabled={creating || !name.trim()} className="rounded-lg bg-marigold px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{creating ? 'Creating…' : '+ Create board'}</button>
        {error && <p role="alert" className="w-full text-sm text-magenta">{error}</p>}
      </form>

      {boards === null ? <ListSkeleton rows={3} className="mt-5" /> : boards.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-muted">
          No boards yet. Create one above, then add artists from TapIN (or anyone who isn't on TapIN yet).
          <p className="mt-2">Tip: on any artist's profile, tap <strong>Save to scouting board</strong>.</p>
        </div>
      ) : (
        <ul className="mt-5 flex flex-col gap-2">
          {boards.map((b) => (
            <li key={b.id}>
              <Link to={`/organizer/scouting/${b.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-surface p-4 hover:border-marigold">
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-bone">{b.name}</span>
                  <span className="block text-xs text-muted">
                    {b.card_count} artist{b.card_count === 1 ? '' : 's'} · {b.member_count} {b.member_count === 1 ? 'planner' : 'planners'}
                    {!b.is_owner && ` · shared by ${b.owner_name || b.owner_email}`}
                  </span>
                </span>
                <span className="text-marigold">&rarr;</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
