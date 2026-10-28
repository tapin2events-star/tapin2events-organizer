import { useEffect, useRef, useState } from 'react';
import { useFeature } from '../../lib/preview';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

// Artist profile: the artist's songs, with one player (one song at a time). Plays are counted on first play.
interface Track { id: string; title: string; url: string; duration_sec: number | null }
const fmt = (s: number | null) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '');

export default function ArtistMusic({ resourceId, artistName }: { resourceId: string; artistName: string }) {
  const on = useFeature('music_uploads');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playing, setPlaying] = useState<string | null>(null);
  const [pos, setPos] = useState(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const counted = useRef<Set<string>>(new Set());
  useEffect(() => {
    supabase.from('resource_tracks').select('id, title, url, duration_sec').eq('resource_id', resourceId).eq('status', 'active').order('sort_order').order('created_at')
      .then(({ data }) => setTracks(((data ?? []) as Track[]).filter((t) => t.url)));
    return () => { audio.current?.pause(); };
  }, [resourceId]);
  if (!on || tracks.length === 0) return null;

  function toggle(t: Track) {
    if (!audio.current) {
      audio.current = new Audio();
      audio.current.ontimeupdate = () => { const a = audio.current!; setPos(a.duration ? a.currentTime / a.duration : 0); };
      audio.current.onended = () => { setPlaying(null); setPos(0); };
    }
    const a = audio.current;
    if (playing === t.id) { a.pause(); setPlaying(null); return; }
    a.src = t.url; setPos(0);
    a.play().then(() => {
      setPlaying(t.id);
      if (!counted.current.has(t.id)) { counted.current.add(t.id); supabase.rpc('record_track_play', { p_track_id: t.id }); }
    }).catch(() => setPlaying(null));
  }

  return (
    <section className="mt-6 border-t border-gray-200 pt-6" aria-label={`Music by ${artistName}`}>
      <h2 className="font-display text-lg font-semibold text-gray-900">🎵 Music</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {tracks.map((t) => {
          const on = playing === t.id;
          return (
            <li key={t.id} className={`overflow-hidden rounded-xl border ${on ? 'border-marigold bg-orange-50' : 'border-gray-200 bg-white'}`}>
              <button onClick={() => toggle(t)} className="flex w-full items-center gap-3 p-3 text-left" aria-label={`${on ? 'Pause' : 'Play'} ${t.title}`}>
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white ${on ? 'bg-marigold' : 'bg-[#0F1B3D]'}`} aria-hidden="true">{on ? '❚❚' : '▶'}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-gray-900">{t.title}</span><span className="block truncate text-xs text-gray-500">{artistName}</span></span>
                {t.duration_sec ? <span className="shrink-0 text-xs text-gray-500">{fmt(t.duration_sec)}</span> : null}
              </button>
              {on && <div className="h-1 bg-orange-100"><div className="h-full bg-marigold transition-all" style={{ width: `${Math.round(pos * 100)}%` }} /></div>}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-gray-400"><Link to="/dmca" className="hover:underline">Report a copyright problem</Link></p>
    </section>
  );
}
