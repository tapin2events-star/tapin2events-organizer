import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { donationFee, loadDonationSummary, MIN_DONATION, money0, money2, type DonationSummary } from '../../lib/donations';
import type { TapEvent } from '../../lib/types';

// Donation card for nonprofit events: goal progress, amount, "cover the fees", donor wall.
export default function DonationCard({ event, recipient, accent }: { event: TapEvent; recipient: string; accent?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const presets = ((event as { donation_presets?: number[] }).donation_presets ?? [25, 50, 100]).map(Number).filter((n) => n >= MIN_DONATION).slice(0, 4);
  const min = Math.max(MIN_DONATION, Number((event as { min_donation_amount?: number }).min_donation_amount) || 0);
  const [summary, setSummary] = useState<DonationSummary | null>(null);
  const [amount, setAmount] = useState<number | null>(presets[1] ?? presets[0] ?? 25);
  const [custom, setCustom] = useState('');
  const [cover, setCover] = useState(true);
  const [message, setMessage] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const thanks = new URLSearchParams(location.search).get('donation') === 'thanks';
  useEffect(() => { loadDonationSummary(event.id).then(setSummary); }, [event.id, thanks]);

  const value = custom ? Number(custom) : amount ?? 0;
  const fee = value >= min ? donationFee(value, false) : 0;
  const total = cover ? value + fee : value;
  const pct = summary?.goal ? Math.min(100, Math.round((summary.raised / summary.goal) * 100)) : 0;
  const color = accent || '#E11D48';

  async function donate() {
    if (!user) { navigate('/login', { state: { from: location.pathname } }); return; }
    if (!Number.isFinite(value) || value < min) return setError(`The minimum donation is ${money0(min)}.`);
    setBusy(true); setError(null);
    const base = window.location.origin + import.meta.env.BASE_URL;
    const { data, error: err } = await supabase.functions.invoke('create-donation-checkout', {
      body: { event_id: event.id, amount: Math.round(value * 100) / 100, cover_fees: cover, message: message.trim() || null, anonymous,
        successUrl: `${base}events/${event.id}?donation=thanks`, cancelUrl: `${base}events/${event.id}` },
    });
    setBusy(false);
    if (err || !data?.url) {
      let msg = "Couldn't start your donation. Please try again.";
      try { const j = await (err as { context?: Response })?.context?.json(); if (j?.error) msg = j.error; } catch { /* default */ }
      return setError(msg);
    }
    window.location.href = data.url;
  }

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <div className="p-4 sm:p-5">
        <p className="font-display text-lg font-bold text-gray-900">💛 Support {recipient}</p>
        {event.donation_description && <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{event.donation_description}</p>}
        {thanks && <p role="status" className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-800">Thank you for your gift! A receipt is on its way to your email.</p>}

        {summary && (summary.goal || summary.count > 0) && (
          <div className="mt-4">
            <div className="flex items-end justify-between text-sm">
              <span><strong className="text-xl text-gray-900">{money0(summary.raised)}</strong> <span className="text-gray-500">raised{summary.goal ? ` of ${money0(summary.goal)}` : ''}</span></span>
              <span className="text-xs text-gray-500">{summary.count} gift{summary.count === 1 ? '' : 's'}</span>
            </div>
            {summary.goal ? <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} /></div> : null}
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {presets.map((p) => (
            <button key={p} type="button" onClick={() => { setAmount(p); setCustom(''); setError(null); }} aria-pressed={!custom && amount === p}
              className={`min-h-[48px] rounded-xl border text-base font-semibold ${!custom && amount === p ? 'border-transparent text-white' : 'border-gray-300 bg-white text-gray-800'}`}
              style={!custom && amount === p ? { background: color } : undefined}>{money0(p)}</button>
          ))}
        </div>
        <label className="mt-2 flex min-h-[48px] items-center rounded-xl border border-gray-300 bg-white px-3 focus-within:border-gray-500">
          <span className="text-gray-500">$</span>
          <input value={custom} inputMode="decimal" onChange={(e) => { setCustom(e.target.value.replace(/[^0-9.]/g, '')); setError(null); }} placeholder={`Other amount (${money0(min)} minimum)`} aria-label="Other amount" className="min-w-0 flex-1 bg-transparent px-1 py-2 text-base text-gray-900 outline-none" />
        </label>

        <label className="mt-3 flex items-start gap-3 rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
          <input type="checkbox" checked={cover} onChange={(e) => setCover(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-marigold" />
          <span>Cover the fees{value >= min ? ` (${money2(fee)})` : ''} so 100% of my gift goes to {recipient}
            {!cover && value >= min && <span className="block text-xs text-gray-500">{recipient} will receive {money2(value - fee)}.</span>}</span>
        </label>
        <input value={message} maxLength={300} onChange={(e) => setMessage(e.target.value)} placeholder="Add a message (optional)" className="mt-2 block w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900" />
        <label className="mt-2 flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="h-4 w-4 accent-marigold" /> Give anonymously</label>

        {error && <p role="alert" className="mt-2 text-sm text-magenta">{error}</p>}
        <button type="button" onClick={donate} disabled={busy || !(value >= min)} className="mt-3 w-full rounded-xl py-3.5 text-base font-bold text-white disabled:opacity-50" style={{ background: color }}>
          {busy ? 'Please wait…' : !user ? 'Sign in to donate' : value >= min ? `Donate ${money2(total)}` : 'Choose an amount'}
        </button>
        <p className="mt-2 text-center text-[11px] text-gray-400">Secure payment by Stripe. You'll get an emailed receipt.</p>
      </div>
      {summary && summary.donors.length > 0 && (
        <div className="border-t border-gray-100 bg-gray-50/60 px-4 py-3 sm:px-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Recent supporters</p>
          <ul className="mt-2 flex flex-col gap-2">
            {summary.donors.slice(0, 6).map((d, i) => (
              <li key={i} className="text-sm"><span className="font-medium text-gray-900">{d.name}</span>{d.message ? <span className="text-gray-600">: "{d.message}"</span> : null}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
