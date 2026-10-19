// Keeps everyone on the newest TapIN: checks /version.json (never cached) every 2 minutes and when the app comes
// back to the screen. When a newer version is live, it refreshes at a safe moment: when the person opens a
// different page, or when they come back to the app, never while they're typing.
declare const __TAPIN_BUILD__: string;
const CURRENT = typeof __TAPIN_BUILD__ === 'string' ? __TAPIN_BUILD__ : 'dev';
let updateReady = false;
let lastCheck = 0;

async function check() {
  if (CURRENT === 'dev' || updateReady || Date.now() - lastCheck < 30_000) return;
  lastCheck = Date.now();
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const { build } = (await res.json()) as { build?: string };
    if (build && build !== CURRENT) updateReady = true;
  } catch { /* offline: try later */ }
}

const typing = () => {
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
};
function refreshIfReady() {
  if (!updateReady || typing()) return;
  // Avoid a refresh loop if the new file is still propagating: at most once a minute.
  try {
    const last = Number(sessionStorage.getItem('tapin_update_reload') || 0);
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem('tapin_update_reload', String(Date.now()));
  } catch { /* private mode */ }
  window.location.reload();
}

export function startUpdateChecks() {
  if (CURRENT === 'dev') return;
  check();
  setInterval(check, 2 * 60_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { refreshIfReady(); check(); }
  });
  window.addEventListener('focus', () => check());
}

// Called when the person moves to another page: a natural moment to switch to the new version.
export function onNavigate() { refreshIfReady(); }
