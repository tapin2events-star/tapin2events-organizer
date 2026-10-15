// Load the code for the most-used pages in the background once TapIN is idle, so navigating to them
// doesn't wait on a download. Safe to call more than once.
let done = false;
export function prefetchCommonPages() {
  if (done || typeof window === 'undefined') return;
  done = true;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (conn?.saveData || conn?.effectiveType === '2g' || conn?.effectiveType === 'slow-2g') return;
  const run = () => {
    const pages = [
      () => import('../pages/PublicEventDetail'),
      () => import('../pages/Feed'),
      () => import('../pages/MyActivity'),
      () => import('../pages/Profile'),
      () => import('../pages/Dashboard'),
      () => import('../pages/EventDetail'),
      () => import('../pages/Planning'),
    ];
    pages.reduce((p, load) => p.then(() => load().then(() => undefined, () => undefined)), Promise.resolve());
  };
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
  if (idle) idle(run, { timeout: 4000 }); else window.setTimeout(run, 2500);
}
