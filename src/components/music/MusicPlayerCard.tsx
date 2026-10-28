import { Link } from 'react-router-dom';
import CdDisc from './CdDisc';
import { fmtTime, usePlayer, type PlayerTrack } from '../../lib/player';

// The spinning CD player for an album (or a single): disc, play/pause, previous/next, a progress bar you can drag, and
// the track list. Everything plays through the app-wide player, so it keeps going in the mini player while browsing.
export default function MusicPlayerCard({ title, subtitle, cover, tracks, link, compact = false }: { title: string; subtitle?: string; cover?: string | null; tracks: PlayerTrack[]; link?: string; compact?: boolean }) {
  const p = usePlayer();
  const mine = p.current ? tracks.findIndex((t) => t.id === p.current!.id) : -1;
  const active = mine >= 0;
  const spinning = active && p.playing;
  const start = (i: number) => p.play(tracks, i);
  if (tracks.length === 0) return null;
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-4">
        <CdDisc cover={cover} spinning={spinning} size={compact ? 96 : 132} />
        <div className="min-w-0 flex-1">
          {link ? <Link to={link} className="block truncate font-display text-lg font-bold text-gray-900 hover:underline">{title}</Link> : <p className="truncate font-display text-lg font-bold text-gray-900">{title}</p>}
          {subtitle && <p className="truncate text-sm text-gray-500">{subtitle}</p>}
          {active && p.current && <p className="mt-1 truncate text-xs font-medium text-marigold">▶ {p.current.title}</p>}
          <div className="mt-3 flex items-center gap-2">
            <button onClick={() => (active ? p.prev() : start(0))} aria-label="Previous" className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-800 hover:bg-gray-200">⏮</button>
            <button onClick={() => (active ? p.toggle() : start(0))} aria-label={spinning ? 'Pause' : 'Play'} className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0F1B3D] text-lg text-white hover:bg-[#1a2a5a]">{spinning ? '❚❚' : '▶'}</button>
            <button onClick={() => (active ? p.next() : start(Math.min(1, tracks.length - 1)))} aria-label="Next" className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-800 hover:bg-gray-200">⏭</button>
          </div>
        </div>
      </div>
      {active && (
        <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
          <span className="w-9 text-right">{fmtTime(p.progress)}</span>
          <input type="range" min={0} max={1000} value={p.duration ? Math.round((p.progress / p.duration) * 1000) : 0} onChange={(e) => p.seek(Number(e.target.value) / 1000)} aria-label="Position" className="h-1.5 flex-1 accent-marigold" />
          <span className="w-9">{fmtTime(p.duration)}</span>
        </div>
      )}
      <ol className="mt-3 divide-y divide-gray-100">
        {tracks.map((t, i) => {
          const on = p.current?.id === t.id;
          return (
            <li key={t.id}>
              <button onClick={() => (on ? p.toggle() : start(i))} className={`flex w-full items-center gap-3 py-2 text-left ${on ? 'text-marigold' : 'text-gray-800'}`} aria-label={`${on && p.playing ? 'Pause' : 'Play'} ${t.title}`}>
                <span className="w-5 text-center text-xs text-gray-400">{on && p.playing ? '▶' : i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.title}</span>
                {t.duration_sec ? <span className="text-xs text-gray-400">{fmtTime(t.duration_sec)}</span> : null}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
