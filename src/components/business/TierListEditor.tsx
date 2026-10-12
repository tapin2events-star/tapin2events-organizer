import { useState } from 'react';
import { newDraft, type TierDraft } from '../../lib/tiers';

const PRESETS = [{ name: 'General Admission', price: '25' }, { name: 'VIP', price: '75' }, { name: 'Early Bird', price: '15' }, { name: 'Student', price: '10' }];

// Inline ticket-type editor used in the create/edit event form.
export default function TierListEditor({ drafts, onChange, sold, inputClass }: { drafts: TierDraft[]; onChange: (d: TierDraft[]) => void; sold: Record<string, number>; inputClass: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const set = (key: string, patch: Partial<TierDraft>) => onChange(drafts.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const move = (i: number, dir: -1 | 1) => { const n = [...drafts]; const j = i + dir; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; onChange(n); };
  const used = new Set(drafts.map((d) => d.name.trim().toLowerCase()));
  return (
    <div className="mt-3 flex flex-col gap-3">
      {drafts.map((d, i) => {
        const s = d.id ? sold[d.id] ?? 0 : 0;
        return (
          <div key={d.key} className={`rounded-xl border border-gray-200 bg-white p-3 ${d.active ? '' : 'opacity-60'}`}>
            <div className="grid grid-cols-[1fr_5.5rem_5.5rem] gap-2">
              <label className="text-[11px] font-medium text-gray-500">Name<input value={d.name} maxLength={80} onChange={(e) => set(d.key, { name: e.target.value })} placeholder="General Admission" className={inputClass} /></label>
              <label className="text-[11px] font-medium text-gray-500">Price ($)<input value={d.price} inputMode="decimal" onChange={(e) => set(d.key, { price: e.target.value.replace(/[^0-9.]/g, '') })} placeholder="Free" className={inputClass} /></label>
              <label className="text-[11px] font-medium text-gray-500">Quantity<input value={d.quantity} inputMode="numeric" onChange={(e) => set(d.key, { quantity: e.target.value.replace(/\D/g, '') })} placeholder="No limit" className={inputClass} /></label>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <button type="button" onClick={() => setOpen(open === d.key ? null : d.key)} className="font-medium text-marigold">{open === d.key ? 'Fewer options' : 'Sales dates, limit & details'}</button>
              {s > 0 && <span className="text-gray-500">{s} sold</span>}
              {(d.sales_start || d.sales_end) && open !== d.key && <span className="text-gray-500">{d.sales_end ? `Ends ${new Date(d.sales_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : `Starts ${new Date(d.sales_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}</span>}
              <span className="ml-auto flex items-center gap-3">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="text-gray-400 disabled:opacity-30">↑</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === drafts.length - 1} aria-label="Move down" className="text-gray-400 disabled:opacity-30">↓</button>
                {s > 0
                  ? <button type="button" onClick={() => set(d.key, { active: !d.active })} className="text-gray-500 hover:text-gray-800">{d.active ? 'Hide' : 'Show'}</button>
                  : <button type="button" onClick={() => onChange(drafts.filter((x) => x.key !== d.key))} className="text-gray-400 hover:text-red-600">Remove</button>}
              </span>
            </div>
            {open === d.key && (
              <div className="mt-2 grid gap-2 border-t border-gray-100 pt-2 sm:grid-cols-3">
                <label className="text-[11px] font-medium text-gray-500">Sales start<input type="datetime-local" value={d.sales_start} onChange={(e) => set(d.key, { sales_start: e.target.value })} className={inputClass} /></label>
                <label className="text-[11px] font-medium text-gray-500">Sales end<input type="datetime-local" value={d.sales_end} onChange={(e) => set(d.key, { sales_end: e.target.value })} className={inputClass} /></label>
                <label className="text-[11px] font-medium text-gray-500">Max per order<input value={d.max_per_order} inputMode="numeric" onChange={(e) => set(d.key, { max_per_order: e.target.value.replace(/\D/g, '') })} className={inputClass} /></label>
                <label className="text-[11px] font-medium text-gray-500 sm:col-span-3">What's included (optional)<input value={d.description} maxLength={500} onChange={(e) => set(d.key, { description: e.target.value })} placeholder="Front-row seating, meet & greet, gift bag" className={inputClass} /></label>
              </div>
            )}
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => onChange([...drafts, newDraft()])} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-marigold">+ Add ticket type</button>
        {PRESETS.filter((p) => !used.has(p.name.toLowerCase())).map((p) => (
          <button type="button" key={p.name} onClick={() => onChange([...drafts, newDraft(p.name, p.price)])} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-200">+ {p.name}</button>
        ))}
      </div>
    </div>
  );
}
