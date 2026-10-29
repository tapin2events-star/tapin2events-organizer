import { lazy, type ComponentType } from 'react';
import { safeReload } from './appUpdate';

// Lazy-loaded pages: if a page's file can't be fetched (usually because TapIN was updated while the
// app was open), reload once to pick up the new version instead of showing a blank screen.
export default function lazyWithRetry<T extends ComponentType<object>>(factory: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const mod = await factory();
      try { sessionStorage.removeItem('tapin_chunk_reload'); } catch { /* storage unavailable */ }
      return mod;
    } catch (err) {
      // Refresh the browser's saved copy of the file that failed (a bad copy would otherwise be reused on reload).
      const url = String((err as Error)?.message ?? '').match(/https?:\/\/[^\s'"]+\.js/)?.[0];
      if (url) { try { await fetch(url, { cache: 'reload' }); } catch { /* offline: the reload below still helps */ } }
      let last = 0;
      try { last = Number(sessionStorage.getItem('tapin_chunk_reload') || 0); } catch { /* storage unavailable */ }
      if (Date.now() - last > 30000) {
        try { sessionStorage.setItem('tapin_chunk_reload', String(Date.now())); } catch { /* storage unavailable */ }
        // Let any sign-in renewal in progress finish and be saved first (getSession waits for it), so the reloaded page
        // doesn't reuse a just-replaced token, which Supabase treats as theft and ends the session.
        try { const { supabase } = await import('./supabaseClient'); await Promise.race([supabase.auth.getSession(), new Promise((r) => setTimeout(r, 3000))]); } catch { /* reload anyway */ }
        void safeReload();
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }
  });
}
