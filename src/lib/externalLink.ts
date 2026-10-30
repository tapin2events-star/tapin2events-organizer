import { isAndroid, isCapacitorApp, isIOS, isNativeApp } from './displayMode';

// Social links open the social app itself (Instagram, TikTok, Facebook, X, YouTube, Threads, Snapchat, LinkedIn),
// or its website when the app isn't installed.
export function normalizeUrl(url: string): string {
  const u = url.trim();
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}
export const SOCIAL_HOST = /(^|\.)(instagram\.com|tiktok\.com|facebook\.com|fb\.com|fb\.me|x\.com|twitter\.com|youtube\.com|youtu\.be|threads\.net|snapchat\.com|linkedin\.com)$/i;

// The phone's browser from inside the TapIN app (Safari via x-safari-https on iPhone, default browser via intent on
// Android); a normal new tab elsewhere. Used as the fallback when a social app isn't installed.
export function openInBrowser(href: string) {
  // Capacitor apps: Capacitor's browser (Safari's or Chrome's view, with its own sign-in, which the app-to-web
  // handoff uses). Loaded only inside the app, so the website itself doesn't carry it.
  if (isCapacitorApp()) {
    import('@capacitor/browser').then(({ Browser }) => Browser.open({ url: href, presentationStyle: 'fullscreen' })).catch(() => { window.open(href, '_blank', 'noopener'); });
    return;
  }
  if (isNativeApp()) {
    if (isAndroid()) {
      const u = new URL(href);
      window.location.href = `intent://${u.host}${u.pathname}${u.search}${u.hash}#Intent;scheme=${u.protocol.replace(':', '')};action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;S.browser_fallback_url=${encodeURIComponent(href)};end`;
      return;
    }
    if (isIOS()) {
      const fallback = window.setTimeout(() => { if (document.visibilityState === 'visible') window.open(href, '_blank', 'noopener'); }, 1200);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') window.clearTimeout(fallback); }, { once: true });
      window.location.href = href.replace(/^https?:\/\//i, (m) => `x-safari-${m.toLowerCase()}`);
      return;
    }
  }
  window.open(href, '_blank', 'noopener');
}
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
      const fallback = window.setTimeout(() => { if (document.visibilityState === 'visible') openInBrowser(href); }, 1000);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') window.clearTimeout(fallback); }, { once: true });
      window.location.href = app;
      return;
    }
  }
  window.open(href, '_blank', 'noopener');
}
