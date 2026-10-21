// Is TapIN running as a Home Screen app (full screen) or in a regular browser tab?

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

// Running inside an app-store app that wraps this site (built with Twinr).
// Detected by Twinr's "twnr_mobile_app_agent" marker (its Android app reports an iPhone user agent, so the marker is
// the reliable signal), a "TapINApp" marker if the wrapper adds one, or by
// the WebView fingerprint: Android WebViews include "; wv)", and iOS app WebViews
// lack the "Safari/" token every real iPhone browser sends.
export function isNativeApp(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/TapINApp|twnr_mobile_app_agent/i.test(ua)) return true;
  if (/Android/.test(ua) && /; wv\)/.test(ua)) return true;
  if (/iPhone|iPad|iPod/.test(ua) && !/Safari\//.test(ua) && !isInAppBrowser()) return true;
  return false;
}

// Either kind of "app" experience: Home Screen web app or app-store app.
export function isAppMode(): boolean {
  return isStandalone() || isNativeApp();
}

// A real iPhone/iPad. Some app wrappers (TapIN's Android app) claim to be an iPhone, so check the engine too:
// Chromium (Android phones, Android WebViews, desktop Chrome) exposes navigator.userAgentData, Apple's WebKit never does.
export function isChromiumEngine(): boolean {
  return typeof navigator !== 'undefined' && 'userAgentData' in navigator;
}
export function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  const uad = (navigator as Navigator & { userAgentData?: { platform?: string; mobile?: boolean } }).userAgentData;
  return /Android/i.test(navigator.userAgent) || uad?.platform === 'Android' || (isChromiumEngine() && /iPhone|iPad|iPod/.test(navigator.userAgent));
}
export function isIOS(): boolean {
  const ua = navigator.userAgent;
  if (isChromiumEngine() || /Android/i.test(ua)) return false;
  // iPadOS reports itself as a Mac, so also check for touch.
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

// Instagram, Facebook, TikTok, etc. open links in their own browsers, which can't add to the Home Screen.
export function isInAppBrowser(): boolean {
  return /FBAN|FBAV|Instagram|Line\/|Twitter|TikTok|musical_ly|Snapchat|LinkedInApp/i.test(navigator.userAgent);
}

export function isPhoneSized(): boolean {
  return window.matchMedia?.('(pointer: coarse)').matches && window.innerWidth < 768;
}

// Lets CSS and code know which mode we're in: <html data-standalone="true">
export function markDisplayMode() {
  document.documentElement.dataset.standalone = String(isStandalone());
  document.documentElement.dataset.nativeApp = String(isNativeApp());
}
