import { useEffect, useState } from 'react';
import { toast, toastError } from '../../lib/toast';
import { supabase } from '../../lib/supabaseClient';

interface Status { connected: boolean; charges_enabled: boolean; payouts_enabled: boolean; details_submitted: boolean; linked_email?: string | null; linked_name?: string | null; linked_is_me?: boolean; is_owner?: boolean; my_account_ready?: boolean }

// Organization > Payouts (Owners and Admins): connect the organization's own bank account through Stripe.
// Once it can take payments, money from the organization's events goes here instead of the event creator's account.
export default function OrgPayoutsTab({ orgId, orgName, slug }: { orgId: string; orgName: string; slug: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const call = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('org-stripe-connect', { body: { org_id: orgId, ...body } });
    if (error) {
      let msg = "Couldn't reach Stripe. Please try again.";
      try { const j = await (error as { context?: Response })?.context?.json(); if (j?.error) msg = j.error; } catch { /* default */ }
      throw new Error(msg);
    }
    return data;
  };
  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc('org_payout_status', { p_org_id: orgId });
      const s = data as Status | null;
      setStatus(s);
      // Back from Stripe, or still finishing setup: refresh from Stripe.
      if (s?.connected && !s.charges_enabled && !s.linked_email) {
        try { setStatus(await call({ action: 'refresh' })); } catch { /* keep saved status */ }
      }
    })();
  }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function connect() {
    setBusy(true); setErr(null);
    try {
      const d = await call({ action: 'connect', returnUrl: `${window.location.origin}${import.meta.env.BASE_URL}business/${slug}/manage?tab=Payouts` });
      if (d?.url) window.location.href = d.url;
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  async function linkMine() {
    if (!window.confirm(`Use your own TapIN payout account for ${orgName}?\n\nMoney from all of ${orgName}'s events (tickets, donations, vendor fees and event merch) will go to your account, and Stripe reports it under your name and tax info. For a registered business with its own tax ID, a separate account is better.\n\nYou can switch to a separate account anytime.`)) return;
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc('link_owner_payout_account', { p_org_id: orgId });
    if (error) toastError("Couldn't link payouts."); else toast('✓ Payouts linked');
    if (error) { setBusy(false); return setErr(error.message && !/function|permission/i.test(error.message) ? error.message : "Couldn't link your account."); }
    const { data } = await supabase.rpc('org_payout_status', { p_org_id: orgId });
    setStatus(data as Status | null); setBusy(false);
  }
  async function unlink(thenConnect: boolean) {
    if (!window.confirm(thenConnect ? `Switch ${orgName} to its own separate payout account? You'll set it up with Stripe next. New payments go to each event's creator until it's ready.` : `Stop using ${status?.linked_is_me ? 'your' : 'this'} account for ${orgName}? New payments go to each event's creator until the organization connects an account.`)) return;
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc('unlink_owner_payout_account', { p_org_id: orgId });
    if (error) toastError("Couldn't unlink payouts."); else toast('Payouts unlinked');
    if (error) { setBusy(false); return setErr("Couldn't change the payout account."); }
    if (thenConnect) return connect();
    const { data } = await supabase.rpc('org_payout_status', { p_org_id: orgId });
    setStatus(data as Status | null); setBusy(false);
  }
  async function dashboard() {
    setBusy(true); setErr(null);
    try { const d = await call({ action: 'dashboard' }); if (d?.url) window.open(d.url, '_blank', 'noopener'); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }

  const ready = !!status?.charges_enabled;
  const linked = !!status?.linked_email;
  if (linked && status) return (
    <div className="flex flex-col gap-4">
      <div className={`rounded-2xl border p-4 ${ready ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
        <p className="font-semibold text-bone">{ready ? '✅' : '⚠️'} Paid to {status.linked_is_me ? 'your' : `${status.linked_name || status.linked_email}'s`} TapIN payout account</p>
        <p className="mt-1 text-sm text-muted">{ready
          ? `Money from all of ${orgName}'s events (tickets, donations, vendor fees and event merch) goes to ${status.linked_is_me ? 'your' : 'the Owner\u2019s'} personal payout account, no matter who on the team created the event.`
          : `That payout account can't take payments right now, so new payments go to each event's creator until it's fixed${status.linked_is_me ? ' (check Earnings > Payouts)' : ''}.`}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {status.is_owner && <button onClick={() => unlink(true)} disabled={busy} className="rounded-xl bg-[#635BFF] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Switch to a separate account</button>}
          {(status.is_owner || status.linked_is_me) && <button onClick={() => unlink(false)} disabled={busy} className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700">Stop using {status.linked_is_me ? 'my' : 'this'} account</button>}
        </div>
        {err && <p role="alert" className="mt-2 text-sm text-red-600">{err}</p>}
      </div>
      <p className="text-xs text-muted">Stripe reports these payments under the account holder's name and tax info. Organizations with their own business bank account and tax ID should use a separate account.</p>
    </div>
  );
  return (
    <div className="flex flex-col gap-4">
      <div className={`rounded-2xl border p-4 ${ready ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-surface'}`}>
        <p className="font-semibold text-bone">{ready ? `✅ ${orgName} is getting paid directly` : status?.connected ? '⏳ Finish setting up payouts' : `Get paid as ${orgName}`}</p>
        <p className="mt-1 text-sm text-muted">
          {ready
            ? `Money from ${orgName}'s events (tickets, donations, vendor fees and event merch) now goes to the organization's own bank account, not the person who created the event.`
            : status?.connected
              ? 'Stripe needs a few more details before the organization can take payments. Until then, event money keeps going to each event creator.'
              : `Connect ${orgName}'s own bank account through Stripe, so money from its events goes to the organization instead of the person who created each event.`}
        </p>
        {status?.connected && !status.payouts_enabled && ready && <p className="mt-2 text-sm text-amber-800">Payments are on, but Stripe still needs details before it can send money to the bank.</p>}
        {!ready && !status?.connected && status?.is_owner && status.my_account_ready && (
          <div className="mt-3 rounded-xl border border-indigo-200 bg-white p-3">
            <p className="text-sm font-semibold text-gray-900">Already get paid on TapIN?</p>
            <p className="text-xs text-gray-600">Use your existing payout account for {orgName}, with no new Stripe setup. Best for community groups without a separate business bank account.</p>
            <button onClick={linkMine} disabled={busy} className="mt-2 rounded-xl bg-marigold px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Use my TapIN payout account</button>
          </div>
        )}
        {!ready && !status?.connected && !status?.is_owner && <p className="mt-2 text-xs text-muted">The Owner can also link their own TapIN payout account instead of setting up a new one.</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {!ready && <button onClick={connect} disabled={busy || status === null} className="rounded-xl bg-[#635BFF] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Opening Stripe…' : status?.connected ? 'Continue setup with Stripe' : `Connect a separate account for ${orgName}`}</button>}
          {status?.connected && <button onClick={dashboard} disabled={busy} className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700">Open Stripe dashboard</button>}
        </div>
        {err && <p role="alert" className="mt-2 text-sm text-red-600">{err}</p>}
      </div>
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
        <li>Use the organization's business or nonprofit bank account and details.</li>
        <li>Events created before connecting are covered too; only new payments go to the organization.</li>
        <li>Buyer fees work the same as always. Refunds come back out of the organization's balance.</li>
        <li>Splitting event money by percentage with partners is coming with the Business plan.</li>
      </ul>
    </div>
  );
}
