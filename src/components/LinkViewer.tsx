import { useEffect, useState } from 'react';
import { openInBrowser, openSocial, SOCIAL_HOST, checkFrame, frameKnown } from '../lib/externalLink';
import { isIOS, isNativeApp } from '../lib/displayMode';

// The website viewer: an outside site in a sheet over TapIN, with Close and Open in browser. TapIN first checks
// (frame-check) whether the site allows being shown inside other sites; if not, it offers Open in browser instead
// of a blank screen.
interface Open { url: string; title?: string }
export default function LinkViewer() {
  const [link, setLink] = useState<Open | null>(null);
  const [state, setState] = useState<'checking' | 'show' | 'blocked'>('checking');
  const [src, setSrc] = useState('');
  useEffect(() => {
    const on = (e: Event) => { const d = (e as CustomEvent<Open>).detail; setLink(d); };
    window.addEventListener('tapin-open-link', on);
    return () => window.removeEventListener('tapin-open-link', on);
  }, []);
  // Every link to an outside website opens here, app-wide (including links added later). Left alone: TapIN's own
  // pages, email/phone/text, maps and directions, share links, downloads, links inside [data-no-viewer] (media
  // on artist profiles), and Ctrl/Cmd/Shift/middle clicks.
  useEffect(() => {
    const SKIP_HOST = /(^|\.)(tapin2events\.com|tapin2events\.pages\.dev|supabase\.co|stripe\.com|gumlet\.io|wa\.me|whatsapp\.com|maps\.apple\.com)$/i;
    const SKIP_PATH = /^https?:\/\/((www|maps)\.)?google\.[a-z.]+\/maps|^https?:\/\/maps\.google\.|^https?:\/\/(www\.)?facebook\.com\/sharer|^https?:\/\/(twitter|x)\.com\/intent|^https?:\/\/(www\.)?linkedin\.com\/(sharing|shareArticle)|^https?:\/\/calendar\.google\.com\/calendar\/render/i;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.('a');
      if (!a || !a.href || a.hasAttribute('download') || a.closest('[data-no-viewer]')) return;
      let u: URL;
      try { u = new URL(a.href, window.location.href); } catch { return; }
      if (!/^https?:$/.test(u.protocol) || u.origin === window.location.origin || SKIP_HOST.test(u.hostname) || SKIP_PATH.test(u.href)) return;
      e.preventDefault();
      // Social links: straight to the social app (or its website).
      if (SOCIAL_HOST.test(u.hostname)) { openSocial(u.href); return; }
      // Android app: the phone's browser. iPhone app and web browsers: the viewer (known-blocked sites go straight to
      // a new tab in web browsers; the iPhone app shows the viewer's explanation screen instead).
      if ((isNativeApp() && !isIOS()) || (!isNativeApp() && frameKnown(u.href)?.ok === false)) { openInBrowser(u.href); return; }
      const label = (a.getAttribute('aria-label') || a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);
      setLink({ url: u.href, title: label && !/^(website|link|open|visit)/i.test(label) ? label : undefined });
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
  useEffect(() => {
    if (!link) return;
    let alive = true;
    const known = frameKnown(link.url);
    if (known?.ok) { setSrc(known.src); setState('show'); } else if (known) { setSrc(''); setState('blocked'); } else { setState('checking'); setSrc(''); }
    if (!known) checkFrame(link.url).then((r) => {
      if (!alive) return;
      if (r.ok) { setSrc(r.src); setState('show'); return; }
      // Android app: skip the extra screen and open the phone's browser right away.
      if (isNativeApp() && !isIOS()) { openInBrowser(link.url); setLink(null); return; }
      setState('blocked');
    });
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setLink(null); };
    window.addEventListener('keydown', esc);
    return () => { alive = false; window.removeEventListener('keydown', esc); };
  }, [link]);
  if (!link) return null;
  let host = link.url;
  try { host = new URL(link.url).hostname.replace(/^www\./, ''); } catch { /* keep as is */ }
  return (
    <div className="fixed inset-0 z-[1400] flex items-end justify-center bg-black/50 sm:items-center sm:p-6" onClick={() => setLink(null)}>
      <div data-no-viewer role="dialog" aria-modal="true" aria-label={link.title ? `${link.title} website` : 'Website'} onClick={(e) => e.stopPropagation()}
        className="flex h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:h-[85vh] sm:rounded-3xl">
        <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-2">
          <button onClick={() => setLink(null)} aria-label="Close" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-2xl leading-none text-gray-600 hover:bg-gray-100">×</button>
          <div className="min-w-0 flex-1">
            {link.title && <p className="truncate text-sm font-semibold text-gray-900">{link.title}</p>}
            <p className="truncate text-xs text-gray-500">🔒 {host}</p>
          </div>
          <a href={link.url} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openInBrowser(link.url); }} className="shrink-0 rounded-full border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:border-gray-400">Open in browser ↗</a>
        </div>
        <div className="relative min-h-0 flex-1 bg-gray-50">
          {state === 'checking' && <div className="flex h-full items-center justify-center text-sm text-gray-500">Loading {host}…</div>}
          {state === 'show' && (
            <iframe src={src} title={link.title ?? host} className="h-full w-full border-0 bg-white"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer-when-downgrade" />
          )}
          {state === 'blocked' && (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <p className="text-3xl" aria-hidden="true">🌐</p>
              <p className="mt-2 font-semibold text-gray-900">{host} can&apos;t be shown inside TapIN</p>
              <p className="mt-1 max-w-xs text-sm text-gray-600">Some websites only open in a browser. You&apos;ll come right back to TapIN when you return.</p>
              <a href={link.url} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openInBrowser(link.url); }} className="mt-4 rounded-full bg-[#0F1B3D] px-5 py-3 text-sm font-semibold text-white">Open {host} in your browser ↗</a>
              <button onClick={() => setLink(null)} className="mt-2 px-4 py-2 text-sm text-gray-500">Back to TapIN</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
