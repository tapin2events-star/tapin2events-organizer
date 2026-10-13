// Smoothly scroll the page back to the top (instant for people who prefer reduced motion).
export function scrollPageToTop() {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
}
