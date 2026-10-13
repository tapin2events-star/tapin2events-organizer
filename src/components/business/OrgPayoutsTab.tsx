import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

interface Status { connected: boolean; charges_enabled: boolean; payouts_enabled: boolean; details_submitted: boolean }

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
      if (s?.connected && !s.charges_enabled) {
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
  async function dashboard() {
    setBusy(true); setErr(null);
    try { const d = await call({ action: 'dashboard' }); if (d?.url) window.open(d.url, '_blank', 'noopener'); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }

  const ready = !!status?.charges_enabled;
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
        <div className="mt-3 flex flex-wrap gap-2">
          {!ready && <button onClick={connect} disabled={busy || status === null} className="rounded-xl bg-[#635BFF] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Opening Stripe…' : status?.connected ? 'Continue setup with Stripe' : 'Connect with Stripe'}</button>}
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
