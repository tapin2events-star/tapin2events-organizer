import { Link } from 'react-router-dom';
import CdDisc from './CdDisc';
import { fmtTime, usePlayer } from '../../lib/player';

// The mini player: shows above the tab bar while something is playing, so music keeps going as you browse TapIN.
export default function MiniPlayer() {
  const p = usePlayer();
  if (!p.current) return null;
  const t = p.current;
  const pct = p.duration ? (p.progress / p.duration) * 100 : 0;
  return (
    <div className="fixed inset-x-2 z-[999] md:inset-x-auto md:right-4 md:w-96" style={{ bottom: 'calc(4.25rem + env(safe-area-inset-bottom, 0px))' }} role="region" aria-label="Now playing">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white/95 shadow-lg backdrop-blur md:[bottom:1rem]">
        <div className="h-1 bg-gray-200"><div className="h-full bg-marigold transition-all" style={{ width: `${pct}%` }} /></div>
        <div className="flex items-center gap-3 p-2.5">
          <CdDisc cover={t.cover} spinning={p.playing} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-900">{t.title}</p>
            <p className="truncate text-xs text-gray-500">{t.artistId ? <Link to={`/resources/${t.artistId}`} className="hover:underline">{t.artist}</Link> : t.artist}{t.albumTitle ? ` · ${t.albumTitle}` : ''} · {fmtTime(p.progress)}</p>
          </div>
          <button onClick={p.prev} aria-label="Previous" className="flex h-9 w-9 items-center justify-center rounded-full text-gray-700 hover:bg-gray-100">⏮</button>
          <button onClick={p.toggle} aria-label={p.playing ? 'Pause' : 'Play'} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0F1B3D] text-white">{p.playing ? '❚❚' : '▶'}</button>
          <button onClick={p.next} aria-label="Next" className="flex h-9 w-9 items-center justify-center rounded-full text-gray-700 hover:bg-gray-100">⏭</button>
          <button onClick={p.close} aria-label="Close player" className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100">✕</button>
        </div>
      </div>
    </div>
  );
}
