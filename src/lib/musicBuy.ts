import { supabase } from './supabaseClient';
import { isNativeApp } from './displayMode';
import { openInBrowser } from './externalLink';

// Buying music.
//  - In the phone app (Apple's rules for digital content): the purchase continues on the web, signed in, with a
//    one-time handoff pass (app-handoff). If the pass can't be made, the web page opens anyway (guest checkout).
//  - On the web: checkout starts right away; not signed in -> guest checkout (Stripe collects the email, and the
//    purchase attaches to it).
export const money = (n: number) => `$${Number(n).toFixed(2)}`;
export const musicPrice = (price: number) => { const c = Math.round(price * 100); return { price, service: (Math.round(c * 0.037) + 179) / 100, processing: Math.round(c * 0.029) / 100, total: (c + Math.round(c * 0.037) + 179 + Math.round(c * 0.029)) / 100 }; };

export async function buyMusic(kind: 'album' | 'track', id: string, pagePath: string): Promise<string | null> {
  const next = `${pagePath}${pagePath.includes('?') ? '&' : '?'}buy=${kind}:${id}`;
  if (isNativeApp()) {
    const { data: s } = await supabase.auth.getSession();
    if (s.session) {
      const { data } = await supabase.functions.invoke('app-handoff', { body: { action: 'create', next } });
      const url = (data as { url?: string } | null)?.url;
      if (url) { openInBrowser(url); return null; }
    }
    openInBrowser(`https://app.tapin2events.com${next}`);
    return null;
  }
  const back = `${window.location.origin}${pagePath}`;
  const { data, error } = await supabase.functions.invoke('create-music-checkout', { body: { kind, id, successUrl: `${window.location.origin}/my-music?purchased=1`, cancelUrl: back } });
  const url = (data as { url?: string; error?: string } | null)?.url;
  if (error || !url) return (data as { error?: string } | null)?.error ?? 'Couldn\u2019t start checkout. Please try again.';
  window.location.href = url;
  return null;
}
