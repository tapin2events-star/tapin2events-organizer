import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import CreatorProfile from './CreatorProfile';

// /u/:id: a person's public TapIN profile by account, so links (e.g. an organization's featured people) don't put
// their email address in the page address.
export default function UserProfileById() {
  const { id } = useParams<{ id: string }>();
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  useEffect(() => { supabase.rpc('profile_email_by_id', { p_id: id }).then(({ data }) => setEmail(typeof data === 'string' ? data : null)); }, [id]);
  if (email === undefined) return <div className="mx-auto max-w-2xl px-4 py-10 text-sm text-muted">Loading…</div>;
  if (!email) return <div className="mx-auto max-w-2xl px-4 py-10 text-sm text-muted">This profile isn't available.</div>;
  return <CreatorProfile emailOverride={email} />;
}
