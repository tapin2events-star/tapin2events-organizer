import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

// /business/orgs/<id> (used by some notifications) -> the organization's Manage page (by slug), Music tab.
export default function OrgIdRedirect() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  useEffect(() => {
    if (!id) { navigate('/business', { replace: true }); return; }
    supabase.from('organizations').select('slug').eq('id', id).maybeSingle().then(({ data }) => navigate(data?.slug ? `/business/${data.slug}/manage?tab=Music` : '/business', { replace: true }));
  }, [id, navigate]);
  return null;
}
