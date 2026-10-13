import { useState } from 'react';

// Promo codes while creating an event (saved right after the event is created).
export interface PendingCode { code: string; kind: 'percent' | 'amount'; value: string; max_uses: string; ends_at: string }
const randomCode = () => 'SAVE' + Math.random().toString(36).slice(2, 6).toUpperCase();

export function codeProblem(c: PendingCode): string | null {
  const v = Number(c.value);
  if (!/^[A-Z0-9_-]{3,30}$/.test(c.code.trim().toUpperCase())) return 'Promo codes are 3–30 letters, numbers, dashes or underscores.';
  if (!Number.isFinite(v) || v <= 0 || (c.kind === 'percent' && v > 100)) return c.kind === 'percent' ? 'Promo code percent must be 1 to 100.' : 'Promo code amount must be above $0.';
  return null;
}
export const pendingRow = (eventId: string, c: PendingCode) => ({
  event_id: eventId, code: c.code.trim().toUpperCase(), kind: c.kind, value: Math.round(Number(c.value) * 100) / 100,
  max_uses: c.max_uses ? parseInt(c.max_uses, 10) : null, ends_at: c.ends_at ? new Date(`${c.ends_at}T23:59:00`).toISOString() : null, active: true,
});

export default function FormPromoCodes({ codes, onChange, inputClass }: { codes: PendingCode[]; onChange: (c: PendingCode[]) => void; inputClass: string }) {
  const [open, setOpen] = useState(codes.length > 0);
  const set = (i: number, patch: Partial<PendingCode>) => onChange(codes.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  if (!open) return (
    <button type="button" onClick={() => { setOpen(true); if (codes.length === 0) onChange([{ code: randomCode(), kind: 'percent', value: '15', max_uses: '', ends_at: '' }]); }}
      className="min-h-[44px] w-full rounded-xl border border-dashed border-gray-300 text-sm font-semibold text-marigold">🏷️ Add a promo code</button>
  );
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 sm:p-4">
      <p className="text-sm font-semibold text-bone">🏷️ Promo codes</p>
      <p className="text-xs text-muted">Buyers enter these at checkout for a discount. Great for past attendees, partners or early birds.</p>
      {codes.map((c, i) => (
        <div key={i} className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="block min-w-0 text-xs font-medium text-gray-500">Code
              <input value={c.code} maxLength={30} onChange={(e) => set(i, { code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })} className={`${inputClass} uppercase tracking-wide`} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block min-w-0 text-xs font-medium text-gray-500">Discount
                <select value={c.kind} onChange={(e) => set(i, { kind: e.target.value as PendingCode['kind'] })} className={inputClass}>
                  <option value="percent">% off</option><option value="amount">$ off</option>
                </select>
              </label>
              <label className="block min-w-0 text-xs font-medium text-gray-500">{c.kind === 'percent' ? 'Percent' : 'Dollars'}
                <input value={c.value} inputMode="decimal" onChange={(e) => set(i, { value: e.target.value.replace(/[^0-9.]/g, '') })} className={inputClass} />
              </label>
            </div>
            <label className="block min-w-0 text-xs font-medium text-gray-500">Limit uses (optional)
              <input value={c.max_uses} inputMode="numeric" placeholder="Unlimited" onChange={(e) => set(i, { max_uses: e.target.value.replace(/\D/g, '') })} className={inputClass} />
            </label>
            <label className="block min-w-0 text-xs font-medium text-gray-500">Ends (optional)
              <input type="date" value={c.ends_at} onChange={(e) => set(i, { ends_at: e.target.value })} className={`${inputClass} h-12 appearance-none`} />
            </label>
          </div>
          <button type="button" onClick={() => onChange(codes.filter((_, j) => j !== i))} className="mt-2 text-xs text-gray-500 hover:text-red-600">Remove</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...codes, { code: randomCode(), kind: 'percent', value: '10', max_uses: '', ends_at: '' }])} className="mt-3 text-sm font-semibold text-marigold">+ Add another code</button>
      <p className="mt-2 text-xs text-muted">You can limit codes to certain ticket types, set start dates and see how often they're used from the event's Tickets tab.</p>
    </div>
  );
}
