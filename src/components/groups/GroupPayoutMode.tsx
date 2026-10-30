import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { toast, toastError } from '../../lib/toast';

// How an artist group gets paid (one choice for bookings, music and tips): split among members by their shares, or
// one account for the group (the owner's own payout account, or a separate Stripe account connected for the group).
// Only the owner changes it; members see it.
interface Settings { mode: 'split' | 'account'; kind: 'owner' | 'own'; own_connected: boolean; own_ready: boolean; owner_ready: boolean }
export default function GroupPayoutMode({ groupId, isOwner }: { groupId: string; isOwner: boolean }) {
  const [s, setS] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { supabase.rpc('group_payout_settings', { p_group_id: groupId }).then(({ data }) => setS((data ?? null) as Settings | null)); }, [groupId]);
  // Back from Stripe: refresh the group's account status.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('group_payout') === 'return' && isOwner) {
      supabase.functions.invoke('group-stripe-connect', { body: { action: 'refresh', group_id: groupId } }).then(() => load());
      q.delete('group_payout'); window.history.replaceState(null, '', `${window.location.pathname}${q.toString() ? `?${q}` : ''}`);
    } else load();
  }, [groupId, isOwner, load]);
  if (!s) return null;
  async function set(mode: Settings['mode'], kind: Settings['kind']) {
    const { error } = await supabase.rpc('set_group_payout', { p_group_id: groupId, p_mode: mode, p_kind: kind });
    if (error) return toastError(error.message);
    toast(mode === 'split' ? 'Money is split among members by their shares' : kind === 'own' ? 'Money goes to the group\u2019s own account' : 'Money goes to your payout account');
    load();
  }
  async function connect() {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('group-stripe-connect', { body: { action: 'connect', group_id: groupId, returnUrl: `${window.location.origin}${window.location.pathname}?group_payout=return` } });
    setBusy(false);
    const url = (data as { url?: string } | null)?.url;
    if (error || !url) return toastError('Couldn\u2019t open Stripe. Please try again.');
    window.location.href = url;
  }
  async function dashboard() {
    const { data } = await supabase.functions.invoke('group-stripe-connect', { body: { action: 'dashboard', group_id: groupId } });
    const url = (data as { url?: string } | null)?.url;
    if (url) window.open(url, '_blank', 'noopener');
  }
  const opt = (active: boolean) => `flex w-full items-start gap-3 rounded-xl border p-3 text-left ${active ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white'} ${isOwner ? '' : 'cursor-default'}`;
  const dot = (active: boolean) => <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${active ? 'border-indigo-600' : 'border-gray-300'}`}>{active && <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" />}</span>;
  const account = s.mode === 'account';
  return (
    <section className="mt-6 rounded-2xl border border-gray-200 bg-surface p-4 sm:p-5">
      <h2 className="font-display text-lg font-semibold text-bone">How the group gets paid</h2>
      <p className="text-xs text-muted">For bookings, music and tips. {isOwner ? 'Members are told when you change it.' : 'Only the owner can change this.'}</p>
      <div className="mt-3 flex flex-col gap-2" role="radiogroup" aria-label="How the group gets paid">
        <button type="button" role="radio" aria-checked={!account} disabled={!isOwner} onClick={() => set('split', s.kind)} className={opt(!account)}>
          {dot(!account)}<span><span className="block text-sm font-semibold text-gray-900">Split among members</span><span className="block text-xs text-gray-600">Each member is paid their share (set below). For bookings, everyone with a share needs payouts connected.</span></span>
        </button>
        <button type="button" role="radio" aria-checked={account} disabled={!isOwner} onClick={() => set('account', s.kind)} className={opt(account)}>
          {dot(account)}<span><span className="block text-sm font-semibold text-gray-900">One account for the group</span><span className="block text-xs text-gray-600">All money goes to one account, and the group pays members its own way. Organizers can pay as soon as it&apos;s connected.</span></span>
        </button>
      </div>
      {account && (
        <div className="mt-3 rounded-xl border border-indigo-200 bg-white p-3">
          <p className="text-sm font-semibold text-gray-900">Which account?</p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button type="button" disabled={!isOwner} onClick={() => set('account', 'owner')} className={opt(s.kind === 'owner')}>
              {dot(s.kind === 'owner')}<span><span className="block text-sm font-semibold text-gray-900">The owner&apos;s payout account</span><span className={`block text-xs ${s.owner_ready ? 'text-green-700' : 'text-amber-700'}`}>{s.owner_ready ? 'Connected' : 'Not connected yet'}</span></span>
            </button>
            <button type="button" disabled={!isOwner} onClick={() => set('account', 'own')} className={opt(s.kind === 'own')}>
              {dot(s.kind === 'own')}<span><span className="block text-sm font-semibold text-gray-900">A separate account for the group</span><span className={`block text-xs ${s.own_ready ? 'text-green-700' : 'text-amber-700'}`}>{s.own_ready ? 'Connected' : s.own_connected ? 'Setup not finished' : 'Not connected yet'}</span></span>
            </button>
          </div>
          {isOwner && s.kind === 'owner' && !s.owner_ready && <a href="/profile#payouts" className="mt-3 inline-flex min-h-[44px] items-center rounded-full bg-[#0F1B3D] px-4 text-sm font-semibold text-white">Connect your payout account</a>}
          {isOwner && s.kind === 'own' && (
            <div className="mt-3 flex flex-wrap gap-2">
              {!s.own_ready && <button type="button" onClick={connect} disabled={busy} className="min-h-[44px] rounded-full bg-[#0F1B3D] px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Opening Stripe…' : s.own_connected ? 'Finish setting up with Stripe' : 'Connect the group\u2019s account with Stripe'}</button>}
              {s.own_connected && <button type="button" onClick={dashboard} className="min-h-[44px] rounded-full border border-gray-300 px-4 text-sm font-medium text-gray-700">Open the group&apos;s Stripe dashboard</button>}
            </div>
          )}
          <p className="mt-2 text-[11px] text-gray-500">Until the account is connected, music and tips are held for the group, and organizers can&apos;t pay bookings yet.</p>
        </div>
      )}
    </section>
  );
}
