import type { Stripe } from '@stripe/stripe-js';
import { supabase } from './supabaseClient';

// Embedded Stripe checkout for white-labeled events: the payment form opens inside the branded event page.
// Needs Stripe's publishable key (set by an admin); without it, checkout falls back to Stripe's own page.
let stripePromise: Promise<Stripe | null> | null = null;
let keyChecked: Promise<string | null> | null = null;
export function publishableKey() {
  keyChecked ??= (async () => { try { const { data } = await supabase.rpc('stripe_publishable_key'); return typeof data === 'string' && data ? data : null; } catch { return null; } })();
  return keyChecked;
}
export async function getStripe() {
  const key = await publishableKey();
  if (!key) return null;
  stripePromise ??= import('@stripe/stripe-js').then(({ loadStripe }) => loadStripe(key));
  return stripePromise;
}
