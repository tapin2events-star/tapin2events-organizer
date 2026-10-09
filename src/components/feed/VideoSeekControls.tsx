import { useEffect, useRef, useState } from 'react';

const fmt = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

// Feed video controls: a progress bar you can drag (always there, thin while
// playing), and when paused, rewind/forward 10s buttons and the times.
// Arrow keys skip 5s on a computer. Marked data-no-swipe so dragging the bar
// never triggers the swipe to Discover.
export default function VideoSeekControls({ video, paused, onResume }: { video: HTMLVideoElement | null; paused: boolean; onResume: () => void }) {
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [flash, setFlash] = useState<null | 'back' | 'fwd'>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);

  // Keep the page and the feed perfectly still while the bar is being dragged:
  // a finger drifting up or down would otherwise scroll the feed. Touch events
  // are blocked natively (React's listeners can't cancel them), and the feed's
  // scrolling is switched off until the finger lifts.
  useEffect(() => {
    const zone = zoneRef.current;
    if (!zone) return;
    const stop = (e: TouchEvent) => { e.preventDefault(); e.stopPropagation(); };
    zone.addEventListener('touchstart', stop, { passive: false });
    zone.addEventListener('touchmove', stop, { passive: false });
    return () => {
      zone.removeEventListener('touchstart', stop);
      zone.removeEventListener('touchmove', stop);
    };
  }, []);
  useEffect(() => {
    if (!dragging) return;
    const scroller = zoneRef.current?.closest('.overflow-y-scroll') as HTMLElement | null;
    const prevScroll = scroller?.style.overflowY ?? '';
    const prevBody = document.body.style.overflow;
    if (scroller) scroller.style.overflowY = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      if (scroller) scroller.style.overflowY = prevScroll;
      document.body.style.overflow = prevBody;
    };
  }, [dragging]);

  useEffect(() => {
    if (!video) return;
    let raf = 0;
    const tick = () => { if (!dragging) setTime(video.currentTime); raf = requestAnimationFrame(tick); };
    const onMeta = () => setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    onMeta();
    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('durationchange', onMeta);
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); video.removeEventListener('loadedmetadata', onMeta); video.removeEventListener('durationchange', onMeta); };
  }, [video, dragging]);

  function skip(seconds: number) {
    if (!video || !duration) return;
    video.currentTime = Math.min(Math.max(video.currentTime + seconds, 0), Math.max(duration - 0.1, 0));
    setTime(video.currentTime);
    setFlash(seconds < 0 ? 'back' : 'fwd');
    window.setTimeout(() => setFlash(null), 500);
  }

  // Arrow keys on a computer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); skip(-5); }
      if (e.key === 'ArrowRight') { e.preventDefault(); skip(5); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function seekTo(clientX: number) {
    const bar = barRef.current;
    if (!bar || !video || !duration) return;
    const r = bar.getBoundingClientRect();
    const ratio = Math.min(Math.max((clientX - r.left) / r.width, 0), 1);
    const t = ratio * duration;
    video.currentTime = t;
    setTime(t);
  }

  const pct = duration ? Math.min((time / duration) * 100, 100) : 0;
  const expanded = paused || dragging;

  return (
    <>
      {paused && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-10" data-no-swipe>
          <button type="button" aria-label="Rewind 10 seconds" onClick={(e) => { e.stopPropagation(); skip(-10); }}
            className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm active:scale-95">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><text x="12" y="15.5" fill="currentColor" stroke="none" fontSize="7" fontWeight="700" textAnchor="middle">10</text></svg>
          </button>
          <button type="button" aria-label="Play" onClick={(e) => { e.stopPropagation(); onResume(); }}
            className="pointer-events-auto flex h-16 w-16 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm active:scale-95">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
          </button>
          <button type="button" aria-label="Forward 10 seconds" onClick={(e) => { e.stopPropagation(); skip(10); }}
            className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm active:scale-95">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /><text x="12" y="15.5" fill="currentColor" stroke="none" fontSize="7" fontWeight="700" textAnchor="middle">10</text></svg>
          </button>
        </div>
      )}
      {flash && !paused && (
        <div className={`pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-4 py-2 text-sm font-semibold text-white ${flash === 'back' ? 'left-8' : 'right-8'}`}>
          {flash === 'back' ? '−5s' : '+5s'}
        </div>
      )}

      {/* Progress bar. Sits above the tab bar when it's showing (paused). */}
      <div
        ref={zoneRef}
        data-no-swipe
        className="absolute inset-x-0 z-20 touch-none select-none px-3"
        style={{ bottom: paused ? 'calc(4.75rem + env(safe-area-inset-bottom, 0px))' : 'env(safe-area-inset-bottom, 0px)' }}
      >
        {expanded && (
          <div className="mb-1 flex justify-between text-[11px] font-medium text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.7)]">
            <span>{fmt(time)}</span><span>{fmt(duration)}</span>
          </div>
        )}
        <div
          ref={barRef}
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(time)}
          aria-valuetext={`${fmt(time)} of ${fmt(duration)}`}
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'ArrowLeft') skip(-5); if (e.key === 'ArrowRight') skip(5); }}
          className="relative flex h-8 cursor-pointer touch-none items-center"
          onPointerDown={(e) => { e.stopPropagation(); (e.target as Element).setPointerCapture?.(e.pointerId); setDragging(true); seekTo(e.clientX); }}
          onPointerMove={(e) => { if (dragging) { e.preventDefault(); e.stopPropagation(); seekTo(e.clientX); } }}
          onPointerUp={(e) => { e.stopPropagation(); setDragging(false); }}
          onPointerCancel={() => setDragging(false)}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={`relative w-full overflow-hidden rounded-full bg-white/30 transition-all ${expanded ? 'h-1.5' : 'h-[3px]'}`}>
            <div className="absolute inset-y-0 left-0 bg-white" style={{ width: `${pct}%` }} />
          </div>
          {expanded && <div className="absolute h-4 w-4 -translate-x-1/2 rounded-full bg-white shadow" style={{ left: `${pct}%` }} />}
        </div>
      </div>
    </>
  );
}
