import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import type { TierAvail } from '../../lib/tiers';

const money = (n: number) => `$${n.toFixed(2).replace(/\.00$/, '')}`;

// The ticket chooser for events with tiers: pick how many of each, see the total, then
// check out (paid) or register (all free).
export default function TierPicker({ eventId, tiers, disabledReason, onRegistered, accent }: {
  eventId: string; tiers: TierAvail[]; disabledReason?: string | null; onRegistered: (ticketId: string) => void; accent?: string;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chosen = tiers.filter((t) => (qty[t.id] ?? 0) > 0);
  const count = chosen.reduce((n, t) => n + qty[t.id], 0);
  const subtotal = chosen.reduce((n, t) => n + Number(t.price) * qty[t.id], 0);
  const paidCount = chosen.filter((t) => Number(t.price) > 0).reduce((n, t) => n + qty[t.id], 0);
  // Same fees as checkout: 3.7% + $1.79 per paid ticket, plus 2.9% processing.
  const fees = paidCount ? Math.round(subtotal * 100 * 0.037 + 179 * paidCount + subtotal * 100 * 0.029) / 100 : 0;
  const allFree = chosen.length > 0 && chosen.every((t) => Number(t.price) === 0);
  const anyOnSale = useMemo(() => tiers.some((t) => t.status === 'on_sale'), [tiers]);

  function step(t: TierAvail, d: number) {
    const max = Math.min(t.max_per_order, t.remaining ?? t.max_per_order);
    setQty((q) => ({ ...q, [t.id]: Math.max(0, Math.min(max, (q[t.id] ?? 0) + d)) }));
    setError(null);
  }

  async function go() {
    if (!user) { navigate('/login', { state: { from: location.pathname } }); return; }
    const items = chosen.map((t) => ({ tier_id: t.id, qty: qty[t.id] }));
    setBusy(true); setError(null);
    if (allFree) {
      const { data, error: err } = await supabase.rpc('register_free_tiers', { p_event_id: eventId, p_items: items });
      setBusy(false);
      if (err || !data) return setError(err?.message && !/function|permission/i.test(err.message) ? err.message : "Couldn't register. Please try again.");
      supabase.functions.invoke('send-app-email', { body: { kind: 'registration_confirmation', ticket_id: data } }).catch(() => {});
      setQty({});
      onRegistered(data as string);
      return;
    }
    const base = window.location.origin + import.meta.env.BASE_URL;
    const { data, error: err } = await supabase.functions.invoke('create-tier-checkout', {
      body: { event_id: eventId, items, successUrl: `${base}events/${eventId}?checkout=success`, cancelUrl: `${base}events/${eventId}?checkout=cancelled` },
    });
    setBusy(false);
    if (err || !data?.url) {
      let msg = "Couldn't start checkout. Please try again.";
      try { const j = await (err as { context?: Response })?.context?.json(); if (j?.error) msg = j.error; } catch { /* keep default */ }
      if (data?.error) msg = data.error;
      return setError(msg);
    }
    window.location.href = data.url;
  }

  const statusText = (t: TierAvail) => {
    if (t.status === 'sold_out') return 'Sold out';
    if (t.status === 'not_started') return t.sales_start ? `On sale ${new Date(t.sales_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'Not on sale yet';
    if (t.status === 'ended') return 'Sales ended';
    if (t.sales_end) {
      const hrs = (new Date(t.sales_end).getTime() - Date.now()) / 3600000;
      if (hrs < 72) return `Ends ${new Date(t.sales_end).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }).replace(':00 ', ' ')}`;
    }
    if (t.remaining !== null && t.remaining <= 10) return `Only ${t.remaining} left`;
    return null;
  };
  const btnColor = accent ? { background: accent, color: '#111827' } : undefined;

  return (
    <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
      <p className="font-display text-lg font-bold text-gray-900">Tickets</p>
      <ul className="mt-3 divide-y divide-gray-100">
        {tiers.map((t) => {
          const n = qty[t.id] ?? 0;
          const on = t.status === 'on_sale' && !disabledReason;
          const note = statusText(t);
          const max = Math.min(t.max_per_order, t.remaining ?? t.max_per_order);
          return (
            <li key={t.id} className={`flex items-center gap-3 py-3 ${on ? '' : 'opacity-60'}`}>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900">{t.name}</p>
                <p className="text-sm text-gray-700">{Number(t.price) > 0 ? money(Number(t.price)) : 'Free'}{note && <span className={`ml-2 text-xs font-medium ${t.status === 'on_sale' ? 'text-amber-700' : 'text-gray-500'}`}>{note}</span>}</p>
                {t.description && <p className="mt-0.5 text-xs text-gray-500">{t.description}</p>}
              </div>
              {on ? (
                <div className="flex shrink-0 items-center gap-2">
                  <button type="button" onClick={() => step(t, -1)} disabled={n === 0} aria-label={`Fewer ${t.name}`} className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 text-lg text-gray-700 disabled:opacity-30">−</button>
                  <span className="w-6 text-center font-semibold text-gray-900" aria-live="polite">{n}</span>
                  <button type="button" onClick={() => step(t, 1)} disabled={n >= max} aria-label={`More ${t.name}`} className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 text-lg text-gray-700 disabled:opacity-30">+</button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {count > 0 && (
        <div className="mt-2 border-t border-gray-100 pt-3 text-sm text-gray-600">
          <div className="flex justify-between"><span>{count} ticket{count === 1 ? '' : 's'}</span><span>{subtotal > 0 ? money(subtotal) : 'Free'}</span></div>
          {fees > 0 && <div className="flex justify-between text-xs text-gray-500"><span>Service & processing fees</span><span>{money(fees)}</span></div>}
          {subtotal > 0 && <div className="mt-1 flex justify-between font-semibold text-gray-900"><span>Total</span><span>{money(subtotal + fees)}</span></div>}
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-magenta">{error}</p>}
      <button type="button" onClick={go} disabled={busy || count === 0 || !!disabledReason || !anyOnSale}
        className={`mt-3 w-full rounded-xl px-5 py-3 text-sm font-bold disabled:opacity-50 ${btnColor ? '' : 'bg-gradient-to-r from-marigold to-teal text-white'}`} style={btnColor}>
        {disabledReason ? disabledReason : busy ? 'Please wait…' : !user ? 'Sign in to continue' : count === 0 ? 'Choose tickets' : allFree ? `Register${count > 1 ? ` (${count})` : ''}` : `Checkout · ${money(subtotal + fees)}`}
      </button>
      {!user && <p className="mt-2 text-center text-xs text-gray-500">Already have an account? <Link to="/login" className="text-marigold">Sign in</Link></p>}
    </div>
  );
}
