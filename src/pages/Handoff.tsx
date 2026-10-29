import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { isNativeApp } from '../lib/displayMode';

// App-to-web handoff: signs the person in with the one-time pass from the phone app, then continues where they were
// going (e.g. checkout for a song). If this window is already signed in (the pass opened inside the app itself, or in a
// browser that already has a TapIN session), the pass is left unused and the existing session is kept: signing in
// again here would create a second copy of the session, and two copies refreshing the same tokens get the whole session
// revoked (which signs the person out everywhere). If the pass expired, it continues anyway (guest checkout works).
export default function Handoff() {
  const navigate = useNavigate();
  const [msg, setMsg] = useState('Signing you in…');
  useEffect(() => {
    const h = new URLSearchParams(window.location.search).get('h');
    (async () => {
      if (!h) { navigate('/', { replace: true }); return; }
      const { data: existing } = await supabase.auth.getSession();
      let next: string | null = null;
      if (existing.session || isNativeApp()) {
        // Already signed in here: find out where to go, without using the pass to sign in.
        const { data } = await supabase.functions.invoke('app-handoff', { body: { action: 'peek', h } });
        next = (data as { next?: string } | null)?.next ?? null;
        if (!existing.session && isNativeApp()) setMsg('Continuing…');
        navigate(next ?? '/', { replace: true });
        return;
      }
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
