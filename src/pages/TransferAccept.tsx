import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

// The new owner's page (from the transfer email): accept or decline ownership of an event or organization.
interface View { kind: 'event' | 'organization'; status: string; to_email: string; keep_access: boolean; note: string | null; target_id: string; name: string | null; from_name: string; slug: string | null }
export default function TransferAccept() {
  const { token } = useParams<{ token: string }>();
  const { user, loading } = useAuth();
  const [v, setV] = useState<View | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<'accepted' | 'declined' | null>(null);
  useEffect(() => { supabase.rpc('ownership_transfer_view', { p_token: token }).then(({ data }) => setV((data ?? null) as View | null)); }, [token]);
  async function respond(accept: boolean) {
    if (!accept && !window.confirm('Decline this ownership transfer?')) return;
    setBusy(true); setErr(null);
    const { data, error } = await supabase.rpc('respond_ownership_transfer', { p_token: token, p_accept: accept });
    setBusy(false);
    if (error) return setErr(error.message);
    setDone(data === 'accepted' ? 'accepted' : 'declined');
  }
  const what = v?.kind === 'organization' ? 'organization' : 'event';
  const openLink = v ? (v.kind === 'organization' ? `/business/${v.slug}/manage` : `/organizer/events/${v.target_id}`) : '/';
  const signedInAs = user?.email?.toLowerCase();
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        {v === undefined || loading ? <p className="text-sm text-gray-500">Loading…</p> : !v ? (
          <p className="text-sm text-gray-600">This link isn&apos;t valid.</p>
        ) : (
          <>
            <p className="text-3xl" aria-hidden="true">🔑</p>
            <h1 className="mt-2 font-display text-2xl font-bold text-gray-900 [overflow-wrap:anywhere]">{v.name ?? `This ${what}`}</h1>
            <p className="mt-2 text-sm text-gray-600"><strong>{v.from_name}</strong> would like to make you the owner of this {what} on TapIN.</p>
            {v.note && <p className="mt-3 rounded-xl bg-gray-50 p-3 text-sm text-gray-700">&ldquo;{v.note}&rdquo;</p>}
            {done === 'accepted' || v.status === 'accepted' ? (
              <div className="mt-5 rounded-2xl bg-green-50 p-4 text-sm text-green-900">
                <p className="font-semibold">🎉 You&apos;re the owner now!</p>
                <Link to={openLink} className="mt-3 inline-block rounded-xl bg-[#0F1B3D] px-4 py-2.5 font-semibold text-white">Open {what}</Link>
              </div>
            ) : done === 'declined' || v.status === 'declined' ? (
              <p className="mt-5 rounded-2xl bg-gray-50 p-4 text-sm text-gray-700">You declined this transfer.</p>
            ) : v.status !== 'pending' ? (
              <p className="mt-5 rounded-2xl bg-gray-50 p-4 text-sm text-gray-700">This transfer is no longer active.</p>
            ) : !user ? (
              <div className="mt-5">
                <p className="text-sm text-gray-600">Sign in (or sign up free) with <strong className="[overflow-wrap:anywhere]">{v.to_email}</strong> to accept.</p>
                <Link to="/login" state={{ from: `/transfer/${token}` }} className="mt-3 inline-block w-full rounded-xl bg-[#0F1B3D] py-3 text-center text-sm font-semibold text-white">Sign in to accept</Link>
              </div>
            ) : signedInAs !== v.to_email ? (
              <p className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 [overflow-wrap:anywhere]">This transfer is for <strong>{v.to_email}</strong>, but you&apos;re signed in as {user.email}. Sign out and sign in with {v.to_email} to accept.</p>
            ) : (
              <div className="mt-5">
                <p className="text-sm text-gray-600">As the owner, you&apos;ll have full control of this {what}.{v.keep_access ? ` ${v.from_name} will stay on as an Admin to help.` : ''}</p>
                {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
                <button onClick={() => respond(true)} disabled={busy} className="mt-4 w-full rounded-xl bg-[#0F1B3D] py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Accepting…' : 'Accept ownership'}</button>
                <button onClick={() => respond(false)} disabled={busy} className="mt-2 w-full py-2 text-sm font-medium text-gray-500">Decline</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
