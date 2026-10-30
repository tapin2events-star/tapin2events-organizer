import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { toast, toastError } from '../../lib/toast';
import PendingEmailInvites, { InviteByEmailForm, sendEmailInvite } from '../invites/EmailInvites';

// Profile managers: people who run an artist profile for its owner (everything except payouts, ownership and deleting).
interface Managed { id: string; name: string; photo: string | null; claimed: boolean }

// Switch between your own profile and profiles you manage.
export function ProfileSwitcher({ currentId, ownId }: { currentId: string | null; ownId: string | null }) {
  const [list, setList] = useState<Managed[]>([]);
  useEffect(() => { supabase.rpc('my_managed_profiles').then(({ data }) => setList(((data ?? []) as Managed[]).filter((p) => p.id !== ownId))); }, [ownId]);
  if (list.length === 0) return null;
  const chip = (active: boolean) => `inline-flex min-h-[36px] shrink-0 items-center gap-2 rounded-full border px-3 text-sm font-semibold ${active ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-300 bg-white text-gray-800'}`;
  return (
    <div className="mb-4 flex gap-2 overflow-x-auto pb-1" aria-label="Profiles you manage">
      {ownId && <Link to="/resources/dashboard" className={chip(currentId === ownId)}>Your profile</Link>}
      {list.map((p) => (
        <Link key={p.id} to={`/resources/dashboard?profile=${p.id}`} className={chip(currentId === p.id)}>
          {p.photo ? <img src={p.photo} alt="" className="h-6 w-6 rounded-full object-cover" /> : null}{p.name}{!p.claimed && <span className="text-[11px] font-normal opacity-80">· not claimed</span>}
        </Link>
      ))}
    </div>
  );
}

// Shown when you're managing someone else's profile.
export function ManagingBanner({ resource }: { resource: { id: string; display_name: string; email: string; claim_status?: string | null; status?: string | null } }) {
  const unclaimed = resource.claim_status === 'unclaimed';
  async function resend() {
    const { data: pending } = await supabase.rpc('pending_email_invites', { p_kind: 'claim', p_target: resource.id });
    const p = ((pending ?? []) as { id: string }[])[0];
    if (p) {
      const { error } = await supabase.functions.invoke('email-invites', { body: { action: 'send', id: p.id } });
      if (error) return toastError('Couldn\u2019t resend (invites can be resent once an hour).');
    } else {
      const err = await sendEmailInvite('claim', resource.id, { email: resource.email, role: 'member' });
      if (err) return toastError(err);
    }
    toast(`📧 Claim invite sent to ${resource.email}`);
  }
  return (
    <div className="mb-4 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-950">
      <p><strong>You&apos;re managing {resource.display_name}.</strong> You can update the profile, music, products, media and bookings. Payouts always go to {resource.display_name}.</p>
      {unclaimed && (
        <p className="mt-1">Not claimed yet{resource.status === 'hidden' ? ' (hidden until they claim it)' : ''}. Music sales and donations are held for them until they claim it and connect payouts.{' '}
          <button onClick={resend} className="font-semibold underline">Resend claim invite</button></p>
      )}
    </div>
  );
}

// Owner: add and remove managers (up to 5). A manager sees the list and can leave.
export default function ProfileManagersCard({ resourceId, isOwner, myEmail }: { resourceId: string; isOwner: boolean; myEmail: string }) {
  const [list, setList] = useState<{ email: string; name: string | null; photo: string | null }[]>([]);
  const [email, setEmail] = useState('');
  const [inviteEmail, setInviteEmail] = useState<string | null>(null);
  const [key, setKey] = useState(0);
  const load = useCallback(() => { supabase.rpc('profile_managers', { p_resource_id: resourceId }).then(({ data }) => setList((data ?? []) as { email: string; name: string | null; photo: string | null }[])); }, [resourceId]);
  useEffect(() => { load(); }, [load, key]);
  async function add() {
    const e = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return toastError('Enter their email.');
    const { error } = await supabase.rpc('add_profile_manager', { p_resource_id: resourceId, p_email: e });
    if (error && /No TapIN account/i.test(error.message)) { setInviteEmail(e); return; }
    if (error) return toastError(error.message);
    toast('Manager added'); setEmail(''); load();
  }
  async function remove(em: string) {
    const self = em.toLowerCase() === myEmail.toLowerCase();
    if (!window.confirm(self ? 'Stop managing this profile?' : `Remove ${em} as a manager?`)) return;
    const { error } = await supabase.rpc('remove_profile_manager', { p_resource_id: resourceId, p_email: em });
    if (error) return toastError(error.message);
    if (self) { window.location.href = '/resources/dashboard'; return; }
    toast('Manager removed'); load();
  }
  if (!isOwner && list.length === 0) return null;
  return (
    <section className="mt-6 rounded-[20px] bg-white p-4 shadow-[0_2px_10px_rgba(39,30,110,0.06)]">
      <h2 className="text-[17px] font-extrabold text-gray-900">Managers</h2>
      <p className="mt-0.5 text-xs text-gray-500">Managers can update the profile, music, products and media, and answer bookings. They can&apos;t change payouts, transfer or delete the profile. {isOwner ? 'You\u2019re told when a manager accepts a booking.' : ''}</p>
      {list.length > 0 && (
        <ul className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-200">
          {list.map((m) => (
            <li key={m.email} className="flex items-center gap-3 px-3 py-2">
              {m.photo ? <img src={m.photo} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">{(m.name || m.email).charAt(0).toUpperCase()}</span>}
              <span className="min-w-0 flex-1 truncate text-sm text-gray-900">{m.name || m.email}{m.email.toLowerCase() === myEmail.toLowerCase() ? ' (you)' : ''}</span>
              {(isOwner || m.email.toLowerCase() === myEmail.toLowerCase()) && <button onClick={() => remove(m.email)} className="text-xs font-medium text-red-700">{m.email.toLowerCase() === myEmail.toLowerCase() ? 'Leave' : 'Remove'}</button>}
            </li>
          ))}
        </ul>
      )}
      {isOwner && list.length < 5 && (
        <div className="mt-3 flex gap-2">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Their email" inputMode="email" aria-label="Manager's email" className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-gray-300 px-3 text-base text-gray-900 sm:text-sm" />
          <button onClick={add} className="min-h-[44px] rounded-xl bg-[#0F1B3D] px-4 text-sm font-semibold text-white">Add</button>
        </div>
      )}
      {isOwner && inviteEmail && <InviteByEmailForm kind="manager" targetId={resourceId} email={inviteEmail} role="member" onSent={() => { setInviteEmail(null); setEmail(''); setKey((k) => k + 1); }} onCancel={() => setInviteEmail(null)} />}
      {isOwner && <PendingEmailInvites kind="manager" targetId={resourceId} refreshKey={key} />}
    </section>
  );
}
