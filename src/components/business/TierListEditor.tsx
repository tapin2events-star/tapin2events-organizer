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
          <div key={d.key} className={`rounded-2xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4 ${d.active ? '' : 'opacity-60'}`}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_6.5rem_6.5rem]">
              <label className="col-span-2 text-xs font-medium text-gray-500 sm:col-span-1">Name<input value={d.name} maxLength={80} onChange={(e) => set(d.key, { name: e.target.value })} placeholder="General Admission" className={inputClass} /></label>
              <label className="text-xs font-medium text-gray-500">Price ($)<input value={d.price} inputMode="decimal" onChange={(e) => set(d.key, { price: e.target.value.replace(/[^0-9.]/g, '') })} placeholder="Free" className={inputClass} /></label>
              <label className="text-xs font-medium text-gray-500">Quantity<input value={d.quantity} inputMode="numeric" onChange={(e) => set(d.key, { quantity: e.target.value.replace(/\D/g, '') })} placeholder="No limit" className={inputClass} /></label>
            </div>
            {(s > 0 || ((d.sales_start || d.sales_end) && open !== d.key)) && (
              <p className="mt-1.5 text-xs text-gray-500">
                {s > 0 ? `${s} sold` : ''}{s > 0 && (d.sales_start || d.sales_end) && open !== d.key ? ' · ' : ''}
                {(d.sales_start || d.sales_end) && open !== d.key ? (d.sales_end ? `Sales end ${new Date(d.sales_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : `Sales start ${new Date(d.sales_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`) : ''}
              </p>
            )}
            <div className="mt-2 flex items-center gap-1 border-t border-gray-100 pt-2">
              <button type="button" onClick={() => setOpen(open === d.key ? null : d.key)} aria-expanded={open === d.key}
                className="-ml-1 flex min-h-[40px] items-center gap-1 rounded-lg px-1 text-sm font-medium text-marigold">
                {open === d.key ? 'Fewer options' : 'More options'}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`transition-transform ${open === d.key ? 'rotate-180' : ''}`} aria-hidden="true"><path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <span className="ml-auto flex items-center">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 active:bg-gray-100 disabled:opacity-25">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M18 15l-6-6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === drafts.length - 1} aria-label="Move down" className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 active:bg-gray-100 disabled:opacity-25">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                {s > 0
                  ? <button type="button" onClick={() => set(d.key, { active: !d.active })} className="min-h-[40px] rounded-lg px-2 text-sm font-medium text-gray-600 active:bg-gray-100">{d.active ? 'Hide' : 'Show'}</button>
                  : <button type="button" onClick={() => onChange(drafts.filter((x) => x.key !== d.key))} aria-label={`Remove ${d.name || 'ticket type'}`} className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 active:bg-red-50 active:text-red-600">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>}
              </span>
            </div>
            {open === d.key && (
              <div className="mt-1 grid gap-3 pb-1 sm:grid-cols-2">
                <label className="text-xs font-medium text-gray-500">Sales start <span className="font-normal text-gray-400">(optional)</span><input type="datetime-local" value={d.sales_start} onChange={(e) => set(d.key, { sales_start: e.target.value })} className={inputClass} /></label>
                <label className="text-xs font-medium text-gray-500">Sales end <span className="font-normal text-gray-400">(optional)</span><input type="datetime-local" value={d.sales_end} onChange={(e) => set(d.key, { sales_end: e.target.value })} className={inputClass} /></label>
                <label className="text-xs font-medium text-gray-500">Max per order<input value={d.max_per_order} inputMode="numeric" onChange={(e) => set(d.key, { max_per_order: e.target.value.replace(/\D/g, '') })} className={inputClass} /></label>
                <label className="text-xs font-medium text-gray-500 sm:col-span-2">What's included <span className="font-normal text-gray-400">(optional)</span><input value={d.description} maxLength={500} onChange={(e) => set(d.key, { description: e.target.value })} placeholder="Front-row seating, meet & greet, gift bag" className={inputClass} /></label>
              </div>
            )}
          </div>
        );
      })}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <button type="button" onClick={() => onChange([...drafts, newDraft()])} className="min-h-[44px] rounded-xl border border-dashed border-gray-400 bg-white px-4 text-sm font-semibold text-gray-700 active:bg-gray-50 sm:min-h-0 sm:py-2">+ Add ticket type</button>
        <div className="flex flex-wrap gap-2">
          {PRESETS.filter((p) => !used.has(p.name.toLowerCase())).map((p) => (
            <button type="button" key={p.name} onClick={() => onChange([...drafts, newDraft(p.name, p.price)])} className="min-h-[36px] rounded-full bg-white px-3 text-sm text-gray-600 ring-1 ring-gray-200 active:bg-gray-100">+ {p.name}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
