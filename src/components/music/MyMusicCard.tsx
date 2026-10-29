import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useFeature } from '../../lib/preview';

// A compact list of the music you bought (My Activity, Shop → My Orders), linking to My music for playing and downloads.
interface Item { id: string; title: string; amount: number; paid_at: string; album_id: string | null; kind?: string; artist: { name: string }; cover: string | null }
export function useMyMusicCount() {
  const on = useFeature('music_uploads');
  const [n, setN] = useState<number | null>(null);
  useEffect(() => { if (on) supabase.rpc('my_music_library').then(({ data }) => setN(((data ?? []) as unknown[]).length)); }, [on]);
  return on ? n : null;
}
export default function MyMusicCard({ title = '🎵 Music' }: { title?: string }) {
  const on = useFeature('music_uploads');
  const [items, setItems] = useState<Item[] | null>(null);
  useEffect(() => { if (on) supabase.rpc('my_music_library').then(({ data }) => setItems((data ?? []) as Item[])); }, [on]);
  if (!on || !items || items.length === 0) return null;
  return (
    <section className="rounded-2xl border border-gray-200 bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-lg font-semibold text-bone">{title}</h3>
        <Link to="/my-music" className="text-sm font-medium text-marigold hover:underline">Open My music ›</Link>
      </div>
      <ul className="mt-3 divide-y divide-gray-100">
        {items.slice(0, 4).map((it) => (
          <li key={it.id}>
            <Link to="/my-music" className="flex items-center gap-3 py-2">
              {it.cover ? <img src={it.cover} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" /> : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-teal-500 text-white" aria-hidden="true">♪</span>}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-bone">{it.title}</span>
                <span className="block truncate text-xs text-muted">{it.album_id ? 'Album' : 'Song'} · {it.artist.name} · {it.kind === 'donation' ? 'donated' : 'bought'} {new Date(it.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              </span>
              <span className="text-xs font-semibold text-indigo-600">Play ›</span>
            </Link>
          </li>
        ))}
      </ul>
      {items.length > 4 && <p className="mt-1 text-xs text-muted">and {items.length - 4} more in My music</p>}
    </section>
  );
}
