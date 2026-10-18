import { useCallback, useEffect, useState } from 'react';
import FeatureFeedback from '../feedback/FeatureFeedback';
import { supabase } from '../../lib/supabaseClient';

interface Boost { id: string; days: number; price: number; fee: number; starts_at: string; ends_at: string; status: string; refund_amount: number | null; impressions: number; visits: number; tickets: number }
const PACKAGES = [{ days: 3, price: 15 }, { days: 7, price: 29, best: true }, { days: 14, price: 49 }];
const fee = (price: number) => Math.round((price * 0.029 + 0.3) * 100) / 100;
const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// Event > Promote > Boost (Preview): pay to show the event in Discover's Promoted row nearby.
export default function BoostCard({ eventId }: { eventId: string }) {
  const [ev, setEv] = useState<{ status: string; start_date: string | null; end_date: string | null; is_test: boolean } | null>(null);
  const [boosts, setBoosts] = useState<Boost[]>([]);
  const [days, setDays] = useState(7);
  const [start, setStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [credit, setCredit] = useState<{ amount: number; available: number; plan: string | null; resets?: string } | null>(null);
  const load = useCallback(async () => {
    supabase.rpc('boost_credit_status', { p_event_id: eventId }).then(({ data }) => setCredit((data ?? null) as typeof credit));
    const [{ data: e }, { data: b }] = await Promise.all([
      supabase.from('events').select('status, start_date, end_date, is_test').eq('id', eventId).maybeSingle(),
      supabase.rpc('event_boosts_for', { p_event_id: eventId }),
    ]);
    setEv(e as typeof ev);
    setBoosts(((b ?? []) as Boost[]).map((x) => ({ ...x, price: Number(x.price), fee: Number(x.fee), visits: Number(x.visits), tickets: Number(x.tickets) })));
  }, [eventId]);
  useEffect(() => { load(); }, [load]);
  // Back from Stripe: confirm right away.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('boost');
    if (!id) return;
    supabase.functions.invoke('boost-manage', { body: { action: 'refresh', boost_id: id } }).then(({ data }) => {
      if (data?.status === 'paid') setMsg({ ok: true, text: '🚀 Your boost is booked! It shows in Discover\u2019s Promoted row on its start date.' });
      load();
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function buy() {
    setBusy(true); setMsg(null);
    const { data, error } = await supabase.functions.invoke('boost-manage', { body: { action: 'create', event_id: eventId, days, start_date: start, returnBase: `${window.location.origin}${import.meta.env.BASE_URL}` } });
    if (!error && data?.activated) {
      setBusy(false);
      setMsg({ ok: true, text: `🎉 Boost started with your Boost credit, no payment needed. ${new Date(`${start}T12:00:00`).getTime() <= Date.now() + 86400000 ? 'It\u2019s live in Discover now.' : 'It starts on your chosen date.'}` });
      return load();
    }
    if (error || !data?.url) {
      let m = "Couldn't start the boost.";
      try { const j = await (error as { context?: Response })?.context?.json(); if (j?.error) m = j.error; } catch { /* default */ }
      setBusy(false); return setMsg({ ok: false, text: m });
    }
    window.location.href = data.url;
  }

  if (!ev) return null;
  const end = Date.parse(ev.end_date || ev.start_date || '');
  const canBoost = ev.status === 'published' && !ev.is_test && Number.isFinite(end) && end > Date.now();
  const pkg = PACKAGES.find((p) => p.days === days)!;
  const applied = Math.min(pkg.price, Math.max(0, Number(credit?.available ?? 0)));
  const due = Math.round((pkg.price - applied) * 100) / 100;
  const now = Date.now();
  const shown = boosts.filter((b) => b.status !== 'pending');
  return (
    <section className="mb-8 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-teal-50 p-4">
      <p className="flex items-center gap-2 font-display text-lg font-bold text-bone">🚀 Boost this event <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-600">Pay per boost</span></p>
      <p className="text-sm text-muted">Show it in the <strong>Promoted</strong> row at the top of Discover for people nearby, and first in matching searches. Up to 6 events are promoted at once in an area.</p>
      {msg && <p role="status" className={`mt-3 rounded-xl px-3 py-2 text-sm ${msg.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{msg.text}</p>}
      {!canBoost ? (
        <p className="mt-3 text-sm text-muted">{ev.is_test ? 'Test events can\u2019t be boosted.' : ev.status !== 'published' ? 'Publish the event to boost it.' : 'This event has already happened.'}</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {PACKAGES.map((p) => (
              <button key={p.days} type="button" onClick={() => setDays(p.days)} aria-pressed={days === p.days}
                className={`relative rounded-2xl border p-3 text-center ${days === p.days ? 'border-marigold bg-white ring-2 ring-marigold/30' : 'border-gray-200 bg-white/70'}`}>
                {p.best && <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-marigold px-2 py-0.5 text-[10px] font-bold uppercase text-white">Popular</span>}
                <span className="block text-lg font-extrabold text-gray-900">${p.price}</span>
                <span className="block text-xs text-gray-600">{p.days} days</span>
              </button>
            ))}
          </div>
          <label className="mt-3 block text-xs font-medium text-gray-500">Start
            <input type="date" value={start} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setStart(e.target.value)} className="mt-1 block h-12 w-full appearance-none rounded-xl border border-gray-300 bg-white px-3 text-base text-gray-900" />
          </label>
          {credit && credit.amount > 0 && (
            <p className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">🎁 <strong>${Number(credit.available).toFixed(0)} Boost credit</strong> left this month with your {credit.plan} (${credit.amount}/month{credit.resets ? `, resets ${credit.resets}` : ''}). It's applied automatically.</p>
          )}
          <div className="mt-3 space-y-1 rounded-xl bg-white/80 p-3 text-sm">
            <div className="flex justify-between text-gray-700"><span>Boost, {pkg.days} days</span><span>${pkg.price.toFixed(2)}</span></div>
            {applied > 0 && <div className="flex justify-between text-green-700"><span>Boost credit</span><span>−${applied.toFixed(2)}</span></div>}
            {due > 0 && <div className="flex justify-between text-gray-700"><span>Processing fee</span><span>${fee(due).toFixed(2)}</span></div>}
            <div className="flex justify-between border-t border-gray-200 pt-1 font-bold text-gray-900"><span>Total</span><span>{due > 0 ? `$${(due + fee(due)).toFixed(2)}` : 'Free with credit'}</span></div>
            <p className="text-xs text-gray-500">If the event is cancelled, unused days are refunded. The processing fee isn't refundable.</p>
          </div>
          <button onClick={buy} disabled={busy} className="mt-3 w-full rounded-xl bg-marigold py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? (due > 0 ? 'Opening checkout…' : 'Starting…') : due > 0 ? `Boost for ${pkg.days} days` : `Boost for ${pkg.days} days with credit`}</button>
        </>
      )}
      {shown.some((b) => b.status === 'paid' || b.status === 'refunded') && <FeatureFeedback feature="boost" label="Boost" className="mt-4" />}
      {shown.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {shown.map((b) => {
            const live = b.status === 'paid' && now >= Date.parse(b.starts_at) && now < Date.parse(b.ends_at);
            const label = b.status === 'refunded' ? `Refunded $${Number(b.refund_amount ?? 0).toFixed(2)}` : b.status === 'refund_due' ? 'Refund on the way' : live ? 'Live' : now < Date.parse(b.starts_at) ? 'Scheduled' : 'Ended';
            return (
              <li key={b.id} className="rounded-xl border border-gray-200 bg-white p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-gray-900">{b.days}-day boost · {fmt(b.starts_at)}–{fmt(b.ends_at)}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${live ? 'bg-green-100 text-green-800' : label === 'Scheduled' ? 'bg-amber-100 text-amber-900' : 'bg-gray-100 text-gray-600'}`}>{label}</span>
                </div>
                <p className="mt-1 text-xs text-gray-500">{b.impressions} views in Discover · {b.visits} clicks · {b.tickets} ticket{b.tickets === 1 ? '' : 's'}</p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
