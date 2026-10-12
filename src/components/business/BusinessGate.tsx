import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useFeature } from '../../lib/preview';

// TapIN for Business is in preview: only admins with Preview mode on see it.
export default function BusinessGate({ children }: { children: ReactNode }) {
  const on = useFeature('business');
  if (on) return <>{children}</>;
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="font-display text-2xl font-bold text-bone">Coming soon</p>
      <p className="mt-2 text-sm text-muted">TapIN for Business isn't available yet.</p>
      <Link to="/" className="mt-4 inline-block text-sm font-medium text-marigold">Back to TapIN</Link>
    </div>
  );
}
