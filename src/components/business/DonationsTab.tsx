import { useCallback, useEffect, useState } from 'react';
import { ListSkeleton } from '../ui/Skeleton';
import Sheet from '../scouting/Sheet';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { MIN_DONATION, money2 } from '../../lib/donations';
import type { TapEvent } from '../../lib/types';

interface Gift { id: string; donor_name: string | null; donor_email: string; amount: number; fee_amount: number; covered_fees: boolean; net_amount: number | null; message: string | null; is_anonymous: boolean; source: string; paid_at: string; payment_status: string; refund_amount: number; refunded_at: string | null }
const field = 'mt-1 block w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900';

// Event dashboard > Donations (nonprofit events): settings, progress, and the gifts list.
export default function DonationsTab({ event, onEventChange }: { event: TapEvent; onEventChange: (e: TapEvent) => void }) {
  const [f, setF] = useState({
    enabled: !!event.donations_enabled, goal: event.donation_goal ? String(event.donation_goal) : '', pitch: event.donation_description ?? '',
    presets: (event.donation_presets ?? [25, 50, 100]).join(', '), min: String(Math.max(MIN_DONATION, Number(event.min_donation_amount) || MIN_DONATION)), show: event.show_donors !== false,
  });
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [giftsLoaded, setGiftsLoaded] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(async () => {
    const { data } = await supabase.rpc('event_donations', { p_event_id: event.id });
    setGifts(((data ?? []) as Gift[]).map((g) => ({ ...g, amount: Number(g.amount), fee_amount: Number(g.fee_amount), net_amount: g.net_amount === null ? null : Number(g.net_amount), refund_amount: Number(g.refund_amount) || 0 }))); setGiftsLoaded(true);
  }, [event.id]);
  useEffect(() => { load(); }, [load]);

  // Refunds come off the totals.
  const kept = gifts.filter((g) => g.payment_status === 'paid');
  const raised = kept.reduce((n, g) => n + g.amount - g.refund_amount, 0);
  const received = kept.reduce((n, g) => n + Math.max(0, (g.net_amount ?? g.amount) - g.refund_amount), 0);
  const [refunding, setRefunding] = useState<Gift | null>(null);
  const word = event.event_kind === 'nonprofit' ? 'gift' : 'contribution';
  const goal = Number(event.donation_goal) || 0;

  async function save() {
    const presets = [...new Set(f.presets.split(/[,\s]+/).map((x) => Math.round(Number(x) * 100) / 100).filter((n) => n >= MIN_DONATION && n <= 100000))].slice(0, 4).sort((a, b) => a - b);
    const min = Math.max(MIN_DONATION, Number(f.min) || MIN_DONATION);
    const goalN = f.goal ? Number(f.goal) : null;
    if (goalN !== null && !(goalN > 0)) return setMsg({ ok: false, text: 'Enter a goal above $0, or leave it blank.' });
    if (presets.length === 0) return setMsg({ ok: false, text: `Add at least one suggested amount of $${MIN_DONATION} or more.` });
    const patch = { donations_enabled: f.enabled, donation_goal: goalN, donation_description: f.pitch.trim() || null, donation_presets: presets, min_donation_amount: min, show_donors: f.show };
    const { error } = await supabase.from('events').update(patch).eq('id', event.id);
    if (error) return setMsg({ ok: false, text: "Couldn't save." });
    onEventChange({ ...event, ...patch });
    setF({ ...f, presets: presets.join(', '), min: String(min) });
    setMsg({ ok: true, text: 'Saved.' }); setTimeout(() => setMsg(null), 2000);
  }
  function csv() {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = gifts.map((g) => [new Date(g.paid_at).toLocaleString(), g.is_anonymous ? 'Anonymous' : g.donor_name ?? '', g.donor_email, g.amount.toFixed(2), g.fee_amount.toFixed(2), g.covered_fees ? 'Donor' : 'Deducted', (g.net_amount ?? g.amount).toFixed(2), g.refund_amount.toFixed(2), g.payment_status === 'refunded' ? 'Refunded' : g.refund_amount > 0 ? 'Partly refunded' : 'Paid', g.source === 'with_tickets' ? 'With tickets' : 'On its own', g.message ?? ''].map(esc).join(','));
    const head = ['Date', 'Name', 'Email', 'Gift', 'Fees', 'Fees paid by', 'You receive', 'Refunded', 'Status', 'Type', 'Message'].map(esc).join(',');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([[head, ...rows].join('\n')], { type: 'text/csv' }));
    a.download = `${event.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-donations.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  }

  return (
    <div className="mt-2 flex flex-col gap-8">
      {/* Progress */}
      <section className="grid grid-cols-3 gap-2 text-center">
        {[[money2(raised), goal ? `raised of ${money2(goal)}` : 'raised'], [String(kept.length), kept.length === 1 ? 'gift' : 'gifts'], [money2(received), 'you receive']].map(([v, l]) => (
          <div key={l} className="rounded-2xl border border-gray-200 bg-surface p-3"><p className="font-display text-lg font-extrabold text-bone sm:text-2xl">{v}</p><p className="text-xs text-muted">{l}</p></div>
        ))}
      </section>
      {goal > 0 && <div className="-mt-6 h-2.5 overflow-hidden rounded-full bg-gray-200"><div className="h-full rounded-full bg-rose-500" style={{ width: `${Math.min(100, Math.round((raised / goal) * 100))}%` }} /></div>}

      {/* Settings */}
      <section className="rounded-2xl border border-gray-200 bg-surface p-4">
        <label className="flex items-start gap-3">
          <input type="checkbox" checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} className="mt-0.5 h-5 w-5 shrink-0 accent-marigold" />
          <span><span className="block font-semibold text-bone">{event.event_kind === 'nonprofit' ? 'Accept donations' : 'Accept support (contributions)'}</span><span className="block text-sm text-muted">{event.event_kind === 'nonprofit' ? 'Shows a donation card on your event page, and lets ticket buyers add a gift to their order.' : 'Shows a "Support this event" card on your event page, and lets ticket buyers add a contribution to their order. Contributions go to you as the organizer; they aren\u2019t tax-deductible donations.'}</span></span>
        </label>
        {f.enabled && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="min-w-0 text-xs font-medium text-gray-500 sm:col-span-2">Why give? (shown on the card)<textarea rows={3} maxLength={1000} className={field} value={f.pitch} onChange={(e) => setF({ ...f, pitch: e.target.value })} placeholder="Every gift funds free arts programs for local youth." /></label>
            <label className="min-w-0 text-xs font-medium text-gray-500">Fundraising goal ($, optional)<input className={field} inputMode="decimal" value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value.replace(/[^0-9.]/g, '') })} placeholder="5000" /></label>
            <label className="min-w-0 text-xs font-medium text-gray-500">Minimum gift ($, at least {MIN_DONATION})<input className={field} inputMode="decimal" value={f.min} onChange={(e) => setF({ ...f, min: e.target.value.replace(/[^0-9.]/g, '') })} /></label>
            <label className="min-w-0 text-xs font-medium text-gray-500 sm:col-span-2">Suggested amounts (up to 4, separated by commas)<input className={field} value={f.presets} onChange={(e) => setF({ ...f, presets: e.target.value })} placeholder="25, 50, 100, 250" /></label>
            <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2"><input type="checkbox" checked={f.show} onChange={(e) => setF({ ...f, show: e.target.checked })} className="h-4 w-4 accent-marigold" /> Show recent supporters on the event page (first names and messages, never amounts)</label>
          </div>
        )}
        <div className="mt-4 flex items-center gap-3">
          <button onClick={save} className="rounded-xl bg-[#0F1B3D] px-5 py-2.5 text-sm font-bold text-white">Save</button>
          {msg && <span className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</span>}
        </div>
        <p className="mt-3 text-xs text-muted">Donors pay the same rates as tickets on their gift (3.7% service + 2.9% processing), plus $0.50 for donations made on their own. "Cover the fees" is checked by default, so most gifts reach you in full. {event.organization_id ? <>Add your EIN to <Link to="/business" className="text-marigold">your organization's profile</Link> to show it on receipts.</> : null}</p>
      </section>

      {/* Gifts */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-lg font-bold text-bone">Gifts</h3>
          {gifts.length > 0 && <button onClick={csv} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700">Download spreadsheet (CSV)</button>}
        </div>
        {gifts.length === 0 ? !giftsLoaded ? <ListSkeleton rows={3} className="mt-3" /> : <p className="mt-2 text-sm text-muted">No gifts yet.</p> : (
          <ul className="mt-3 flex flex-col gap-2">
            {gifts.map((g) => (
              <li key={g.id} className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0"><span className="block truncate font-semibold text-gray-900">{g.is_anonymous ? 'Anonymous' : g.donor_name || g.donor_email}{g.is_anonymous && <span className="ml-1 text-xs font-normal text-gray-400">({g.donor_email})</span>}</span>
                    <span className="block text-xs text-gray-500">{new Date(g.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {g.source === 'with_tickets' ? 'with tickets' : 'donation'} · fees {g.covered_fees ? 'covered by donor' : 'deducted'}</span></span>
                  <span className="shrink-0 text-right">
                    <span className={`block font-bold ${g.payment_status === 'refunded' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{money2(g.amount)}</span>
                    {g.payment_status === 'refunded' ? <span className="text-xs font-semibold text-gray-500">Refunded</span>
                      : g.refund_amount > 0 ? <span className="text-xs text-amber-700">{money2(g.refund_amount)} refunded</span>
                      : <span className="text-xs text-gray-500">you get {money2(g.net_amount ?? g.amount)}</span>}
                  </span>
                </div>
                {g.message && <p className="mt-1.5 text-sm text-gray-700">"{g.message}"</p>}
                {g.payment_status === 'paid' && (
                  <button onClick={() => setRefunding(g)} className="mt-2 text-xs font-medium text-gray-500 hover:text-red-600">Refund…</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      {refunding && <RefundSheet gift={refunding} word={word} onClose={() => setRefunding(null)} onDone={() => { setRefunding(null); load(); }} />}
    </div>
  );
}

function RefundSheet({ gift, word, onClose, onDone }: { gift: Gift; word: string; onClose: () => void; onDone: () => void }) {
  const remaining = Math.round((gift.amount - gift.refund_amount) * 100) / 100;
  const [amount, setAmount] = useState(String(remaining));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const value = Number(amount);
  const ok = Number.isFinite(value) && value > 0 && value <= remaining;
  async function refund() {
    setBusy(true); setErr(null);
    const { data, error } = await supabase.functions.invoke('refund-donation', { body: { donation_id: gift.id, amount: value } });
    setBusy(false);
    if (error || !data?.success) {
      let msg = "Couldn't issue the refund. Please try again.";
      try { const j = await (error as { context?: Response })?.context?.json(); if (j?.error) msg = j.error; } catch { /* default */ }
      return setErr(msg);
    }
    onDone();
  }
  return (
    <Sheet title={`Refund this ${word}?`} onClose={onClose}>
      <p className="-mt-2 text-sm text-gray-600">{gift.is_anonymous ? 'An anonymous supporter' : gift.donor_name || gift.donor_email} gave {money2(gift.amount)}{gift.refund_amount > 0 ? ` (${money2(gift.refund_amount)} already refunded)` : ''}. The money goes back to their card in 5–10 days, and they're notified.</p>
      <label className="mt-3 block text-xs font-medium text-gray-500">Amount to refund (up to {money2(remaining)})
        <div className="mt-1 flex items-center rounded-xl border border-gray-300 bg-white px-3">
          <span className="text-gray-500">$</span>
          <input value={amount} inputMode="decimal" onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} className="min-w-0 flex-1 bg-transparent px-1 py-2.5 text-base text-gray-900 outline-none" />
        </div>
      </label>
      <p className="mt-2 text-xs text-gray-500">Service and processing fees aren't refunded, the same as tickets. The refunded amount comes back out of your payout.</p>
      {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
      <button onClick={refund} disabled={busy || !ok} className="mt-4 w-full rounded-xl bg-red-600 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Refunding…' : ok ? `Refund ${money2(value)}` : 'Enter an amount'}</button>
    </Sheet>
  );
}
