import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import PayoutsCard from '../PayoutsCard';

interface Overview { on: boolean; can_edit: boolean; promoters: { link_id: string; ready: boolean; has_account: boolean; sent: number; waiting: number }[] }
const money = (cents: number) => `$${(Number(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Event > Promote (Preview): pay promoters their commission automatically on every ticket sold through their link.
export default function PromoterPayoutsCard({ eventId, links }: { eventId: string; links: { id: string; label: string; promoter_name: string | null; promoter_email: string | null; commission_pct: number | null }[] }) {
  const [o, setO] = useState<Overview | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(async () => { const { data } = await supabase.rpc('promoter_payouts_overview', { p_event_id: eventId }); setO((data ?? null) as Overview | null); }, [eventId]);
  useEffect(() => { load(); }, [load, links.length]);
  if (!o) return null;
  const promoterLinks = links.filter((l) => l.promoter_email && (l.commission_pct ?? 0) > 0);
  async function toggle() {
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc('set_auto_pay_promoters', { p_event_id: eventId, p_on: !o!.on });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message && !/function|permission/i.test(error.message) ? error.message : "Couldn't change that." });
    setMsg({ ok: true, text: !o!.on ? 'On. Promoters get their commission automatically on new sales, and each one gets an email to connect payouts.' : 'Off. Commission is tracked, and you pay promoters yourself.' });
    load();
  }
  return (
    <section className="mt-4 rounded-2xl border border-gray-200 bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-bone">💸 Pay promoters automatically <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700">Preview</span></p>
          <p className="text-sm text-muted">{o.on
            ? 'Each ticket sold through a promoter\u2019s link sends them their commission of the ticket price. The rest goes to your payout account.'
            : 'Turn on to send promoters their commission automatically on every ticket sold through their link, instead of paying them yourself.'}</p>
        </div>
        {o.can_edit && <button onClick={toggle} disabled={busy} role="switch" aria-checked={o.on} className={`relative h-7 w-12 shrink-0 rounded-full transition ${o.on ? 'bg-marigold' : 'bg-gray-300'} disabled:opacity-50`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${o.on ? 'left-6' : 'left-1'}`} /></button>}
      </div>
      {msg && <p role="status" className={`mt-3 rounded-xl px-3 py-2 text-sm ${msg.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{msg.text}</p>}
      {o.on && (promoterLinks.length === 0 ? <p className="mt-3 text-sm text-muted">Add a link for a promoter with a commission % to start.</p> : (
        <ul className="mt-3 flex flex-col gap-1.5 text-sm">
          {promoterLinks.map((l) => {
            const p = o.promoters.find((x) => x.link_id === l.id);
            return (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
                <span className="min-w-0"><span className="block truncate font-medium text-gray-900">{l.promoter_name || l.promoter_email} · {l.commission_pct}%</span>
                  <span className="block text-xs">{p?.ready ? <span className="text-green-700">✓ Payouts connected</span> : p?.has_account ? <span className="text-amber-700">Needs to connect payouts (commission is held until then)</span> : <span className="text-amber-700">Not on TapIN yet: they'll get an email to sign up and connect payouts</span>}</span></span>
                <span className="shrink-0 text-right text-xs text-gray-600">{money(p?.sent ?? 0)} paid{(p?.waiting ?? 0) > 0 ? ` · ${money(p?.waiting ?? 0)} waiting` : ''}</span>
              </li>
            );
          })}
        </ul>
      ))}
      <p className="mt-3 text-xs text-muted">Commission comes off the top of each ticket price (buyer fees aren't included). Any revenue split divides what's left. Refunds take back commission proportionally. Applies to ticket sales made while this is on.</p>
    </section>
  );
}

// My promoter links (Preview): automatic payouts received, and the payout setup card if needed.
export function MyPromoterPayouts() {
  const [rows, setRows] = useState<{ link_id: string; event_title: string; auto_pay: boolean; sent_cents: number; waiting_cents: number }[] | null>(null);
  const [payouts, setPayouts] = useState<{ hasAccount: boolean; ready: boolean } | null>(null);
  useEffect(() => {
    supabase.rpc('my_promoter_payouts').then(({ data }) => setRows((data ?? []) as typeof rows));
    supabase.auth.getUser().then(({ data: u }) => {
      if (!u.user) return;
      supabase.from('profiles').select('stripe_account_id, stripe_charges_enabled').eq('id', u.user.id).maybeSingle()
        .then(({ data }) => { const d = data as { stripe_account_id: string | null; stripe_charges_enabled: boolean | null } | null; setPayouts({ hasAccount: !!d?.stripe_account_id, ready: !!d?.stripe_account_id && !!d?.stripe_charges_enabled }); });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const auto = (rows ?? []).filter((r) => r.auto_pay || Number(r.sent_cents) > 0 || Number(r.waiting_cents) > 0);
  if (!auto.length) return null;
  const sent = auto.reduce((n, r) => n + Number(r.sent_cents), 0);
  const waiting = auto.reduce((n, r) => n + Number(r.waiting_cents), 0);
  return (
    <section className="mt-4 rounded-2xl border border-gray-200 bg-surface p-4">
      <p className="font-semibold text-bone">💸 Paid automatically</p>
      <p className="text-sm text-muted">{auto.length === 1 ? 'This event pays' : 'These events pay'} your commission automatically: <strong className="text-bone">{money(sent)} paid</strong>{waiting > 0 ? <> · <strong className="text-amber-700">{money(waiting)} waiting</strong></> : null}</p>
      {payouts && !payouts.ready && <div className="mt-3"><PayoutsCard hasAccount={payouts.hasAccount} chargesEnabled={false} variant="creator" /></div>}
      <ul className="mt-3 flex flex-col gap-1 text-sm">
        {auto.map((r) => <li key={r.link_id} className="flex justify-between gap-2"><span className="truncate text-bone">{r.event_title}</span><span className="shrink-0 text-xs text-muted">{money(Number(r.sent_cents))} paid{Number(r.waiting_cents) > 0 ? ` · ${money(Number(r.waiting_cents))} waiting` : ''}</span></li>)}
      </ul>
    </section>
  );
}
