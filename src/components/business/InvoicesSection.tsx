import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Sheet from '../scouting/Sheet';

interface Invoice {
  id: string; number: string; company_name: string; contact_name: string | null; contact_email: string; items: { label: string; qty: number; unit_price: number }[];
  subtotal: number; fee_amount: number; total: number; due_date: string; status: 'open' | 'paid' | 'void'; hosted_url: string | null; pdf_url: string | null; created_at: string; paid_at: string | null;
}
interface TierOpt { id: string; name: string; price: number; remaining: number | null }
interface SectionOpt { name: string; price: number; seats: number }
const money = (n: number) => `$${(Number(n) || 0).toFixed(2)}`;
const field = 'mt-1 block w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900';

// Event > Tickets > Invoices (Preview): bill a company for a group of tickets. Stripe emails the invoice
// with a payment page; once paid, tickets go to the billing contact (who can transfer them).
export default function InvoicesSection({ eventId, ticketPrice, sections }: { eventId: string; ticketPrice: number; sections?: SectionOpt[] }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tiers, setTiers] = useState<TierOpt[]>([]);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => {
    const [{ data: inv }, { data: av }] = await Promise.all([
      supabase.from('invoices').select('*').eq('event_id', eventId).order('created_at', { ascending: false }),
      supabase.rpc('tier_availability', { p_event_id: eventId }),
    ]);
    setInvoices(((inv ?? []) as Invoice[]).map((x) => ({ ...x, subtotal: Number(x.subtotal), fee_amount: Number(x.fee_amount), total: Number(x.total) })));
    setTiers(((av ?? []) as TierOpt[]).map((t) => ({ ...t, price: Number(t.price) })));
  }, [eventId]);
  useEffect(() => { load(); }, [load]);
  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(null), 3500); };

  async function act(inv: Invoice, action: 'resend' | 'void' | 'refresh') {
    if (action === 'void' && !window.confirm(`Cancel invoice ${inv.number}? ${inv.company_name} won't be able to pay it.`)) return;
    setBusy(inv.id + action);
    const { data, error } = await supabase.functions.invoke('invoice-manage', { body: { action, invoice_id: inv.id } });
    setBusy(null);
    if (error) {
      let m = "That didn't work.";
      try { const j = await (error as { context?: Response })?.context?.json(); if (j?.error) m = j.error; } catch { /* default */ }
      return flash(m);
    }
    flash(action === 'resend' ? `Invoice ${inv.number} emailed again.` : action === 'void' ? `Invoice ${inv.number} cancelled.` : data?.status === 'paid' ? `Paid! Tickets were issued to ${inv.contact_email}.` : 'Not paid yet.');
    load();
  }

  const statusBadge = (inv: Invoice) => {
    const overdue = inv.status === 'open' && inv.due_date < new Date().toISOString().slice(0, 10);
    const [label, cls] = inv.status === 'paid' ? ['Paid', 'bg-green-100 text-green-800'] : inv.status === 'void' ? ['Cancelled', 'bg-gray-200 text-gray-600'] : overdue ? ['Overdue', 'bg-red-100 text-red-700'] : ['Unpaid', 'bg-amber-100 text-amber-900'];
    return <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${cls}`}>{label}</span>;
  };

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-display text-lg font-bold text-bone">🧾 Invoices <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700">Preview</span></p>
          <p className="text-sm text-muted">Bill a company or group for tickets. They pay online by the due date, then the tickets are issued to their contact.</p>
        </div>
        <button onClick={() => setCreating(true)} className="rounded-xl bg-marigold px-4 py-2 text-sm font-semibold text-white">+ New invoice</button>
      </div>
      {msg && <p role="status" className="mt-2 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">{msg}</p>}
      {invoices.length === 0 ? <p className="mt-3 rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-muted">No invoices yet.</p> : (
        <ul className="mt-3 flex flex-col gap-2">
          {invoices.map((inv) => (
            <li key={inv.id} className="rounded-2xl border border-gray-200 bg-surface p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-bone">{inv.company_name} {statusBadge(inv)}</p>
                  <p className="text-xs text-muted">{inv.number} · {inv.items.reduce((n, i) => n + i.qty, 0)} {sections ? 'seats' : 'tickets'} · {inv.contact_email}</p>
                  {sections && <p className="text-xs text-muted">{inv.items.map((i) => i.label).join(' · ')}</p>}
                  <p className="text-xs text-muted">{inv.status === 'paid' && inv.paid_at ? `Paid ${new Date(inv.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : `Due ${new Date(inv.due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}</p>
                </div>
                <p className="shrink-0 text-right font-bold text-bone">{money(inv.total)}<span className="block text-[11px] font-normal text-muted">incl. {money(inv.fee_amount)} fees</span></p>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                {inv.hosted_url && <a href={inv.hosted_url} target="_blank" rel="noopener noreferrer" className="font-medium text-marigold">View invoice ↗</a>}
                {inv.hosted_url && inv.status === 'open' && <button onClick={() => { navigator.clipboard?.writeText(inv.hosted_url!); flash('Payment link copied.'); }} className="font-medium text-marigold">Copy payment link</button>}
                {inv.status === 'open' && <button onClick={() => act(inv, 'refresh')} disabled={!!busy} className="font-medium text-gray-600">{busy === inv.id + 'refresh' ? 'Checking…' : 'Check if paid'}</button>}
                {inv.status === 'open' && <button onClick={() => act(inv, 'resend')} disabled={!!busy} className="font-medium text-gray-600">{busy === inv.id + 'resend' ? 'Sending…' : 'Email again'}</button>}
                {inv.status === 'open' && <button onClick={() => act(inv, 'void')} disabled={!!busy} className="text-gray-400 hover:text-red-600">Cancel</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-muted">Payments are checked automatically every 15 minutes.{sections ? ' Seats are held for the group until the invoice is paid, cancelled, or a week past its due date.' : ''}</p>
      {creating && <NewInvoiceSheet eventId={eventId} tiers={tiers} sections={sections} ticketPrice={ticketPrice} onClose={() => setCreating(false)} onDone={(t) => { setCreating(false); flash(t); load(); }} />}
    </section>
  );
}

function NewInvoiceSheet({ eventId, tiers, sections, ticketPrice, onClose, onDone }: { eventId: string; tiers: TierOpt[]; sections?: SectionOpt[]; ticketPrice: number; onClose: () => void; onDone: (msg: string) => void }) {
  const seated = !!sections?.length;
  const due = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const [f, setF] = useState({ company: '', contact: '', email: '', address: '', po: '', notes: '', due });
  const [lines, setLines] = useState<{ tier_id: string; qty: string; price: string }[]>(() => seated
    ? [{ tier_id: sections![0].name, qty: '8', price: String(sections![0].price) }]
    : [{ tier_id: tiers[0]?.id ?? '', qty: '10', price: String(tiers[0]?.price ?? ticketPrice) }]);
  const [send, setSend] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const subtotal = lines.reduce((n, l) => n + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
  const paidQty = lines.filter((l) => Number(l.price) > 0).reduce((n, l) => n + (Number(l.qty) || 0), 0);
  const fees = Math.round(subtotal * 0.037 * 100) / 100 + 1.79 * paidQty + Math.round(subtotal * 0.029 * 100) / 100;

  async function create() {
    setBusy(true); setErr(null);
    const { data, error } = await supabase.functions.invoke('invoice-manage', { body: {
      action: 'create', event_id: eventId, company_name: f.company, contact_name: f.contact, contact_email: f.email, billing_address: f.address,
      po_number: f.po, notes: f.notes, due_date: f.due, send,
      items: lines.map((l) => (seated ? { section: l.tier_id, qty: Number(l.qty), unit_price: l.price } : l.tier_id ? { tier_id: l.tier_id, qty: Number(l.qty), unit_price: l.price } : { label: 'Ticket', qty: Number(l.qty), unit_price: l.price })),
    } });
    setBusy(false);
    if (error || !data?.success) {
      let m = "Couldn't create the invoice.";
      try { const j = await (error as { context?: Response })?.context?.json(); if (j?.error) m = j.error; } catch { /* default */ }
      return setErr(m);
    }
    const held = Array.isArray(data.seats) && data.seats.length ? ` ${data.seats.length} seats are held for them.` : '';
    onDone((send ? `Invoice ${data.number} emailed to ${f.email}.` : `Invoice ${data.number} created. Copy its payment link to share it.`) + held);
  }

  return (
    <Sheet title="New invoice" onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block min-w-0 text-xs font-medium text-gray-500 sm:col-span-2">Company or group<input value={f.company} maxLength={120} onChange={(e) => setF({ ...f, company: e.target.value })} placeholder="Acme Corp" className={field} autoFocus /></label>
        <label className="block min-w-0 text-xs font-medium text-gray-500">Contact name<input value={f.contact} maxLength={120} onChange={(e) => setF({ ...f, contact: e.target.value })} className={field} /></label>
        <label className="block min-w-0 text-xs font-medium text-gray-500">Billing email<input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="ap@acme.com" className={field} /></label>
        <label className="block min-w-0 text-xs font-medium text-gray-500 sm:col-span-2">Billing address (optional)<textarea rows={2} value={f.address} maxLength={400} onChange={(e) => setF({ ...f, address: e.target.value })} className={field} /></label>
        <label className="block min-w-0 text-xs font-medium text-gray-500">PO number (optional)<input value={f.po} maxLength={60} onChange={(e) => setF({ ...f, po: e.target.value })} className={field} /></label>
        <label className="block min-w-0 text-xs font-medium text-gray-500">Due date<input type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} className={`${field} h-12 appearance-none`} /></label>
      </div>

      <p className="mt-4 text-xs font-medium text-gray-500">{seated ? 'Seats' : 'Tickets'}</p>
      {lines.map((l, i) => (
        <div key={i} className="mt-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
          {seated && (
            <label className="block text-xs font-medium text-gray-500">Section
              <select value={l.tier_id} onChange={(e) => { const sec = sections!.find((x) => x.name === e.target.value); setLines(lines.map((x, j) => (j === i ? { ...x, tier_id: e.target.value, price: String(sec?.price ?? x.price) } : x))); }} className={field}>
                {sections!.map((sec) => <option key={sec.name} value={sec.name}>{sec.name} ({money(sec.price)} a seat, {sec.seats} seats)</option>)}
              </select>
            </label>
          )}
          {!seated && tiers.length > 0 && (
            <label className="block text-xs font-medium text-gray-500">Ticket type
              <select value={l.tier_id} onChange={(e) => { const t = tiers.find((x) => x.id === e.target.value); setLines(lines.map((x, j) => (j === i ? { ...x, tier_id: e.target.value, price: String(t?.price ?? x.price) } : x))); }} className={field}>
                {tiers.map((t) => <option key={t.id} value={t.id}>{t.name} ({money(t.price)}{t.remaining !== null ? `, ${t.remaining} left` : ''})</option>)}
              </select>
            </label>
          )}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="block min-w-0 text-xs font-medium text-gray-500">Quantity<input value={l.qty} inputMode="numeric" onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: e.target.value.replace(/\D/g, '') } : x)))} className={field} /></label>
            <label className="block min-w-0 text-xs font-medium text-gray-500">Price each ($)<input value={l.price} inputMode="decimal" onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, price: e.target.value.replace(/[^0-9.]/g, '') } : x)))} className={field} /></label>
          </div>
          {lines.length > 1 && <button type="button" onClick={() => setLines(lines.filter((_, j) => j !== i))} className="mt-2 text-xs text-gray-500 hover:text-red-600">Remove</button>}
        </div>
      ))}
      {!seated && tiers.length > 1 && <button type="button" onClick={() => setLines([...lines, { tier_id: tiers[0].id, qty: '1', price: String(tiers[0].price) }])} className="mt-2 text-sm font-semibold text-marigold">+ Add another ticket type</button>}
      {seated && sections!.length > 1 && <button type="button" onClick={() => setLines([...lines, { tier_id: sections![0].name, qty: '1', price: String(sections![0].price) }])} className="mt-2 text-sm font-semibold text-marigold">+ Add another section</button>}
      <p className="mt-1 text-xs text-gray-500">{seated ? 'Seats are picked for you, filling whole tables first so the group sits together, and held until the invoice is paid. ' : ''}You can lower the price for a group discount.</p>

      <label className="mt-3 block text-xs font-medium text-gray-500">Note on the invoice (optional)<textarea rows={2} value={f.notes} maxLength={1000} onChange={(e) => setF({ ...f, notes: e.target.value })} className={field} /></label>

      <div className="mt-4 space-y-1 rounded-xl bg-gray-50 p-3 text-sm">
        <div className="flex justify-between text-gray-700"><span>Tickets</span><span>{money(subtotal)}</span></div>
        <div className="flex justify-between text-gray-700"><span>Service & processing fees</span><span>{money(fees)}</span></div>
        <div className="flex justify-between border-t border-gray-200 pt-1 font-bold text-gray-900"><span>Invoice total</span><span>{money(subtotal + fees)}</span></div>
        <p className="text-xs text-gray-500">You receive {money(subtotal)}. Fees match regular ticket sales.</p>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={send} onChange={(e) => setSend(e.target.checked)} className="h-4 w-4 accent-marigold" /> Email the invoice now (Stripe sends it with a secure payment page)</label>
      {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
      <button onClick={create} disabled={busy} className="mt-4 w-full rounded-xl bg-marigold py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Creating…' : send ? 'Create & email invoice' : 'Create invoice'}</button>
    </Sheet>
  );
}
