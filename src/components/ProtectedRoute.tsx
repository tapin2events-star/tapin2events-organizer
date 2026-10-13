import { Navigate, useLocation } from 'react-router-dom';
import { DetailSkeleton } from './ui/Skeleton';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <DetailSkeleton className="mx-auto max-w-3xl py-4" />;
  }

  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;

  return <>{children}</>;
}
