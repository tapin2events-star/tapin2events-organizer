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
