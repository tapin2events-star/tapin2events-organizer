import { useEffect } from 'react';
import { openSocial, SOCIAL_HOST } from '../lib/externalLink';

// Social links (Instagram, TikTok, Facebook, X, YouTube, Threads, Snapchat, LinkedIn) open the social app itself (or
// its website when the app isn't installed), app-wide. Every other link opens normally. Links inside
// [data-no-viewer] (media on artist profiles) and Ctrl/Cmd/Shift/middle clicks are left alone.
export default function LinkViewer() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.('a');
      if (!a || !a.href || a.closest('[data-no-viewer]')) return;
      let u: URL;
      try { u = new URL(a.href, window.location.href); } catch { return; }
      if (!/^https?:$/.test(u.protocol) || !SOCIAL_HOST.test(u.hostname)) return;
      e.preventDefault();
      openSocial(u.href);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
  return null;
}
