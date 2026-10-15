import { useCallback, useEffect, useState } from 'react';
import PayoutsCard from '../PayoutsCard';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import PremiumBadge from './PremiumBadge';

interface Row { user_id?: string | null; email?: string | null; percent: number; label: string | null; name?: string | null; photo?: string | null; ready?: boolean; has_account?: boolean; sent?: number; waiting?: number }
interface Found { id: string; full_name: string; profile_photo: string | null; payouts_ready: boolean }
interface Overview { can_edit: boolean; rows: Row[]; main_sent: number; main_waiting: number }
const money = (cents: number) => `$${(Number(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const field = 'block w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 sm:text-sm';

// Event > Sales (Business plan; free while billing enforcement is off): divide ticket sales by percentage. Each person connects their own
// payouts once; TapIN sends their share of every ticket sale automatically. The main payout account gets the rest.
export default function RevenueSplits({ eventId, hostName }: { eventId: string; hostName: string }) {
  const [o, setO] = useState<Overview | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Found[]>([]);
  useEffect(() => {
    if (q.trim().length < 2) { setFound([]); return; }
    const t = setTimeout(() => { supabase.rpc('search_people_for_splits', { p_query: q.trim() }).then(({ data }) => setFound((data ?? []) as Found[])); }, 250);
    return () => clearTimeout(t);
  }, [q]);
  const load = useCallback(async () => {
    const { data } = await supabase.rpc('event_splits_overview', { p_event_id: eventId });
    const d = data as Overview | null;
    setO(d); setRows((d?.rows ?? []).map((r) => ({ ...r, percent: Number(r.percent) })));
  }, [eventId]);
  useEffect(() => { load(); }, [load]);
  if (!o) return null;
  const total = rows.reduce((n, r) => n + (Number(r.percent) || 0), 0);
  async function save() {
    const clean = rows.filter((r) => r.user_id || (r.email ?? '').trim());
    if (clean.some((r) => !(Number(r.percent) > 0))) return setMsg({ ok: false, text: 'Give everyone a percentage above 0.' });
    if (total > 100) return setMsg({ ok: false, text: 'The split adds up to more than 100%.' });
    const { error } = await supabase.rpc('save_event_splits', { p_event_id: eventId, p_rows: clean.map((r) => (r.user_id ? { user_id: r.user_id, percent: Number(r.percent), label: r.label } : { email: (r.email ?? '').trim(), percent: Number(r.percent), label: r.label })) });
    if (error) return setMsg({ ok: false, text: error.message && !/function|permission/i.test(error.message) ? error.message : "Couldn't save the split." });
    setMsg({ ok: true, text: clean.length ? 'Split saved. New ticket sales will be divided automatically.' : 'Split removed. Ticket sales go entirely to the main account again.' });
    setEditing(false); load();
  }
  const evenSplit = () => { const n = rows.length; if (!n) return; const each = Math.floor((100 / (n + 1)) * 100) / 100; setRows(rows.map((r) => ({ ...r, percent: each }))); };
  return (
    <section className="rounded-2xl border border-gray-200 bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-bone">💸 Revenue splits <PremiumBadge /></p>
          <p className="text-sm text-muted">Divide ticket sales with performers or partners. Each person connects their own payouts once, and TapIN sends their share of every sale automatically.</p>
        </div>
        {o.can_edit && !editing && <button onClick={() => setEditing(true)} className="rounded-xl bg-[#0F1B3D] px-3 py-2 text-sm font-semibold text-white">{rows.length ? 'Edit split' : 'Set up a split'}</button>}
      </div>
      {msg && <p role="status" className={`mt-3 rounded-xl px-3 py-2 text-sm ${msg.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{msg.text}</p>}

      {editing ? (
        <div className="mt-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people on TapIN by name" aria-label="Search people on TapIN" className={field} />
          {found.length > 0 && (
            <ul className="mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white">
              {found.map((f) => {
                const added = rows.some((r) => r.user_id === f.id);
                return (
                  <li key={f.id} className="flex items-center gap-2 border-b border-gray-100 px-3 py-2 last:border-0">
                    {f.profile_photo ? <img src={f.profile_photo} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600">{f.full_name.charAt(0)}</span>}
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm text-gray-900">{f.full_name}</span><span className={`block text-[11px] ${f.payouts_ready ? 'text-green-700' : 'text-gray-500'}`}>{f.payouts_ready ? '✓ Payouts connected' : 'Payouts not connected yet'}</span></span>
                    <button disabled={added} onClick={() => { setRows([...rows, { user_id: f.id, name: f.full_name, photo: f.profile_photo, ready: f.payouts_ready, percent: 0, label: null }]); setQ(''); }}
                      className="shrink-0 rounded-lg bg-marigold px-3 py-1.5 text-xs font-semibold text-white disabled:bg-gray-200 disabled:text-gray-500">{added ? 'Added' : 'Add'}</button>
                  </li>
                );
              })}
            </ul>
          )}
          {q.trim().length >= 2 && found.length === 0 && <p className="mt-1 text-xs text-gray-500">No one on TapIN by that name. You can add them by email below.</p>}
          <ul className="mt-3 flex flex-col gap-2">
            {rows.map((r, i) => (
              <li key={i} className="grid grid-cols-[1fr_5.5rem_auto] items-center gap-2">
                {r.user_id ? (
                  <span className="flex min-w-0 items-center gap-2 rounded-xl border border-gray-200 bg-white px-2 py-1.5">
                    {r.photo ? <img src={r.photo} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" /> : <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600">{(r.name || '?').charAt(0)}</span>}
                    <span className="min-w-0"><span className="block truncate text-sm font-medium text-gray-900">{r.name}</span><span className={`block text-[11px] ${r.ready ? 'text-green-700' : 'text-amber-700'}`}>{r.ready ? '✓ Payouts connected' : 'Needs to connect payouts'}</span></span>
                  </span>
                ) : (
                  <input value={r.email ?? ''} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} placeholder="Email (not on TapIN yet)" type="email" aria-label="Email" className={field} />
                )}
                <span className="relative"><input value={String(r.percent)} inputMode="decimal" onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, percent: Number(e.target.value.replace(/[^0-9.]/g, '')) || 0 } : x)))} aria-label="Percent" className={`${field} pr-7`} /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">%</span></span>
                <button onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Remove" className="px-2 text-gray-400 hover:text-red-600">✕</button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            <button onClick={() => setRows([...rows, { email: '', percent: 0, label: null }])} className="font-medium text-marigold">Someone not on TapIN? Add by email</button>
            {rows.length > 1 && <button onClick={evenSplit} className="text-gray-600">Split evenly (with {hostName})</button>}
          </div>
          <p className={`mt-3 rounded-xl px-3 py-2 text-sm ${total > 100 ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-700'}`}>
            {total > 100 ? `That's ${total}%, over 100%.` : <><strong>{hostName}</strong> (the main payout account) gets the remaining <strong>{Math.round((100 - total) * 100) / 100}%</strong>.</>}
          </p>
          <div className="mt-3 flex gap-2">
            <button onClick={save} className="rounded-xl bg-marigold px-4 py-2.5 text-sm font-semibold text-white">Save split</button>
            <button onClick={() => { setEditing(false); load(); }} className="rounded-xl px-3 py-2.5 text-sm text-gray-500">Cancel</button>
          </div>
        </div>
      ) : rows.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1.5 text-sm">
          {o.rows.map((r, i) => (
            <li key={r.user_id ?? r.email ?? i} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
              <span className="flex min-w-0 items-center gap-2">{r.photo ? <img src={r.photo} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" /> : null}<span className="min-w-0"><span className="block truncate font-medium text-gray-900">{r.name || r.email} · {Number(r.percent)}%</span>
                <span className="block text-xs">{r.ready ? <span className="text-green-700">✓ Payouts connected</span> : r.has_account ? <span className="text-amber-700">Needs to connect payouts in Earnings (their share is held until then)</span> : <span className="text-amber-700">Not on TapIN yet: they'll need to sign up with this email and connect payouts</span>}</span></span></span>
              <span className="shrink-0 text-right text-xs text-gray-600">{money(r.sent ?? 0)} sent{(r.waiting ?? 0) > 0 ? ` · ${money(r.waiting ?? 0)} waiting` : ''}</span>
            </li>
          ))}
          <li className="flex items-center justify-between gap-2 px-3 py-1 text-xs text-gray-600"><span>{hostName} (main account) · {Math.round((100 - o.rows.reduce((n, r) => n + Number(r.percent), 0)) * 100) / 100}%</span><span>{money(o.main_sent)} sent{o.main_waiting ? ` · ${money(o.main_waiting)} waiting` : ''}</span></li>
        </ul>
      ) : <p className="mt-3 text-sm text-muted">No split. Ticket sales go to {hostName}'s payout account.</p>}
      <p className="mt-3 text-xs text-muted">Splits apply to ticket sales (one-price and ticket-type events) made after the split is saved. Donations and merch go to the main account. Buyers pay the fees on top, so shares are of the full ticket price. Refunds take back each share proportionally. Reserved seating isn't split yet.</p>
    </section>
  );
}

