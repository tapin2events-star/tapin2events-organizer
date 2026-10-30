import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import BrandedSignIn, { TAPIN_BRAND } from '../components/BrandedSignIn';
import QuickArtistProfile from '../components/invites/QuickArtistProfile';

// Join page for an email invite (people not on TapIN yet): what they're invited to, then Accept (quick sign-up with the
// invited email, locked) -> for artist groups, an optional artist profile -> they're a member. Decline and "don't send
// me invites" work without signing in.
interface Preview { id: string; kind: 'group' | 'org'; target_id: string; email: string; name: string | null; role: string; title: string | null; note: string | null; status: string; inviter: string; target_name: string; target_photo: string | null; target_link: string; members: number }
export default function InviteJoin() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [p, setP] = useState<Preview | null | undefined>(undefined);
  const [signIn, setSignIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [step, setStep] = useState<'invite' | 'profile' | 'done'>('invite');
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { if (id) supabase.rpc('invite_preview', { p_id: id }).then(({ data }) => setP((data ?? null) as Preview | null)); }, [id]);
  // From the email footer: decline, or decline and opt out of invites.
  useEffect(() => {
    if (!p || p.status !== 'pending') return;
    const q = new URLSearchParams(window.location.search);
    if (q.get('decline') || q.get('optout')) {
      supabase.rpc('decline_email_invite', { p_id: p.id, p_optout: !!q.get('optout') }).then(() => setMsg(q.get('optout') ? 'Got it. We won\u2019t send you invites anymore.' : 'Invite declined. Thanks for letting us know.'));
    }
  }, [p]);
  async function accept() {
    if (!p) return;
    if (!user) { setSignIn(true); return; }
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc('accept_email_invite', { p_id: p.id });
    setBusy(false);
    if (error) return setErr(error.message);
    if (p.kind === 'group') {
      // Offer an artist profile if they don't have one yet.
      const { data: mine } = await supabase.from('resources').select('id').ilike('email', user.email ?? '').eq('kind', 'individual').limit(1);
      if (!mine || mine.length === 0) { setStep('profile'); return; }
    }
    finish();
  }
  function finish() {
    if (!p) return;
    navigate(p.kind === 'group' ? `/groups/${p.target_id}/manage?joined=1` : `/business/orgs/${p.target_id}`, { replace: true });
  }
  // Signed in with a different account than the invite's email.
  const wrongAccount = !!user && !!p && (user.email ?? '').toLowerCase() !== p.email.toLowerCase();

  if (p === undefined) return <div className="mx-auto max-w-md" />;
  if (!p) return <div className="mx-auto max-w-md py-10 text-center"><p className="text-gray-600">This invite wasn&apos;t found.</p><Link to="/" className="mt-3 inline-block text-marigold underline">Go to TapIN</Link></div>;
  if (step === 'profile') return <div className="mx-auto max-w-md"><QuickArtistProfile defaultName={p.name ?? ''} groupName={p.target_name} onDone={finish} /></div>;
  return (
    <div className="mx-auto max-w-md">
      <div className="overflow-hidden rounded-[28px] bg-gradient-to-br from-indigo-600 via-violet-600 to-teal-500 p-6 text-center text-white">
        {p.target_photo ? <img src={p.target_photo} alt="" className="mx-auto h-24 w-24 rounded-full object-cover ring-4 ring-white/40" /> : <span className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-white text-4xl font-extrabold text-indigo-600">{p.target_name.charAt(0)}</span>}
        <p className="mt-4 text-sm font-semibold uppercase tracking-widest text-white/85">You&apos;re invited</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold text-white">{p.inviter} invited you to join {p.target_name}</h1>
        <p className="mt-1 text-sm text-white/90">{p.kind === 'group' ? 'Artist group' : 'Organization'} · {p.members} member{p.members === 1 ? '' : 's'}{p.title ? ` · as ${p.title}` : p.role === 'admin' ? ' · as an admin' : ''}</p>
      </div>
      {p.note && <blockquote className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 text-gray-800">“{p.note}”<footer className="mt-1 text-sm text-gray-500">— {p.inviter}</footer></blockquote>}
      {msg ? <p className="mt-6 rounded-2xl bg-gray-50 p-4 text-center text-sm text-gray-700">{msg}</p>
        : p.status !== 'pending' ? <p className="mt-6 rounded-2xl bg-amber-50 p-4 text-center text-sm text-amber-900">{p.status === 'accepted' ? 'This invite was already accepted.' : p.status === 'expired' ? 'This invite has expired. Ask them to send a new one.' : 'This invite is no longer active.'}</p>
        : (
          <div className="mt-6 flex flex-col gap-3">
            {wrongAccount && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">This invite was sent to <strong>{p.email}</strong>, but you&apos;re signed in as {user?.email}. Sign out and sign in with {p.email} to accept it.</p>}
            <button onClick={accept} disabled={busy || wrongAccount} className="min-h-[52px] rounded-full bg-[#0F1B3D] text-base font-bold text-white disabled:opacity-50">{busy ? 'Joining…' : `Accept and join ${p.target_name}`}</button>
            {!user && <p className="text-center text-xs text-gray-500">You&apos;ll sign up with {p.email} in a minute: no password needed.</p>}
            <button onClick={() => supabase.rpc('decline_email_invite', { p_id: p.id, p_optout: false }).then(() => setMsg('Invite declined. Thanks for letting us know.'))} className="min-h-[44px] text-sm font-medium text-gray-600">Decline</button>
            {err && <p role="alert" className="text-center text-sm text-red-600">{err}</p>}
          </div>
        )}
      <p className="mt-6 text-center text-sm"><Link to={p.target_link} className="text-marigold underline">See {p.target_name}&apos;s page</Link></p>
      {signIn && <BrandedSignIn brand={TAPIN_BRAND} branded={false} lockedEmail={p.email} initialName={p.name ?? ''} onClose={() => setSignIn(false)} onDone={() => { setSignIn(false); setTimeout(accept, 300); }} />}
    </div>
  );
}
