import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [checked, setChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setChecked(true);
      return;
    }
    supabase.from('profiles').select('is_admin').eq('id', user.id).single().then(({ data }) => {
      setIsAdmin(!!data?.is_admin);
      setChecked(true);
    });
  }, [user, authLoading]);

  if (authLoading || !checked) return <p className="text-muted">Loading…</p>;
  if (!user || !isAdmin) return <Navigate to="/" replace />;

  return <>{children}</>;
}
