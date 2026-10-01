import { useEffect, useRef, useState, type RefObject } from 'react';

// Swipe right on a touch screen to trigger onSwipe (used on the feed to open Discover).
// - Ignores swipes starting near the left edge, so iPhone's own "back" swipe still works.
// - Only takes over once the drag is clearly sideways; vertical scrolling is untouched.
// - Ignores swipes that start inside [data-no-swipe] areas or text fields.
// - The element follows the finger and springs back if released early.
const EDGE = 24;          // px from the left edge left to the browser
const LOCK = 12;          // px of movement before deciding direction
const DISTANCE = 0.33;    // share of screen width that commits the swipe
const FLICK = 0.5;        // px per ms that counts as a quick flick

export function useSwipeRight(ref: RefObject<HTMLElement | null>, onSwipe: () => void, enabled: boolean) {
  const [dragX, setDragX] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const onSwipeRef = useRef(onSwipe);
  onSwipeRef.current = onSwipe;

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    let startX = 0, startY = 0, startT = 0, dx = 0;
    let mode: 'idle' | 'deciding' | 'swiping' | 'ignored' = 'idle';
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) { mode = 'ignored'; return; }
      const t = e.touches[0];
      const target = e.target as Element | null;
      if (t.clientX < EDGE || target?.closest('[data-no-swipe], input, textarea, select, [contenteditable="true"]')) { mode = 'ignored'; return; }
      startX = t.clientX; startY = t.clientY; startT = Date.now(); dx = 0;
      mode = 'deciding';
    };

    const onMove = (e: TouchEvent) => {
      if (mode === 'idle' || mode === 'ignored') return;
      const t = e.touches[0];
      const mx = t.clientX - startX;
      const my = t.clientY - startY;
      if (mode === 'deciding') {
        if (Math.abs(mx) < LOCK && Math.abs(my) < LOCK) return;
        // Clearly sideways and to the right, or we leave it alone for the rest of this touch.
        mode = mx > 0 && Math.abs(mx) > Math.abs(my) * 1.5 ? 'swiping' : 'ignored';
        if (mode === 'ignored') return;
      }
      e.preventDefault(); // stop the feed from scrolling while swiping sideways
      dx = Math.max(mx, 0);
      setDragX(dx);
    };

    const onEnd = () => {
      if (mode !== 'swiping') { mode = 'idle'; return; }
      mode = 'idle';
      const speed = dx / Math.max(Date.now() - startT, 1);
      if (dx > window.innerWidth * DISTANCE || (speed > FLICK && dx > 60)) {
        setLeaving(true);
        setDragX(window.innerWidth);
        window.setTimeout(() => onSwipeRef.current(), reduceMotion ? 0 : 180);
      } else {
        setDragX(0);
      }
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [ref, enabled]);

  return { dragX, leaving, dragging: dragX > 0 };
}
