import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// Opening a new page starts at the top (single-page apps otherwise keep the old scroll position).
// Back/forward keeps the browser's own position, and links to a section (#payouts, #password) are
// left to that page. To get back to the top on a long page: tap the bottom-menu tab you're on, or
// tap the top bar (see BottomTabBar and Layout).
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navType = useNavigationType();
  useEffect(() => {
    if (navType === 'POP' || hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname, hash, navType]);
  return null;
}
