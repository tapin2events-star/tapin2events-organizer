import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Sheet from '../scouting/Sheet';

interface Code { id: string; code: string; kind: 'percent' | 'amount'; value: number; max_uses: number | null; uses: number; starts_at: string | null; ends_at: string | null; tier_ids: string[] | null; active: boolean; note: string | null }
const toLocal = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso); const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const field = 'mt-1 block w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900';
const money = (n: number) => `$${Number(n).toFixed(2).replace(/\.00$/, '')}`;
const describe = (c: Pick<Code, 'kind' | 'value'>) => (c.kind === 'percent' ? (Number(c.value) === 100 ? 'Free (100% off)' : `${Number(c.value)}% off`) : `${money(c.value)} off each ticket`);
const randomCode = () => Array.from({ length: 8 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

// Tickets tab > Promo codes: discounts and comps for ticket tiers.
export default function PromoCodes({ eventId, tiers, onChanged }: { eventId: string; tiers: { id: string; name: string; price: number }[]; onChanged?: () => void }) {
  const [codes, setCodes] = useState<Code[]>([]);
  const [editing, setEditing] = useState<Code | 'new' | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const load = useCallback(async () => {
    const { data } = await supabase.rpc('event_promo_codes', { p_event_id: eventId });
    setCodes(((data ?? []) as Code[]).map((c) => ({ ...c, value: Number(c.value) })));
  }, [eventId]);
  useEffect(() => { load(); }, [load]);
  const paidTiers = tiers.filter((t) => Number(t.price) > 0);

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-lg font-bold text-bone">Promo codes</h3>
          <p className="text-sm text-muted">Discounts for early supporters, sponsors and partners, or free comps for staff and press.</p>
        </div>
        <button onClick={() => setEditing('new')} disabled={paidTiers.length === 0} className="rounded-xl bg-[#0F1B3D] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">+ New code</button>
      </div>
      {paidTiers.length === 0 && <p className="mt-2 text-xs text-muted">Add a paid ticket type first; codes discount paid tickets.</p>}
      {codes.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {codes.map((c) => {
            const expired = c.ends_at && new Date(c.ends_at).getTime() <= Date.now();
            const usedUp = c.max_uses !== null && c.uses >= c.max_uses;
            const state = !c.active ? 'Off' : expired ? 'Expired' : usedUp ? 'Used up' : c.starts_at && new Date(c.starts_at).getTime() > Date.now() ? 'Scheduled' : 'Active';
            return (
              <li key={c.id} className={`flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-surface p-3 ${state === 'Active' ? '' : 'opacity-70'}`}>
                <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(c.code); setCopied(c.id); setTimeout(() => setCopied(null), 1500); } catch { /* shown on screen to copy by hand */ } }}
                  className="rounded-lg border border-dashed border-gray-400 bg-white px-2.5 py-1 font-mono text-sm font-bold tracking-wider text-gray-900" title="Copy code">{copied === c.id ? 'Copied!' : c.code}</button>
                <span className="min-w-0 flex-1 text-sm">
                  <span className="block font-medium text-bone">{describe(c)}{c.tier_ids ? ` · ${c.tier_ids.map((id) => tiers.find((t) => t.id === id)?.name).filter(Boolean).join(', ')}` : ''}</span>
                  <span className="block text-xs text-muted">{state} · used {c.uses}{c.max_uses ? ` of ${c.max_uses}` : ''}{c.ends_at ? ` · ends ${new Date(c.ends_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}{c.note ? ` · ${c.note}` : ''}</span>
                </span>
                <button onClick={() => setEditing(c)} className="text-sm font-medium text-marigold">Edit</button>
              </li>
            );
          })}
        </ul>
      )}
      {editing && <CodeSheet eventId={eventId} code={editing === 'new' ? null : editing} tiers={paidTiers} onClose={() => setEditing(null)} onSaved={() => { load(); onChanged?.(); }} />}
    </section>
  );
}

function CodeSheet({ eventId, code, tiers, onClose, onSaved }: { eventId: string; code: Code | null; tiers: { id: string; name: string }[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    code: code?.code ?? randomCode(), kind: code?.kind ?? 'percent' as 'percent' | 'amount', value: code ? String(code.value) : '20',
    max_uses: code?.max_uses ? String(code.max_uses) : '', starts_at: toLocal(code?.starts_at ?? null), ends_at: toLocal(code?.ends_at ?? null),
    all: !code?.tier_ids, tier_ids: code?.tier_ids ?? [] as string[], active: code?.active ?? true, note: code?.note ?? '',
  });
  const [err, setErr] = useState<string | null>(null);
  async function save() {
    const c = f.code.trim().toUpperCase();
    const v = Number(f.value);
    if (!/^[A-Z0-9_-]{3,30}$/.test(c)) return setErr('Codes are 3–30 letters, numbers, dashes or underscores.');
    if (!Number.isFinite(v) || v <= 0 || (f.kind === 'percent' && v > 100)) return setErr(f.kind === 'percent' ? 'Enter a percent from 1 to 100.' : 'Enter a dollar amount above $0.');
    if (!f.all && f.tier_ids.length === 0) return setErr('Pick at least one ticket type, or choose all ticket types.');
    if (f.starts_at && f.ends_at && f.ends_at <= f.starts_at) return setErr('The end must be after the start.');
    if (f.max_uses && parseInt(f.max_uses, 10) < (code?.uses ?? 0)) return setErr(`It's already been used ${code?.uses} times.`);
    const row = { event_id: eventId, code: c, kind: f.kind, value: Math.round(v * 100) / 100, max_uses: f.max_uses ? parseInt(f.max_uses, 10) : null,
      starts_at: f.starts_at ? new Date(f.starts_at).toISOString() : null, ends_at: f.ends_at ? new Date(f.ends_at).toISOString() : null,
      tier_ids: f.all ? null : f.tier_ids, active: f.active, note: f.note.trim() || null };
    const { error } = code ? await supabase.from('promo_codes').update(row).eq('id', code.id) : await supabase.from('promo_codes').insert(row);
    if (error) return setErr(/duplicate|unique/i.test(error.message) ? 'That code already exists for this event.' : /paid tickets/i.test(error.message) ? error.message : "Couldn't save the code.");
    onSaved(); onClose();
  }
  return (
    <Sheet title={code ? 'Edit promo code' : 'New promo code'} onClose={onClose} wide>
      <label className="block text-xs font-medium text-gray-500">Code
        <div className="flex gap-2"><input className={`${field} font-mono uppercase tracking-wider`} value={f.code} maxLength={30} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })} />
          {!code && <button type="button" onClick={() => setF({ ...f, code: randomCode() })} className="mt-1 shrink-0 rounded-xl border border-gray-300 px-3 text-sm text-gray-700">New</button>}</div>
      </label>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="min-w-0 text-xs font-medium text-gray-500">Discount type
          <select className={field} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as 'percent' | 'amount' })}><option value="percent">Percent off</option><option value="amount">Dollars off each ticket</option></select>
        </label>
        <label className="min-w-0 text-xs font-medium text-gray-500">{f.kind === 'percent' ? 'Percent (100 = free)' : 'Amount ($)'}
          <input className={field} inputMode="decimal" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value.replace(/[^0-9.]/g, '') })} />
        </label>
        <label className="min-w-0 text-xs font-medium text-gray-500">Starts (optional)<input type="datetime-local" className={field} value={f.starts_at} onChange={(e) => setF({ ...f, starts_at: e.target.value })} /></label>
        <label className="min-w-0 text-xs font-medium text-gray-500">Ends (optional)<input type="datetime-local" className={field} value={f.ends_at} onChange={(e) => setF({ ...f, ends_at: e.target.value })} /></label>
        <label className="min-w-0 text-xs font-medium text-gray-500">Use limit (optional)<input className={field} inputMode="numeric" value={f.max_uses} onChange={(e) => setF({ ...f, max_uses: e.target.value.replace(/\D/g, '') })} placeholder="Unlimited" /></label>
        <label className="min-w-0 text-xs font-medium text-gray-500">Note for you (optional)<input className={field} value={f.note} maxLength={200} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="For sponsors" /></label>
      </div>
      <div className="mt-3 text-xs font-medium text-gray-500">Works on
        <div className="mt-1 flex flex-wrap gap-2">
          <button type="button" onClick={() => setF({ ...f, all: true })} className={`rounded-full px-3 py-1.5 text-sm ${f.all ? 'bg-[#0F1B3D] text-white' : 'border border-gray-300 bg-white text-gray-700'}`}>All paid tickets</button>
          {tiers.map((t) => {
            const on = !f.all && f.tier_ids.includes(t.id);
            return <button type="button" key={t.id} onClick={() => setF({ ...f, all: false, tier_ids: on ? f.tier_ids.filter((x) => x !== t.id) : [...f.tier_ids.filter(() => !f.all), t.id] })} className={`rounded-full px-3 py-1.5 text-sm ${on ? 'bg-[#0F1B3D] text-white' : 'border border-gray-300 bg-white text-gray-700'}`}>{t.name}</button>;
          })}
        </div>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} className="h-4 w-4 accent-marigold" /> Code is on</label>
      <p className="mt-2 text-xs text-gray-500">{describe({ kind: f.kind, value: Number(f.value) || 0 })}. Buyers enter it under "Have a promo code?" on your event page. Service fees are figured on the discounted price; fully free orders have no fees.</p>
      {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
      <div className="mt-5 flex items-center justify-between">
        {code ? (code.uses === 0
          ? <button onClick={async () => { await supabase.from('promo_codes').delete().eq('id', code.id); onSaved(); onClose(); }} className="text-sm text-gray-400 hover:text-red-600">Delete</button>
          : <span className="text-xs text-gray-400">Used {code.uses} times; turn it off instead of deleting.</span>) : <span />}
        <button onClick={save} className="rounded-xl bg-[#0F1B3D] px-5 py-2.5 text-sm font-bold text-white">Save</button>
      </div>
    </Sheet>
  );
}
