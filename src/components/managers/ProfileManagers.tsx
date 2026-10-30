import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { toast, toastError } from '../../lib/toast';
import PendingEmailInvites, { InviteByEmailForm, sendEmailInvite } from '../invites/EmailInvites';

// Profile managers: people who run an artist profile for its owner (everything except payouts, ownership and deleting).
interface Managed { id: string; name: string; photo: string | null; claimed: boolean }

// Profiles you manage (in the Managers section), each opening that profile's dashboard.
export function ProfilesYouManage({ ownId }: { ownId: string | null }) {
  const [list, setList] = useState<Managed[]>([]);
  useEffect(() => { supabase.rpc('my_managed_profiles').then(({ data }) => setList(((data ?? []) as Managed[]).filter((p) => p.id !== ownId))); }, [ownId]);
  return (
    <section className="mt-6 rounded-[20px] bg-white p-4 shadow-[0_2px_10px_rgba(39,30,110,0.06)]">
      <h2 className="text-[17px] font-extrabold text-gray-900">Profiles you manage</h2>
      {list.length === 0 ? <p className="mt-1 text-sm text-gray-600">None yet. Create a profile for an artist you manage or book, or ask an artist to add you as a manager.</p> : (
        <ul className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-200">
          {list.map((p) => (
            <li key={p.id}>
              <Link to={`/resources/dashboard?profile=${p.id}`} className="flex min-h-[52px] items-center gap-3 px-3 py-2">
                {p.photo ? <img src={p.photo} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">{p.name.charAt(0)}</span>}
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-gray-900">{p.name}</span><span className="block text-xs text-gray-500">{p.claimed ? 'Claimed' : 'Not claimed yet'}</span></span>
                <span className="text-indigo-600" aria-hidden="true">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link to="/resources/create-for" className="mt-3 inline-flex min-h-[44px] items-center rounded-full bg-[#0F1B3D] px-4 text-sm font-semibold text-white">➕ Create a profile for someone</Link>
    </section>
  );
}

// Shown when you're managing someone else's profile.
export function ManagingBanner({ resource, myEmail }: { resource: { id: string; display_name: string; email: string; claim_status?: string | null; status?: string | null; created_by_email?: string | null }; myEmail: string }) {
  const unclaimed = resource.claim_status === 'unclaimed';
  // The person who created it can delete it while it's unclaimed.
  const canDelete = unclaimed && (resource.created_by_email ?? '').toLowerCase() === myEmail.toLowerCase();
  async function del() {
    if (!window.confirm(`Delete ${resource.display_name}'s profile? Its music, photos and products are removed, and the claim invite stops working. This can't be undone.`)) return;
    const { error } = await supabase.rpc('delete_unclaimed_profile', { p_resource_id: resource.id });
    if (error) return toastError(error.message);
    toast('Profile deleted');
    window.location.href = '/resources/dashboard#managers';
  }
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
      <p><strong>You&apos;re managing {resource.display_name}.</strong> You can update the profile, music, products, media and bookings. Payouts always go to {resource.display_name}.{' '}<Link to="/resources/dashboard" className="font-semibold underline">Back to your profile</Link></p>
      {unclaimed && (
        <p className="mt-1">Not claimed yet{resource.status === 'hidden' ? ' (hidden until they claim it)' : ''}. Music sales and donations are held for them until they claim it and connect payouts.{' '}
          <button onClick={resend} className="font-semibold underline">Resend claim invite</button>
          {canDelete && <>{' · '}<button onClick={del} className="font-semibold text-red-700 underline">Delete this profile</button></>}</p>
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