// Earnings: a performer's shares of ticket sales, with the payout setup card if they haven't connected yet.
export function MySplitEarnings() {
  const [rows, setRows] = useState<{ event_id: string; event_title: string; start_date: string | null; percent: number; sent_cents: number; waiting_cents: number }[] | null>(null);
  const [payouts, setPayouts] = useState<{ hasAccount: boolean; ready: boolean } | null>(null);
  useEffect(() => {
    supabase.rpc('my_split_earnings').then(({ data }) => setRows((data ?? []) as typeof rows));
    supabase.auth.getUser().then(({ data: u }) => {
      if (!u.user) return;
      supabase.from('profiles').select('stripe_account_id, stripe_charges_enabled').eq('id', u.user.id).maybeSingle()
        .then(({ data }) => { const d = data as { stripe_account_id: string | null; stripe_charges_enabled: boolean | null } | null; setPayouts({ hasAccount: !!d?.stripe_account_id, ready: !!d?.stripe_account_id && !!d?.stripe_charges_enabled }); });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!rows?.length) return null;
  const waiting = rows.reduce((n, r) => n + Number(r.waiting_cents), 0);
  return (
    <section className="mt-6 rounded-2xl border border-gray-200 bg-surface p-4">
      <p className="font-semibold text-bone">💸 Your shares of ticket sales</p>
      {payouts && !payouts.ready && (
        <div className="mt-3">
          {waiting > 0 && <p className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{money(waiting)} is waiting for you. Connect your payouts to receive it.</p>}
          <PayoutsCard hasAccount={payouts.hasAccount} chargesEnabled={false} variant="creator" />
        </div>
      )}
      <ul className="mt-3 flex flex-col gap-1.5 text-sm">
        {rows.map((r) => (
          <li key={r.event_id} className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
            <Link to={`/events/${r.event_id}`} className="min-w-0 truncate font-medium text-gray-900">{r.event_title} <span className="text-gray-500">· {Number(r.percent)}%</span></Link>
            <span className="shrink-0 text-right text-xs text-gray-600">{money(r.sent_cents)} sent{Number(r.waiting_cents) > 0 ? ` · ${money(r.waiting_cents)} waiting` : ''}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
