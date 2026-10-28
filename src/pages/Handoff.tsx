import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

// App-to-web handoff: signs the person in with the one-time pass from the phone app, then continues where they were
// going (e.g. checkout for a song). If the pass expired, it continues anyway (guest checkout still works).
export default function Handoff() {
  const navigate = useNavigate();
  const [msg, setMsg] = useState('Signing you in…');
  useEffect(() => {
    const h = new URLSearchParams(window.location.search).get('h');
    (async () => {
      if (!h) { navigate('/', { replace: true }); return; }
      const { data } = await supabase.functions.invoke('app-handoff', { body: { action: 'redeem', h } });
      const r = data as { token_hash?: string; next?: string; error?: string } | null;
      if (r?.token_hash) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: r.token_hash, type: 'magiclink' });
        if (!error) { navigate(r.next ?? '/', { replace: true }); return; }
      }
      setMsg('This link expired. Taking you back…');
      setTimeout(() => navigate(r?.next ?? '/', { replace: true }), 1200);
    })();
  }, [navigate]);
  return <div className="flex min-h-[60vh] items-center justify-center"><p className="text-sm text-gray-600">{msg}</p></div>;
}
