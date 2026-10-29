import { StrictMode } from 'react';
import { startUpdateChecks, safeReload } from './lib/appUpdate';
import { applyCachedDisplay } from './lib/display';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { markDisplayMode } from './lib/displayMode';

// Coming back to TapIN with the browser's Back button (for example from a Stripe checkout page) can restore the
// page exactly as it was, including buttons stuck on "Opening checkout…". Reload so every page starts fresh.
applyCachedDisplay();
startUpdateChecks();
// Restored from the browser's back/forward memory: reload, but only after any sign-in renewal is saved (see safeReload).
window.addEventListener('pageshow', (e) => { if ((e as PageTransitionEvent).persisted) void safeReload(); });


markDisplayMode();

// Old links from tapin2events-star.github.io/tapin2events-organizer/... arrive here
// with that folder still in the path; drop it so they open the right page.
const OLD_PREFIX = '/tapin2events-organizer';
if (window.location.pathname === OLD_PREFIX || window.location.pathname.startsWith(OLD_PREFIX + '/')) {
  const rest = window.location.pathname.slice(OLD_PREFIX.length) || '/';
  window.history.replaceState(null, '', rest + window.location.search + window.location.hash);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
