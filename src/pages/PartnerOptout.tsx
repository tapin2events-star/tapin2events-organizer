import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

// Unsubscribe from TapIN local-partner emails (invitations and results).
export default function PartnerOptout() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<'working' | 'done' | 'invalid'>('working');
  const [email, setEmail] = useState('');
  useEffect(() => {
    supabase.rpc('partner_email_optout', { p_token: token }).then(({ data, error }) => {
      if (error || !data) setState('invalid'); else { setEmail(String(data)); setState('done'); }
    });
  }, [token]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F4F7] px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-black/5">
        <p className="text-xl font-extrabold text-[#0F1B3D]">TapIN</p>
        {state === 'working' && <p className="mt-4 text-sm text-gray-600">Unsubscribing…</p>}
        {state === 'done' && <><p className="mt-4 text-lg font-bold text-gray-900">You're unsubscribed</p><p className="mt-1 text-sm text-gray-600">{email} won't get local partner emails from TapIN anymore.</p></>}
        {state === 'invalid' && <p className="mt-4 text-sm text-gray-600">This unsubscribe link isn't valid. Reply to the email you received and we'll take care of it.</p>}
      </div>
    </div>
  );
}
