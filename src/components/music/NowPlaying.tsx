import { useEffect, useRef } from 'react';
import { shareMusic } from '../../lib/musicShare';
import { Link } from 'react-router-dom';
import CdDisc from './CdDisc';
import { fmtTime, usePlayer, PREVIEW_SECONDS } from '../../lib/player';

// The full-screen Now playing popup: a big spinning CD, the song and artist, a progress bar, previous / play-pause /
// next, and the queue. Minimize (chevron, swipe down, or Escape) to keep listening in the mini player; ✕ stops it.
export default function NowPlaying() {
  const p = usePlayer();
  const startY = useRef<number | null>(null);
  useEffect(() => {
    if (!p.expanded) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') p.minimize(); if (e.key === ' ' && (e.target as HTMLElement)?.tagName !== 'INPUT') { e.preventDefault(); p.toggle(); } };
    document.addEventListener('keydown', k);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = prevOverflow; };
  }, [p.expanded, p]);
  if (!p.expanded || !p.current) return null;
  const t = p.current;
  const max = t.preview ? Math.min(PREVIEW_SECONDS, p.duration || PREVIEW_SECONDS) : p.duration;
  return (
    <div className="fixed inset-0 z-[1100] flex flex-col bg-gradient-to-b from-[#1b1f4a] via-[#14163a] to-[#0b0c22] text-white" role="dialog" aria-modal="true" aria-label="Now playing"
      onTouchStart={(e) => { startY.current = e.touches[0].clientY; }}
      onTouchEnd={(e) => { if (startY.current !== null && e.changedTouches[0].clientY - startY.current > 90) p.minimize(); startY.current = null; }}
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={p.minimize} aria-label="Minimize player" className="flex h-11 w-11 items-center justify-center rounded-full text-2xl hover:bg-white/10">⌄</button>
        <p className="text-xs font-semibold uppercase tracking-widest text-white/60">Now playing</p>
        <div className="flex items-center">
        <button onClick={() => shareMusic('track', t.id, t.title, t.artist)} aria-label="Share this song" className="flex h-11 w-11 items-center justify-center rounded-full text-lg hover:bg-white/10">↗</button>
        <button onClick={p.close} aria-label="Close player" className="flex h-11 w-11 items-center justify-center rounded-full text-lg hover:bg-white/10">✕</button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-6 pb-6">
        <div className="mt-2 flex w-full justify-center"><CdDisc cover={t.cover} spinning={p.playing} size={Math.min(320, typeof window !== 'undefined' ? window.innerWidth - 80 : 280)} label={`${t.title} cover`} /></div>
        <div className="mt-6 w-full max-w-md text-center">
          <p className="truncate font-display text-2xl font-bold">{t.title}</p>
          <p className="mt-0.5 truncate text-sm text-white/70">{t.artistId ? <Link to={`/resources/${t.artistId}`} onClick={p.minimize} className="hover:underline">{t.artist}</Link> : t.artist}{t.albumTitle ? <> · {t.albumId ? <Link to={`/albums/${t.albumId}`} onClick={p.minimize} className="hover:underline">{t.albumTitle}</Link> : t.albumTitle}</> : null}</p>
          {t.preview && <p className="mt-1 text-xs font-semibold text-amber-300">{p.previewEnded ? 'That was a 30-second preview. Buy it on the artist\u2019s page to hear the full song.' : '30-second preview'}</p>}
        </div>
        <div className="mt-5 flex w-full max-w-md items-center gap-3 text-xs text-white/60">
          <span className="w-10 text-right">{fmtTime(p.progress)}</span>
          <input type="range" min={0} max={1000} value={max ? Math.round((Math.min(p.progress, max) / max) * 1000) : 0} onChange={(e) => p.seek((Number(e.target.value) / 1000) * (max / (p.duration || max || 1)))} aria-label="Position" className="h-1.5 flex-1 accent-amber-400" />
          <span className="w-10">{fmtTime(max)}</span>
        </div>
        <div className="mt-4 flex items-center gap-6">
          <button onClick={p.prev} aria-label="Previous" className="flex h-14 w-14 items-center justify-center rounded-full text-2xl hover:bg-white/10">⏮</button>
          <button onClick={p.toggle} aria-label={p.playing ? 'Pause' : 'Play'} className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-3xl text-[#14163a] shadow-lg">{p.playing ? '❚❚' : '▶'}</button>
          <button onClick={p.next} aria-label="Next" className="flex h-14 w-14 items-center justify-center rounded-full text-2xl hover:bg-white/10">⏭</button>
        </div>
        {p.queue.length > 1 && (
          <ol className="mt-6 w-full max-w-md divide-y divide-white/10 rounded-2xl bg-white/5">
            {p.queue.map((q, i) => (
              <li key={q.id}>
                <button onClick={() => (i === p.index ? p.toggle() : p.play(p.queue, i))} className={`flex w-full items-center gap-3 px-4 py-3 text-left ${i === p.index ? 'text-amber-300' : 'text-white/90'}`}>
                  <span className="w-5 text-center text-xs text-white/50">{i === p.index && p.playing ? '▶' : i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{q.title}{q.preview ? <span className="ml-1 text-[10px] text-amber-300/80">preview</span> : null}</span>
                  {q.duration_sec ? <span className="text-xs text-white/50">{fmtTime(q.duration_sec)}</span> : null}
                </button>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-4 text-[11px] text-white/40">Swipe down to minimize · keeps playing as you browse</p>
      </div>
    </div>
  );
}
