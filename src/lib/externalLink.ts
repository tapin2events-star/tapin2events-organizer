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
  window.dispatchEvent(new CustomEvent('tapin-open-link', { detail: { url: href, title } }));
}
