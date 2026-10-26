import { isAndroid, isIOS, isNativeApp } from './displayMode';
// Open an outside website without leaving TapIN: a viewer sheet over the page (with Close and Open in browser).
// Inside a Capacitor app, the phone's own in-app browser is used instead (it shows every website).
type CapBrowser = { open: (o: { url: string }) => Promise<void> };
export function normalizeUrl(url: string): string {
  const u = url.trim();
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}
export function openExternal(url: string, title?: string) {
  const href = normalizeUrl(url);
  const cap = (window as unknown as { Capacitor?: { Plugins?: { Browser?: CapBrowser } } }).Capacitor?.Plugins?.Browser;
  if (cap) { cap.open({ url: href }).catch(() => window.open(href, '_blank', 'noopener')); return; }
  try { if (SOCIAL_HOST.test(new URL(href).hostname)) { openSocial(href); return; } } catch { /* not a valid address */ }
  // TapIN's Android app hands links to the phone's browser. Twinr's iPhone app doesn't pass "open in Safari" links to
  // iOS, so iPhone uses the viewer (with Close), like web browsers.
  if ((isNativeApp() && !isIOS()) || (!isNativeApp() && frameKnown(href)?.ok === false)) { openInBrowser(href); return; }
  window.dispatchEvent(new CustomEvent('tapin-open-link', { detail: { url: href, title } }));
}

// "Open in browser": the phone's real browser, even from inside the TapIN app (where an ordinary link may stay
// inside the app). iPhone: Safari's x-safari-https:// link (iOS 17+). Android: an intent that opens the page in the
// default browser (falls back to the page itself). Elsewhere: a normal new tab.
export function openInBrowser(url: string) {
  const href = normalizeUrl(url);
  if (isNativeApp()) {
    if (isAndroid()) {
      const u = new URL(href);
      window.location.href = `intent://${u.host}${u.pathname}${u.search}${u.hash}#Intent;scheme=${u.protocol.replace(':', '')};action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;S.browser_fallback_url=${encodeURIComponent(href)};end`;
      return;
    }
    if (isIOS()) {
      // Older iPhones (before iOS 17) ignore x-safari links: if TapIN is still showing a moment later, open it normally.
      const fallback = window.setTimeout(() => { if (document.visibilityState === 'visible') window.open(href, '_blank', 'noopener'); }, 1200);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') window.clearTimeout(fallback); }, { once: true });
      window.location.href = href.replace(/^https?:\/\//i, (m) => `x-safari-${m.toLowerCase()}`);
      return;
    }
  }
  window.open(href, '_blank', 'noopener');
}

// Social links open the social app itself (or its website when the app isn't installed), never the viewer:
// those sites refuse to be shown inside other sites.
export const SOCIAL_HOST = /(^|\.)(instagram\.com|tiktok\.com|facebook\.com|fb\.com|fb\.me|x\.com|twitter\.com|youtube\.com|youtu\.be|threads\.net|snapchat\.com|linkedin\.com)$/i;
function iosAppUrl(u: URL): string | null {
  const host = u.hostname.replace(/^(www|m)\./, '');
  const first = u.pathname.split('/').filter(Boolean)[0] ?? '';
  if (host === 'instagram.com' && first && !['p', 'reel', 'reels', 'stories', 'explore'].includes(first)) return `instagram://user?username=${encodeURIComponent(first)}`;
  if ((host === 'x.com' || host === 'twitter.com') && first && !['i', 'intent', 'search', 'hashtag'].includes(first)) return `twitter://user?screen_name=${encodeURIComponent(first)}`;
  if (host === 'youtube.com' || host === 'youtu.be') return `youtube://${u.host}${u.pathname}${u.search}`;
  if (host === 'facebook.com' || host === 'fb.com') return `fb://facewebmodal/f?href=${encodeURIComponent(u.href)}`;
  return null;
}
export function openSocial(url: string) {
  const href = normalizeUrl(url);
  if (isNativeApp()) {
    if (isAndroid()) { openInBrowser(href); return; } // Android hands https links to the app that owns them
    if (isIOS()) {
      const app = iosAppUrl(new URL(href));
      if (!app) { openInBrowser(href); return; }
      // If the app isn't installed (TapIN is still showing a moment later), open the site in Safari instead.
      const fallback = window.setTimeout(() => { if (document.visibilityState === 'visible') openInBrowser(href); }, 1000);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') window.clearTimeout(fallback); }, { once: true });
      window.location.href = app;
      return;
    }
  }
  window.open(href, '_blank', 'noopener');
}

// Which websites can be shown inside TapIN's viewer (from /frame-check), remembered for an hour, so a tap can go
// the right way instantly: the viewer for sites that allow it, straight to the browser for sites that don't.
const FRAME_KEY = 'tapin-frame-check';
const HOUR = 3600_000;
type FrameEntry = { ok: boolean; src: string; at: number };
const frameCache = new Map<string, FrameEntry>();
try {
  const saved = JSON.parse(localStorage.getItem(FRAME_KEY) || '{}') as Record<string, FrameEntry>;
  for (const [k, v] of Object.entries(saved)) if (Date.now() - v.at < HOUR) frameCache.set(k, v);
} catch { /* private mode */ }
const saveFrames = () => { try { localStorage.setItem(FRAME_KEY, JSON.stringify(Object.fromEntries([...frameCache].slice(-200)))); } catch { /* full or private */ } };
const pending = new Map<string, Promise<FrameEntry>>();
export function frameKnown(url: string): FrameEntry | null {
  const e = frameCache.get(normalizeUrl(url));
  return e && Date.now() - e.at < HOUR ? e : null;
}
export function checkFrame(url: string): Promise<FrameEntry> {
  const href = normalizeUrl(url);
  const known = frameKnown(href);
  if (known) return Promise.resolve(known);
  if (!pending.has(href)) {
    pending.set(href, fetch(`/frame-check?url=${encodeURIComponent(href)}`).then((r) => r.json())
      .then((j: { embeddable?: boolean; url?: string }) => ({ ok: !!j.embeddable, src: j.url || href, at: Date.now() }))
      .catch(() => ({ ok: false, src: href, at: Date.now() }))
      .then((e) => { frameCache.set(href, e); saveFrames(); pending.delete(href); return e; }));
  }
  return pending.get(href)!;
}
/** Check websites ahead of time (e.g. the places in Make a night of it). */
export function prefetchFrames(urls: (string | null | undefined)[]) {
  for (const u of urls) {
    if (!u) continue;
    try { if (SOCIAL_HOST.test(new URL(normalizeUrl(u)).hostname)) continue; } catch { continue; }
    checkFrame(u);
  }
}
