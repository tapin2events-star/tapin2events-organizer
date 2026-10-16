import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import PayoutsCard from '../PayoutsCard';

interface Overview { on: boolean; can_edit: boolean; promoters: { link_id: string; ready: boolean; has_account: boolean; sent: number; waiting: number }[] }
const money = (cents: number) => `$${(Number(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Event > Promote (Preview): pay promoters their commission automatically on every ticket sold through their link.
export default function PromoterPayoutsCard({ eventId, links, onLinksChanged }: { eventId: string; onLinksChanged?: () => void; links: { id: string; label: string; promoter_name: string | null; promoter_email: string | null; commission_pct: number | null }[] }) {
  const [o, setO] = useState<Overview | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [perfPct, setPerfPct] = useState('10');
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
  async function performerLinks() {
    setBusy(true); setMsg(null);
    const { data, error } = await supabase.rpc('create_performer_links', { p_event_id: eventId, p_commission: Number(perfPct) || 0 });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message && !/function|permission/i.test(error.message) ? error.message : "Couldn't create the links." });
    const n = Number(data);
    setMsg({ ok: n > 0, text: n > 0 ? `Created ${n} promo link${n === 1 ? '' : 's'} for your performers.${o!.on ? ' Each one gets an email with their link.' : ''}` : 'Every booked performer already has a link (or the lineup has no booked TapIN artists yet).' });
    onLinksChanged?.(); load();
  }
  return (
    <section className="mt-4 rounded-2xl border border-gray-200 bg-surface p-4">
      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-3">
        <p className="text-sm font-semibold text-gray-900">🎤 Promo links for your performers</p>
        <p className="text-xs text-gray-500">One tap gives every artist booked in your lineup their own link, so you can see (and reward) the tickets they sell. Commission is separate from their booking fee.</p>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="block w-28 text-xs font-medium text-gray-500">Commission %<input value={perfPct} inputMode="decimal" onChange={(e) => setPerfPct(e.target.value.replace(/[^0-9.]/g, ''))} className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 sm:text-sm" /></label>
          <button onClick={performerLinks} disabled={busy} className="rounded-xl bg-[#0F1B3D] px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Give each performer a promo link</button>
        </div>
      </div>
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

// Organization settings > Promote (Preview): automatic promoter payouts across the organization's events.
export function OrgPromoterPayouts({ orgId }: { orgId: string }) {
  type Data = { default_on: boolean; events: { id: string; title: string; start_date: string | null; on: boolean; promoters: number; paid: number; waiting: number }[]; promoters: { name: string; photo: string | null; ready: boolean; events: number; paid: number; waiting: number }[] };
  const [d, setD] = useState<Data | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => { const { data } = await supabase.rpc('org_promoter_payouts', { p_org_id: orgId }); setD((data ?? null) as Data | null); }, [orgId]);
  useEffect(() => { load(); }, [load]);
  if (!d) return null;
  async function run(key: string, fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(key); setErr(null);
    const { error } = await fn();
    setBusy(null);
    if (error) setErr(error.message && !/function|permission/i.test(error.message) ? error.message : "Couldn't change that.");
    load();
  }
  const sw = (on: boolean, key: string, onClick: () => void, label: string) => (
    <button onClick={onClick} disabled={busy === key} role="switch" aria-checked={on} aria-label={label} className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-marigold' : 'bg-gray-300'} disabled:opacity-50`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${on ? 'left-[22px]' : 'left-0.5'}`} /></button>
  );
  return (
    <section className="mt-8 rounded-2xl border border-gray-200 bg-surface p-4">
      <p className="flex flex-wrap items-center gap-2 font-display text-lg font-bold text-bone">💸 Automatic promoter payouts <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700">Preview</span></p>
      <p className="text-sm text-muted">Promoters (and performers with promo links) get their commission automatically on every ticket sold through their link.</p>
      {err && <p role="alert" className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5">
        <span className="text-sm"><strong className="text-gray-900">Turn on for new events</strong><span className="block text-xs text-gray-500">Every new event you create pays promoters automatically. You can still switch it per event.</span></span>
        {sw(d.default_on, 'default', () => run('default', () => supabase.rpc('set_org_auto_pay_default', { p_org_id: orgId, p_on: !d.default_on })), 'Turn on for new events')}
      </div>
      {d.events.length > 0 && (
        <>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Events</p>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {d.events.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
                <span className="min-w-0"><span className="block truncate font-medium text-gray-900">{e.title}</span>
                  <span className="block text-xs text-gray-500">{e.promoters} promoter{e.promoters === 1 ? '' : 's'}{Number(e.paid) > 0 ? ` · ${money(e.paid)} paid` : ''}{Number(e.waiting) > 0 ? ` · ${money(e.waiting)} waiting` : ''}</span></span>
                {sw(e.on, e.id, () => run(e.id, () => supabase.rpc('set_auto_pay_promoters', { p_event_id: e.id, p_on: !e.on })), `Pay promoters automatically for ${e.title}`)}
              </li>
            ))}
          </ul>
        </>
      )}
      {d.promoters.length > 0 && (
        <>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Promoters</p>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {d.promoters.map((p, i) => (
              <li key={i} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
                {p.photo ? <img src={p.photo} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600">{(p.name || '?').charAt(0)}</span>}
                <span className="min-w-0 flex-1"><span className="block truncate font-medium text-gray-900">{p.name}</span><span className={`block text-xs ${p.ready ? 'text-green-700' : 'text-amber-700'}`}>{p.ready ? '✓ Payouts connected' : 'Payouts not connected'} · {p.events} event{p.events === 1 ? '' : 's'}</span></span>
                <span className="shrink-0 text-right text-xs text-gray-600">{money(p.paid)} paid{Number(p.waiting) > 0 ? <><br />{money(p.waiting)} waiting</> : null}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
