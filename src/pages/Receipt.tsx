import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import BackButton from '../components/BackButton';

interface Item { item_name: string; quantity: number; unit_price: number; total_price: number }
interface ReceiptData {
  id: string; order_number: string | null; created_at: string; customer_email: string; customer_name: string | null;
  items: Item[] | null; subtotal: number; platform_fee: number; total_amount: number; payment_status: string; refund_amount: number | null;
  billing: { company?: string; name?: string; address?: string; tax_id?: string; po?: string; invoice?: string } | null;
  is_buyer: boolean;
  event: { title: string; start_date: string | null; location: string | null } | null;
  seller: { name: string | null; email: string | null; city?: string | null; state?: string | null; ein?: string | null } | null;
}
const money = (n: number) => `$${(Number(n) || 0).toFixed(2)}`;
const field = 'mt-1 block w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900';

// Printable receipt (Preview): order details, seller, and the buyer's business billing details
// (company, address, tax ID, PO number) for expense reports. "Save as PDF" uses the browser's print.
export default function Receipt() {
  const [params] = useSearchParams();
  const [r, setR] = useState<ReceiptData | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [b, setB] = useState({ company: '', name: '', address: '', tax_id: '', po: '' });
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    let orderId = params.get('order');
    if (!orderId && params.get('ticket')) {
      const { data } = await supabase.from('tickets').select('order_id').eq('id', params.get('ticket')!).maybeSingle();
      orderId = (data as { order_id: string | null } | null)?.order_id ?? null;
    }
    if (!orderId) return setR(null);
    const { data } = await supabase.rpc('order_receipt', { p_order_id: orderId });
    const d = (data ?? null) as ReceiptData | null;
    setR(d);
    if (d) setB({ company: d.billing?.company ?? '', name: d.billing?.name ?? d.customer_name ?? '', address: d.billing?.address ?? '', tax_id: d.billing?.tax_id ?? '', po: d.billing?.po ?? '' });
  }, [params]);
  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!r) return;
    const { error } = await supabase.rpc('save_order_billing', { p_order_id: r.id, p_billing: b });
    if (error) return setMsg("Couldn't save.");
    setEditing(false); setMsg('Saved.'); setTimeout(() => setMsg(null), 2000);
    load();
  }

  if (r === undefined) return <div className="mx-auto max-w-2xl"><div className="h-60 animate-pulse rounded-2xl bg-gray-100" /></div>;
  if (r === null) return <div className="mx-auto max-w-2xl"><BackButton fallback="/activity" fallbackLabel="My Activity" /><p className="mt-4 text-muted">There's no receipt for this ticket (free registrations don't have one).</p></div>;

  const refunded = Number(r.refund_amount) || 0;
  return (
    <div className="mx-auto max-w-2xl">
      <div className="print:hidden"><BackButton fallback="/activity" fallbackLabel="My Activity" /></div>
      <div className="mt-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm print:mt-0 print:border-0 print:shadow-none sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-display text-2xl font-extrabold text-gray-900">{r.billing?.invoice ? 'Invoice receipt' : 'Receipt'}</p>
            <p className="text-sm text-gray-500">{r.billing?.invoice ? `Invoice ${r.billing.invoice}` : `Order ${r.order_number ?? r.id.slice(0, 8).toUpperCase()}`} · {new Date(r.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${r.payment_status === 'refunded' ? 'bg-gray-200 text-gray-700' : 'bg-green-100 text-green-800'}`}>{r.payment_status === 'refunded' ? 'Refunded' : 'Paid'}</span>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">From</p>
            <p className="mt-1 font-semibold text-gray-900">{r.seller?.name || 'Event organizer'}</p>
            {r.seller?.email && <p className="text-sm text-gray-600">{r.seller.email}</p>}
            {(r.seller?.city || r.seller?.state) && <p className="text-sm text-gray-600">{[r.seller.city, r.seller.state].filter(Boolean).join(', ')}</p>}
            {r.seller?.ein && <p className="text-sm text-gray-600">EIN {r.seller.ein}</p>}
            <p className="mt-1 text-xs text-gray-400">Processed by TapIN LLC, Rolesville, North Carolina</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Billed to</p>
            {r.billing?.company && <p className="mt-1 font-semibold text-gray-900">{r.billing.company}</p>}
            <p className={r.billing?.company ? 'text-sm text-gray-700' : 'mt-1 font-semibold text-gray-900'}>{r.billing?.name || r.customer_name || r.customer_email}</p>
            <p className="text-sm text-gray-600">{r.customer_email}</p>
            {r.billing?.address && <p className="whitespace-pre-line text-sm text-gray-600">{r.billing.address}</p>}
            {r.billing?.tax_id && <p className="text-sm text-gray-600">Tax ID {r.billing.tax_id}</p>}
            {r.billing?.po && <p className="text-sm text-gray-600">PO {r.billing.po}</p>}
          </div>
        </div>

        {r.event && (
          <p className="mt-6 text-sm text-gray-700"><strong>{r.event.title}</strong>{r.event.start_date ? ` · ${new Date(r.event.start_date).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}` : ''}{r.event.location ? ` · ${r.event.location}` : ''}</p>
        )}

        <table className="mt-4 w-full text-sm">
          <thead><tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400"><th className="py-2 font-semibold">Item</th><th className="py-2 text-right font-semibold">Qty</th><th className="py-2 text-right font-semibold">Price</th><th className="py-2 text-right font-semibold">Amount</th></tr></thead>
          <tbody>
            {(r.items ?? []).map((it, i) => (
              <tr key={i} className="border-b border-gray-100"><td className="py-2 pr-2 text-gray-800">{it.item_name}</td><td className="py-2 text-right text-gray-700">{it.quantity}</td><td className="py-2 text-right text-gray-700">{money(it.unit_price)}</td><td className="py-2 text-right text-gray-900">{money(it.total_price)}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="ml-auto mt-3 w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between text-gray-700"><span>Subtotal</span><span>{money(r.subtotal)}</span></div>
          <div className="flex justify-between text-gray-700"><span>Service & processing fees</span><span>{money(r.platform_fee)}</span></div>
          <div className="flex justify-between border-t border-gray-200 pt-1 font-bold text-gray-900"><span>Total paid</span><span>{money(r.total_amount)}</span></div>
          {refunded > 0 && <div className="flex justify-between text-gray-700"><span>Refunded</span><span>−{money(refunded)}</span></div>}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 print:hidden">
        <button onClick={() => window.print()} className="rounded-xl bg-[#0F1B3D] px-4 py-2.5 text-sm font-semibold text-white">Save as PDF / Print</button>
        {r.is_buyer && !editing && <button onClick={() => setEditing(true)} className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700">{r.billing?.company ? 'Edit business details' : 'Add business details'}</button>}
        {msg && <span className="self-center text-sm text-green-700">{msg}</span>}
      </div>

      {editing && (
        <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 print:hidden">
          <p className="font-semibold text-gray-900">Business details for this receipt</p>
          <p className="text-xs text-gray-500">For expense reports and company records. Only shows on your receipt.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block min-w-0 text-xs font-medium text-gray-500">Company<input value={b.company} maxLength={120} onChange={(e) => setB({ ...b, company: e.target.value })} className={field} /></label>
            <label className="block min-w-0 text-xs font-medium text-gray-500">Name on receipt<input value={b.name} maxLength={120} onChange={(e) => setB({ ...b, name: e.target.value })} className={field} /></label>
            <label className="block min-w-0 text-xs font-medium text-gray-500 sm:col-span-2">Billing address<textarea rows={2} value={b.address} maxLength={400} onChange={(e) => setB({ ...b, address: e.target.value })} className={field} /></label>
            <label className="block min-w-0 text-xs font-medium text-gray-500">Tax ID (optional)<input value={b.tax_id} maxLength={60} onChange={(e) => setB({ ...b, tax_id: e.target.value })} className={field} /></label>
            <label className="block min-w-0 text-xs font-medium text-gray-500">PO number (optional)<input value={b.po} maxLength={60} onChange={(e) => setB({ ...b, po: e.target.value })} className={field} /></label>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={save} className="rounded-xl bg-marigold px-4 py-2.5 text-sm font-semibold text-white">Save</button>
            <button onClick={() => setEditing(false)} className="rounded-xl px-3 py-2.5 text-sm text-gray-500">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
