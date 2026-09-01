import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function PayoutsCard({
  hasAccount,
  chargesEnabled,
}: {
  hasAccount: boolean;
  chargesEnabled: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    setBusy(true);
    setError(null);
    const returnUrl = window.location.href;
    const { data, error: fnError } = await supabase.functions.invoke('create-stripe-connect-account', {
      body: { returnUrl },
    });
    setBusy(false);
    if (fnError || !data?.url) {
      setError('Something went wrong. Please try again.');
      return;
    }
    window.location.href = data.url;
  }

  if (chargesEnabled) {
    return (
      <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
        ✓ Payouts are set up — ticket sales for your events go straight to your bank account.
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-gray-200 bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-bone">
            {hasAccount ? 'Finish setting up payouts' : 'Get paid for your paid events'}
          </p>
          <p className="text-xs text-muted">
            {hasAccount
              ? 'Your Stripe setup is incomplete — finish it to start receiving ticket sales directly.'
              : 'Connect a bank account so ticket sales for your paid events are deposited directly to you.'}
          </p>
        </div>
        <button
          onClick={handleConnect}
          disabled={busy}
          className="shrink-0 rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-ink hover:bg-marigold/90 disabled:opacity-50"
        >
          {busy ? 'Please wait…' : hasAccount ? 'Finish setup' : 'Connect with Stripe'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-magenta">{error}</p>}
    </div>
  );
}
