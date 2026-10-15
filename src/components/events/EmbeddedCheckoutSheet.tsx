import { useEffect, useRef, useState } from 'react';
import { getStripe } from '../../lib/embeddedCheckout';

// A full-screen panel with Stripe's embedded checkout (white-labeled events). Completing payment returns to
// the event page with ?checkout=success, which shows the usual confirmation.
export default function EmbeddedCheckoutSheet({ clientSecret, title, accent, onClose }: { clientSecret: string; title: string; accent?: string; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let checkout: { mount: (el: HTMLElement) => void; destroy: () => void } | null = null;
    let cancelled = false;
    (async () => {
      const stripe = await getStripe();
      if (!stripe) { setError("Checkout isn't available right now. Please try again."); return; }
      const c = await stripe.initEmbeddedCheckout({ fetchClientSecret: async () => clientSecret });
      if (cancelled) { c.destroy(); return; }
      checkout = c;
      if (box.current) c.mount(box.current);
    })().catch(() => setError("Checkout couldn't load. Please try again."));
    document.body.style.overflow = 'hidden';
    return () => { cancelled = true; checkout?.destroy(); document.body.style.overflow = ''; };
  }, [clientSecret]);
  return (
    <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-black/50 sm:items-center" role="dialog" aria-label="Checkout">
      <div className="flex max-h-[96vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-white sm:rounded-3xl">
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3" style={{ borderTop: `4px solid ${accent || '#0F1B3D'}` }}>
          <p className="min-w-0 truncate text-sm font-semibold text-gray-900">{title}</p>
          <button onClick={onClose} aria-label="Close checkout" className="rounded-lg px-2 py-1 text-xl leading-none text-gray-500 hover:bg-gray-100">×</button>
        </div>
        <div className="min-h-[420px] flex-1 overflow-y-auto p-2">
          {error ? <p className="p-6 text-center text-sm text-red-600">{error}</p> : <div ref={box} />}
        </div>
      </div>
    </div>
  );
}
