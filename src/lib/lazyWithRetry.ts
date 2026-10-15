import { lazy, type ComponentType } from 'react';

// Lazy-loaded pages: if a page's file can't be fetched (usually because TapIN was updated while the
// app was open), reload once to pick up the new version instead of showing a blank screen.
export default function lazyWithRetry<T extends ComponentType<object>>(factory: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const mod = await factory();
      try { sessionStorage.removeItem('tapin_chunk_reload'); } catch { /* storage unavailable */ }
      return mod;
    } catch (err) {
      let last = 0;
      try { last = Number(sessionStorage.getItem('tapin_chunk_reload') || 0); } catch { /* storage unavailable */ }
      if (Date.now() - last > 30000) {
        try { sessionStorage.setItem('tapin_chunk_reload', String(Date.now())); } catch { /* storage unavailable */ }
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }
  });
}
