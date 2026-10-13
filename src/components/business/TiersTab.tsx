import { useCallback, useEffect, useState } from 'react';
import PromoCodes from './PromoCodes';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import Sheet from '../scouting/Sheet';
import type { TapEvent } from '../../lib/types';

interface Tier { id: string; event_id: string; name: string; description: string | null; price: number; quantity: number | null; sales_start: string | null; sales_end: string | null; max_per_order: number; sort_order: number; active: boolean }
const toLocal = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso); const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);
const money = (n: number) => `$${Number(n).toFixed(2).replace(/\.00$/, '')}`;
const field = 'mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900';
const PRESETS = [
  { name: 'General Admission', price: 25 }, { name: 'VIP', price: 75 }, { name: 'Early Bird', price: 15 }, { name: 'Student', price: 10 },
];

// Event dashboard > Tickets: create ticket tiers (each with its own price, quantity and sales window).
export default function TiersTab({ event }: { event: TapEvent }) {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [sold, setSold] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<Tier | 'new' | null>(null);
  const [preset, setPreset] = useState<{ name: string; price: number } | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('event_ticket_tiers').select('*').eq('event_id', event.id).order('sort_order').order('price').order('created_at');
    const list = (data ?? []) as Tier[];
    setTiers(list);
    if (list.length) {
      const { data: t } = await supabase.from('tickets').select('tier_id, quantity').eq('event_id', event.id).in('status', ['confirmed', 'used']).not('tier_id', 'is', null);
      const m: Record<string, number> = {};
      (t ?? []).forEach((r) => { m[r.tier_id as string] = (m[r.tier_id as string] ?? 0) + Math.max(Number(r.quantity) || 1, 1); });
      setSold(m);
    }
  }, [event.id]);
  useEffect(() => { load(); }, [load]);

  const active = tiers.filter((t) => t.active);
  const totalSold = Object.values(sold).reduce((a, b) => a + b, 0);

  return (
    <div className="mt-2">
      <p className="text-sm text-muted">
        Offer several ticket types, each with its own price, quantity and sales dates. {active.length > 0 ? <>These replace the single ticket price on <Link to={`/events/${event.id}`} className="font-medium text-marigold">your event page</Link>.</> : 'Until you add one, your event keeps its single ticket price.'}
      </p>
      {totalSold > 0 && <p className="mt-1 text-sm font-medium text-bone">{totalSold} sold across all tiers</p>}

      {tiers.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-gray-300 p-5">
          <p className="text-sm font-medium text-bone">Start with a common tier</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {PRESETS.map((p) => <button key={p.name} onClick={() => { setPreset(p); setEditing('new'); }} className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:border-marigold">{p.name}</button>)}
            <button onClick={() => { setPreset(null); setEditing('new'); }} className="rounded-full bg-[#0F1B3D] px-3 py-1.5 text-sm font-semibold text-white">+ Custom tier</button>
          </div>
        </div>
      ) : (
        <>
          <ul className="mt-4 flex flex-col gap-2">
            {tiers.map((t) => {
              const s = sold[t.id] ?? 0;
              const pct = t.quantity ? Math.min(100, Math.round((s / t.quantity) * 100)) : 0;
              const now = Date.now();
              const state = !t.active ? 'Hidden' : t.quantity && s >= t.quantity ? 'Sold out' : t.sales_start && new Date(t.sales_start).getTime() > now ? `Starts ${new Date(t.sales_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : t.sales_end && new Date(t.sales_end).getTime() <= now ? 'Ended' : 'On sale';
              return (
                <li key={t.id}>
                  <button onClick={() => setEditing(t)} className={`w-full rounded-xl border border-gray-200 bg-surface p-3 text-left hover:border-marigold ${t.active ? '' : 'opacity-60'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0"><span className="block truncate font-semibold text-bone">{t.name}</span><span className="text-xs text-muted">{Number(t.price) > 0 ? money(t.price) : 'Free'} · {state}{t.sales_end && state === 'On sale' ? ` · ends ${new Date(t.sales_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}</span></span>
                      <span className="shrink-0 text-right text-sm font-semibold text-bone">{s}{t.quantity ? <span className="font-normal text-muted"> / {t.quantity}</span> : ''}<span className="block text-[11px] font-normal text-muted">sold</span></span>
                    </div>
                    {t.quantity ? <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200"><div className="h-full rounded-full bg-marigold" style={{ width: `${pct}%` }} /></div> : null}
                  </button>
                </li>
              );
            })}
          </ul>
          <button onClick={() => { setPreset(null); setEditing('new'); }} className="mt-3 rounded-xl bg-[#0F1B3D] px-4 py-2.5 text-sm font-bold text-white">+ Add tier</button>
        </>
      )}
      {(event.event_type !== 'free' || tiers.some((t) => Number(t.price) > 0)) ? (
        <PromoCodes eventId={event.id} tiers={tiers.filter((t) => t.active).map((t) => ({ id: t.id, name: t.name, price: Number(t.price) }))} onChanged={load} />
      ) : (
        <p className="mt-8 rounded-xl border border-dashed border-gray-300 p-4 text-sm text-muted">Promo codes are for paid tickets. Add a paid ticket type (or set a ticket price) to create codes.</p>
      )}
      {tiers.length === 0 && event.event_type !== 'free' && <p className="mt-2 text-xs text-muted">Adding your first code turns your ticket price into a "General Admission" ticket type at the same price, so the code works at checkout.</p>}
      <p className="mt-4 text-xs text-muted">Attendees pay the same service fees as today (3.7% + $1.79 per paid ticket, plus 2.9% processing). You keep 100% of the ticket price. Your event's overall capacity still applies across all tiers.</p>

      {editing && <TierSheet event={event} tier={editing === 'new' ? null : editing} preset={preset} soldCount={editing === 'new' ? 0 : sold[editing.id] ?? 0} nextSort={tiers.length} onClose={() => setEditing(null)} onSaved={load} />}
    </div>
  );
}

function TierSheet({ event, tier, preset, soldCount, nextSort, onClose, onSaved }: { event: TapEvent; tier: Tier | null; preset: { name: string; price: number } | null; soldCount: number; nextSort: number; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    name: tier?.name ?? preset?.name ?? '', description: tier?.description ?? '', price: tier ? String(tier.price) : preset ? String(preset.price) : '',
    quantity: tier?.quantity ? String(tier.quantity) : '', sales_start: toLocal(tier?.sales_start ?? null), sales_end: toLocal(tier?.sales_end ?? null),
    max_per_order: String(tier?.max_per_order ?? 10), active: tier?.active ?? true,
  });
  const [err, setErr] = useState<string | null>(null);
  async function save() {
    const price = f.price === '' ? 0 : Number(f.price);
    if (!f.name.trim()) return setErr('Give the tier a name.');
    if (!Number.isFinite(price) || price < 0 || price > 10000) return setErr('Enter a price between $0 and $10,000.');
    const quantity = f.quantity ? parseInt(f.quantity, 10) : null;
    if (quantity !== null && (!quantity || quantity < 1)) return setErr('Quantity must be at least 1, or leave it blank for no limit.');
    if (quantity !== null && quantity < soldCount) return setErr(`${soldCount} already sold, so the quantity can't be lower than that.`);
    if (f.sales_start && f.sales_end && f.sales_end <= f.sales_start) return setErr('Sales must end after they start.');
    const maxPer = Math.min(50, Math.max(1, parseInt(f.max_per_order, 10) || 10));
    const row = { event_id: event.id, name: f.name.trim(), description: f.description.trim() || null, price: Math.round(price * 100) / 100, quantity, sales_start: fromLocal(f.sales_start), sales_end: fromLocal(f.sales_end), max_per_order: maxPer, active: f.active, ...(tier ? {} : { sort_order: nextSort }) };
    const { error } = tier ? await supabase.from('event_ticket_tiers').update(row).eq('id', tier.id) : await supabase.from('event_ticket_tiers').insert(row);
    if (error) return setErr("Couldn't save the tier.");
    onSaved(); onClose();
  }
  async function remove() {
    if (!tier) return;
    if (soldCount > 0) { await supabase.from('event_ticket_tiers').update({ active: false }).eq('id', tier.id); }
    else { await supabase.from('event_ticket_tiers').delete().eq('id', tier.id); }
    onSaved(); onClose();
  }
  return (
    <Sheet title={tier ? 'Edit tier' : 'Add a ticket tier'} onClose={onClose} wide>
      <label className="block text-xs font-medium text-gray-500">Name<input className={field} value={f.name} maxLength={80} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="VIP" autoFocus /></label>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="text-xs font-medium text-gray-500">Price ($)<input className={field} inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value.replace(/[^0-9.]/g, '') })} placeholder="0 for free" /></label>
        <label className="text-xs font-medium text-gray-500">Quantity<input className={field} inputMode="numeric" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value.replace(/\D/g, '') })} placeholder="No limit" /></label>
        <label className="text-xs font-medium text-gray-500">Sales start (optional)<input type="datetime-local" className={field} value={f.sales_start} onChange={(e) => setF({ ...f, sales_start: e.target.value })} /></label>
        <label className="text-xs font-medium text-gray-500">Sales end (optional)<input type="datetime-local" className={field} value={f.sales_end} onChange={(e) => setF({ ...f, sales_end: e.target.value })} /></label>
        <label className="text-xs font-medium text-gray-500">Max per order<input className={field} inputMode="numeric" value={f.max_per_order} onChange={(e) => setF({ ...f, max_per_order: e.target.value.replace(/\D/g, '') })} /></label>
      </div>
      <label className="mt-3 block text-xs font-medium text-gray-500">What's included (optional)<textarea rows={2} className={field} value={f.description} maxLength={500} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Front-row seating, meet & greet, gift bag" /></label>
      <label className="mt-3 flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} className="h-4 w-4 accent-marigold" /> Show this tier on the event page</label>
      {soldCount > 0 && <p className="mt-2 text-xs text-gray-500">{soldCount} sold. Price changes only apply to new purchases.</p>}
      {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
      <div className="mt-5 flex items-center justify-between">
        {tier ? <button onClick={remove} className="text-sm text-gray-400 hover:text-red-600">{soldCount > 0 ? 'Hide tier' : 'Delete'}</button> : <span />}
        <button onClick={save} className="rounded-xl bg-[#0F1B3D] px-5 py-2.5 text-sm font-bold text-white">Save</button>
      </div>
    </Sheet>
  );
}
