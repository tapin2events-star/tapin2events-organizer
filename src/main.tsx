import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

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
