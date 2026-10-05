import { useNavigate } from 'react-router-dom';

// Goes back to the page you came from. If there isn't one inside TapIN (you
// opened a shared link, or refreshed), it goes to `fallback` instead, so the
// button never sends people out of the app or nowhere.
export function hasInAppHistory(): boolean {
  const idx = (window.history.state as { idx?: number } | null)?.idx;
  return typeof idx === 'number' && idx > 0;
}

export default function BackButton({
  fallback = '/',
  fallbackLabel = 'Back',
  variant = 'link',
  className = '',
}: {
  fallback?: string;
  fallbackLabel?: string;
  variant?: 'link' | 'overlay';
  className?: string;
}) {
  const navigate = useNavigate();
  const canGoBack = hasInAppHistory();
  const label = canGoBack ? 'Back' : fallbackLabel;
  const go = () => (canGoBack ? navigate(-1) : navigate(fallback, { replace: true }));

  if (variant === 'overlay') {
    return (
      <button type="button" onClick={go} aria-label={label}
        className={`flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 ${className}`}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
      </button>
    );
  }
  return (
    <button type="button" onClick={go}
      className={`-my-2 inline-flex items-center gap-1 py-2 text-sm font-medium text-marigold hover:underline print:hidden ${className}`}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
      {label}
    </button>
  );
}
