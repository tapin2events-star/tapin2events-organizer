import { supabase } from './supabaseClient';
import { isNativeApp } from './displayMode';
import { openInBrowser } from './externalLink';

// Buying music. Inside the phone app, the purchase opens on the web (Apple's rules for digital content), on the same
// page with ?buy=<kind>:<id>, which starts checkout there. On the web, checkout starts right away.
export const money = (n: number) => `$${Number(n).toFixed(2)}`;
export const musicPrice = (price: number) => { const c = Math.round(price * 100); return { price, service: (Math.round(c * 0.037) + 179) / 100, processing: Math.round(c * 0.029) / 100, total: (c + Math.round(c * 0.037) + 179 + Math.round(c * 0.029)) / 100 }; };

export async function buyMusic(kind: 'album' | 'track', id: string, pagePath: string): Promise<string | null> {
  const web = `https://app.tapin2events.com${pagePath}`;
  if (isNativeApp()) { openInBrowser(`${web}${pagePath.includes('?') ? '&' : '?'}buy=${kind}:${id}`); return null; }
  const back = `${window.location.origin}${pagePath}`;
  const { data, error } = await supabase.functions.invoke('create-music-checkout', { body: { kind, id, successUrl: `${window.location.origin}/my-music?purchased=1`, cancelUrl: back } });
  const url = (data as { url?: string; error?: string } | null)?.url;
  if (error || !url) return (data as { error?: string } | null)?.error ?? 'Couldn\u2019t start checkout. Please try again.';
  window.location.href = url;
  return null;
}
