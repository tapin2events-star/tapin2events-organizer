import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading, adminChecked } = useAuth();

  // Wait for BOTH the session check and the (separate, slightly slower)
  // admin lookup to finish — otherwise a genuine admin could be briefly
  // redirected away before their admin status has actually been confirmed.
  if (loading || (user && !adminChecked)) return <p className="text-muted">Loading…</p>;
  if (!user || !isAdmin) return <Navigate to="/" replace />;

  return <>{children}</>;
}
