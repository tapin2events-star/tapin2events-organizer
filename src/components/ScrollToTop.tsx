import { useEffect, useState } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// 1) Opening a new page starts at the top (single-page apps otherwise keep the
//    old scroll position). Back/forward keeps the browser's own position, and
//    links to a section (#payouts, #password) are left to that page.
// 2) A floating "back to top" button appears once you've scrolled down a way.
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navType = useNavigationType();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (navType === 'POP' || hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname, hash, navType]);

  // Hidden while someone is filling in a field, so it never covers inputs.
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const isField = (el: Element | null) => !!el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
    const onIn = () => setTyping(isField(document.activeElement));
    const onOut = () => window.setTimeout(() => setTyping(isField(document.activeElement)), 0);
    document.addEventListener('focusin', onIn);
    document.addEventListener('focusout', onOut);
    return () => { document.removeEventListener('focusin', onIn); document.removeEventListener('focusout', onOut); };
  }, []);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setScrolled(window.scrollY > 600));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame); };
  }, []);

  const visible = scrolled && !typing;

  function toTop() {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  }

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label="Back to top"
      title="Back to top"
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      className={`fixed bottom-[calc(6.5rem+env(safe-area-inset-bottom,0px))] right-4 z-[999] flex h-12 w-12 items-center justify-center rounded-full bg-marigold text-white shadow-lg ring-1 ring-black/5 transition-all duration-200 hover:bg-marigold/90 md:bottom-8 md:right-8 ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
      }`}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}
