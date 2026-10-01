// Is TapIN running as a Home Screen app (full screen) or in a regular browser tab?

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isIOS(): boolean {
  const ua = navigator.userAgent;
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
}
