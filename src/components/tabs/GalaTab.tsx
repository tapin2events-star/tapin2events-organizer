import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Sheet from '../scouting/Sheet';
import { ListSkeleton } from '../ui/Skeleton';
import PremiumBadge from '../business/PremiumBadge';
import { downloadCsv, fileSlug } from '../../lib/csv';
import type { TapEvent } from '../../lib/types';

interface Table { id: string; name: string; seats: number; note: string | null; used: number }
interface Party { email: string; name: string | null; qty: number; table_id: string | null; seated_section: string | null; paddle: number | null }
interface Pledge { id: string; paddle: number | null; amount: number; label: string | null; name: string | null; created_at: string }
interface Overview { seated: boolean; tables: Table[]; parties: Party[]; pledges: Pledge[]; pledged: number }
const money = (n: number) => `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
const field = 'mt-1 block w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900';
const PRESETS = [100, 250, 500, 1000, 2500, 5000];

// Event dashboard > Gala (Preview, Business plan): tables and seating, paddle numbers, and the paddle raise.
export default function GalaTab({ event }: { event: TapEvent }) {
  const [o, setO] = useState<Overview | null>(null);
  const [view, setView] = useState<'tables' | 'paddles' | 'raise'>('tables');
  const [msg, setMsg] = useState<string | null>(null);
  const [tableSheet, setTableSheet] = useState<Table | 'new' | 'bulk' | null>(null);
  const load = useCallback(async () => {
    const { data } = await supabase.rpc('gala_overview', { p_event_id: event.id });
    const d = data as Overview | null;
    setO(d ? { ...d, pledged: Number(d.pledged), tables: d.tables.map((t) => ({ ...t, used: Number(t.used) })), parties: d.parties.map((p) => ({ ...p, qty: Number(p.qty) })), pledges: d.pledges.map((p) => ({ ...p, amount: Number(p.amount) })) } : null);
  }, [event.id]);
  useEffect(() => { load(); }, [load]);
  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(null), 3000); };
  if (!o) return <ListSkeleton rows={4} className="mt-4" />;

  const guests = o.parties.reduce((n, p) => n + p.qty, 0);
  const unseated = o.parties.filter((p) => !p.table_id && !p.seated_section);
  return (
    <div>
      <p className="flex flex-wrap items-center gap-2 font-display text-lg font-bold text-bone">🥂 Gala <PremiumBadge feature="gala" /></p>
      <p className="text-sm text-muted">Seat your guests, give out paddle numbers, and run the paddle raise. Guests see their table and paddle number on their ticket.</p>
      {msg && <p role="status" className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">{msg}</p>}

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border border-gray-200 bg-surface p-3"><p className="text-xl font-extrabold text-bone">{guests}</p><p className="text-xs text-muted">guests</p></div>
        <div className="rounded-xl border border-gray-200 bg-surface p-3"><p className="text-xl font-extrabold text-bone">{o.parties.filter((p) => p.paddle).length}</p><p className="text-xs text-muted">paddles</p></div>
        <div className="rounded-xl border border-gray-200 bg-surface p-3"><p className="text-xl font-extrabold text-green-700">{money(o.pledged)}</p><p className="text-xs text-muted">pledged</p></div>
      </div>

      <div className="mt-4 flex gap-1.5">
        {([['tables', '🪑 Tables'], ['paddles', '🔢 Paddles'], ['raise', '🙌 Paddle raise']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setView(k)} aria-pressed={view === k} className={`rounded-full px-4 py-2 text-sm font-semibold ${view === k ? 'bg-[#0F1B3D] text-white' : 'border border-gray-200 bg-white text-gray-700'}`}>{l}</button>
        ))}
      </div>

      {view === 'tables' && (o.seated ? (
        <div className="mt-4 rounded-2xl border border-gray-200 bg-surface p-4 text-sm">
          <p className="font-semibold text-bone">This event uses reserved seating</p>
          <p className="mt-1 text-muted">Guests choose their tables and seats when they buy, so there's nothing to assign here. Where each party sits:</p>
          <ul className="mt-3 flex flex-col gap-1">{o.parties.map((p) => <li key={p.email} className="flex justify-between gap-2"><span className="truncate text-bone">{p.name || p.email} ({p.qty})</span><span className="shrink-0 text-muted">{p.seated_section || 'Not seated'}</span></li>)}</ul>
        </div>
      ) : (
        <TablesView event={event} o={o} unseated={unseated} onEdit={setTableSheet} onChanged={load} flash={flash} />
      ))}
      {view === 'paddles' && <PaddlesView event={event} o={o} onChanged={load} flash={flash} />}
      {view === 'raise' && <RaiseView event={event} o={o} onChanged={load} flash={flash} />}

      {tableSheet && <TableSheet event={event} table={typeof tableSheet === 'object' ? tableSheet : null} bulk={tableSheet === 'bulk'} onClose={() => setTableSheet(null)} onSaved={() => { setTableSheet(null); load(); }} />}
    </div>
  );
}

function TablesView({ event, o, unseated, onEdit, onChanged, flash }: { event: TapEvent; o: Overview; unseated: Party[]; onEdit: (t: Table | 'new' | 'bulk') => void; onChanged: () => void; flash: (t: string) => void }) {
  async function assign(email: string, tableId: string | null) {
    await supabase.rpc('assign_gala_table', { p_event_id: event.id, p_email: email, p_table_id: tableId });
    onChanged();
  }
  async function auto() {
    const { data } = await supabase.rpc('auto_assign_gala_tables', { p_event_id: event.id });
    flash(Number(data) ? `Seated ${data} part${Number(data) === 1 ? 'y' : 'ies'}. Parties stay together.` : 'No open seats fit the remaining parties. Add a table or adjust seats.');
    onChanged();
  }
  async function del(t: Table) {
    if (!window.confirm(`Delete ${t.name}? Anyone seated there becomes unseated.`)) return;
    await supabase.rpc('delete_gala_table', { p_table_id: t.id }); onChanged();
  }
  const seatsTotal = o.tables.reduce((n, t) => n + t.seats, 0);
  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => onEdit('bulk')} className="rounded-xl bg-[#0F1B3D] px-3 py-2 text-sm font-semibold text-white">+ Add tables</button>
        <button onClick={() => onEdit('new')} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700">+ One table</button>
        {unseated.length > 0 && o.tables.length > 0 && <button onClick={auto} className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">Auto-seat {unseated.length} part{unseated.length === 1 ? 'y' : 'ies'}</button>}
      </div>
      {o.tables.length > 0 && <p className="mt-2 text-xs text-muted">{o.tables.length} tables · {seatsTotal} seats · {o.tables.reduce((n, t) => n + t.used, 0)} filled</p>}

      {unseated.length > 0 && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-3">
          <p className="text-sm font-semibold text-amber-900">Not seated yet ({unseated.reduce((n, p) => n + p.qty, 0)} guests)</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {unseated.map((p) => (
              <li key={p.email} className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-sm">
                <span className="min-w-0 truncate text-gray-900">{p.name || p.email} <span className="text-gray-500">· party of {p.qty}</span></span>
                {o.tables.length > 0 && (
                  <select value="" onChange={(e) => e.target.value && assign(p.email, e.target.value)} aria-label={`Seat ${p.name || p.email}`} className="shrink-0 rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm">
                    <option value="">Seat at…</option>
                    {o.tables.map((t) => <option key={t.id} value={t.id} disabled={t.seats - t.used < p.qty}>{t.name} ({t.seats - t.used} open)</option>)}
                  </select>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {o.tables.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-muted">No tables yet. Add tables (like 10 tables of 8), then seat parties by hand or tap Auto-seat.</p>
      ) : (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {o.tables.map((t) => {
            const at = o.parties.filter((p) => p.table_id === t.id);
            const full = t.used >= t.seats;
            return (
              <li key={t.id} className="rounded-2xl border border-gray-200 bg-surface p-3">
                <div className="flex items-start justify-between gap-2">
                  <button onClick={() => onEdit(t)} className="min-w-0 text-left"><span className="block font-semibold text-bone">{t.name}</span>{t.note && <span className="block truncate text-xs text-muted">{t.note}</span>}</button>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${full ? 'bg-green-100 text-green-800' : t.used > t.seats ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>{t.used}/{t.seats}</span>
                </div>
                {at.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1 text-sm">
                    {at.map((p) => (
                      <li key={p.email} className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-bone">{p.name || p.email} <span className="text-muted">({p.qty})</span>{p.paddle ? <span className="text-muted"> · #{p.paddle}</span> : null}</span>
                        <button onClick={() => assign(p.email, null)} className="shrink-0 text-xs text-gray-400 hover:text-red-600">Move</button>
                      </li>
                    ))}
                  </ul>
                )}
                <button onClick={() => del(t)} className="mt-2 text-xs text-gray-400 hover:text-red-600">Delete table</button>
              </li>
            );
          })}
        </ul>
      )}
      {o.tables.length > 0 && (
        <button onClick={() => downloadCsv(`${fileSlug(event.title)}-seating.csv`, [['Table', 'Guest', 'Email', 'Party size', 'Paddle'], ...o.parties.map((p) => [o.tables.find((t) => t.id === p.table_id)?.name ?? 'Not seated', p.name ?? '', p.email, p.qty, p.paddle ?? ''])])}
          className="mt-4 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700">Download seating chart</button>
      )}
    </div>
  );
}

function PaddlesView({ event, o, onChanged, flash }: { event: TapEvent; o: Overview; onChanged: () => void; flash: (t: string) => void }) {
  const [start, setStart] = useState('100');
  const missing = o.parties.filter((p) => !p.paddle).length;
  async function assign() {
    const { data, error } = await supabase.rpc('assign_paddles', { p_event_id: event.id, p_start: Number(start) || 1 });
    if (error) return flash("Couldn't assign paddles.");
    flash(Number(data) ? `Assigned ${data} paddle number${Number(data) === 1 ? '' : 's'}.` : 'Everyone already has a paddle number.');
    onChanged();
  }
  const sorted = [...o.parties].sort((a, b) => (a.paddle ?? 1e9) - (b.paddle ?? 1e9));
  return (
    <div className="mt-4">
      <div className="rounded-2xl border border-gray-200 bg-surface p-4 text-sm">
        <p className="font-semibold text-bone">Paddle numbers</p>
        <p className="mt-1 text-muted">One number per ticket holder (their whole party), in name order. Guests see it on their ticket; new ticket holders can get one anytime.</p>
        {missing > 0 ? (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            {!o.parties.some((p) => p.paddle) && <label className="block text-xs font-medium text-gray-500">Start at<input value={start} inputMode="numeric" onChange={(e) => setStart(e.target.value.replace(/\D/g, ''))} className="mt-1 block w-24 rounded-xl border border-gray-300 bg-white px-3 py-2 text-base text-gray-900" /></label>}
            <button onClick={assign} className="rounded-xl bg-marigold px-4 py-2.5 text-sm font-semibold text-white">Assign {missing} paddle number{missing === 1 ? '' : 's'}</button>
          </div>
        ) : <p className="mt-2 text-sm text-green-700">✓ Everyone has a paddle number.</p>}
      </div>
      {o.parties.length > 0 && (
        <>
          <ul className="mt-3 flex flex-col gap-1.5">
            {sorted.map((p) => (
              <li key={p.email} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-surface px-3 py-2 text-sm">
                <span className="w-14 shrink-0 text-lg font-extrabold text-bone">{p.paddle ? `#${p.paddle}` : '—'}</span>
                <span className="min-w-0 flex-1 truncate text-bone">{p.name || p.email} <span className="text-muted">· party of {p.qty}</span></span>
              </li>
            ))}
          </ul>
          <button onClick={() => downloadCsv(`${fileSlug(event.title)}-paddles.csv`, [['Paddle', 'Guest', 'Email', 'Party size'], ...sorted.map((p) => [p.paddle ?? '', p.name ?? '', p.email, p.qty])])} className="mt-3 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700">Download paddle list</button>
        </>
      )}
    </div>
  );
}

function RaiseView({ event, o, onChanged, flash }: { event: TapEvent; o: Overview; onChanged: () => void; flash: (t: string) => void }) {
  const [paddle, setPaddle] = useState('');
  const [amount, setAmount] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const who = paddle ? o.parties.find((p) => p.paddle === Number(paddle)) : null;
  async function record(amt?: number) {
    const value = amt ?? Number(amount);
    if (!value || value <= 0) return flash('Enter an amount.');
    setBusy(true);
    const { error } = await supabase.rpc('record_pledge', { p_event_id: event.id, p_paddle: paddle ? Number(paddle) : null, p_amount: value, p_label: label || null });
    setBusy(false);
    if (error) return flash(error.message && !/function|permission/i.test(error.message) ? error.message : "Couldn't record that.");
    setPaddle(''); setAmount('');
    onChanged();
  }
  async function del(p: Pledge) { if (!window.confirm(`Remove the ${money(p.amount)} pledge${p.paddle ? ` from #${p.paddle}` : ''}?`)) return; await supabase.rpc('delete_pledge', { p_pledge_id: p.id }); onChanged(); }
  return (
    <div className="mt-4">
      <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-500 p-5 text-center text-white">
        <p className="text-xs font-semibold uppercase tracking-widest opacity-90">Raised tonight</p>
        <p className="mt-1 font-display text-4xl font-extrabold">{money(o.pledged)}</p>
        <p className="text-sm opacity-90">{o.pledges.length} pledge{o.pledges.length === 1 ? '' : 's'}</p>
      </div>
      <div className="mt-4 rounded-2xl border border-gray-200 bg-surface p-4">
        <div className="grid grid-cols-2 gap-2">
          <label className="block min-w-0 text-xs font-medium text-gray-500">Paddle #<input value={paddle} inputMode="numeric" onChange={(e) => setPaddle(e.target.value.replace(/\D/g, ''))} placeholder="Optional" className={field} /></label>
          <label className="block min-w-0 text-xs font-medium text-gray-500">Level (optional)<input value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} placeholder="Fund-a-need" className={field} /></label>
        </div>
        <p className="mt-1 h-4 text-xs text-muted">{paddle ? (who ? `#${paddle}: ${who.name || who.email}` : `No one has #${paddle}`) : 'Leave paddle blank for an anonymous pledge.'}</p>
        <p className="mt-2 text-xs font-medium text-gray-500">Tap an amount to record it</p>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          {PRESETS.map((v) => <button key={v} onClick={() => record(v)} disabled={busy} className="min-h-[48px] rounded-xl border border-gray-300 bg-white text-base font-bold text-gray-900 disabled:opacity-50">{money(v)}</button>)}
        </div>
        <div className="mt-2 flex gap-2">
          <input value={amount} inputMode="decimal" onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Other amount" aria-label="Other amount" className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900" />
          <button onClick={() => record()} disabled={busy} className="rounded-xl bg-marigold px-4 text-sm font-semibold text-white disabled:opacity-50">Record</button>
        </div>
      </div>
      {o.pledges.length > 0 && (
        <>
          <ul className="mt-4 flex flex-col gap-1.5">
            {o.pledges.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-surface px-3 py-2 text-sm">
                <span className="min-w-0 truncate text-bone"><strong>{money(p.amount)}</strong> · {p.paddle ? `#${p.paddle}${p.name ? ` ${p.name}` : ''}` : 'Anonymous'}{p.label ? ` · ${p.label}` : ''}</span>
                <button onClick={() => del(p)} className="shrink-0 text-xs text-gray-400 hover:text-red-600">Undo</button>
              </li>
            ))}
          </ul>
          <button onClick={() => downloadCsv(`${fileSlug(event.title)}-pledges.csv`, [['Amount', 'Paddle', 'Guest', 'Level', 'Time'], ...o.pledges.map((p) => [p.amount.toFixed(2), p.paddle ?? '', p.name ?? (p.paddle ? '' : 'Anonymous'), p.label ?? '', new Date(p.created_at).toLocaleString('en-US')])])}
            className="mt-3 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700">Download pledges</button>
          <p className="mt-2 text-xs text-muted">Pledges are a record for your team; collect payments the way you normally do (or send donors your event's donation link).</p>
        </>
      )}
    </div>
  );
}

function TableSheet({ event, table, bulk, onClose, onSaved }: { event: TapEvent; table: Table | null; bulk: boolean; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(table?.name ?? '');
  const [seats, setSeats] = useState(String(table?.seats ?? 8));
  const [count, setCount] = useState('10');
  const [note, setNote] = useState(table?.note ?? '');
  const [err, setErr] = useState<string | null>(null);
  async function save() {
    const s = Number(seats);
    if (!s || s < 1 || s > 40) return setErr('Seats per table: 1–40.');
    if (bulk) {
      const c = Number(count);
      if (!c || c < 1 || c > 100) return setErr('Up to 100 tables at a time.');
      const { error } = await supabase.rpc('add_gala_tables', { p_event_id: event.id, p_count: c, p_seats: s });
      if (error) return setErr("Couldn't add tables.");
    } else {
      if (!name.trim()) return setErr('Name the table.');
      const { error } = await supabase.rpc('save_gala_table', { p_event_id: event.id, p: { id: table?.id ?? null, name, seats: s, note } });
      if (error) return setErr("Couldn't save the table.");
    }
    onSaved();
  }
  return (
    <Sheet title={bulk ? 'Add tables' : table ? 'Edit table' : 'Add a table'} onClose={onClose}>
      {bulk ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs font-medium text-gray-500">How many tables<input value={count} inputMode="numeric" onChange={(e) => setCount(e.target.value.replace(/\D/g, ''))} className={field} /></label>
          <label className="block text-xs font-medium text-gray-500">Seats each<input value={seats} inputMode="numeric" onChange={(e) => setSeats(e.target.value.replace(/\D/g, ''))} className={field} /></label>
        </div>
      ) : (
        <>
          <label className="block text-xs font-medium text-gray-500">Name<input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Sponsor table" className={field} autoFocus /></label>
          <label className="mt-3 block text-xs font-medium text-gray-500">Seats<input value={seats} inputMode="numeric" onChange={(e) => setSeats(e.target.value.replace(/\D/g, ''))} className={field} /></label>
          <label className="mt-3 block text-xs font-medium text-gray-500">Note (optional)<input value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} placeholder="Near the stage · Acme Corp" className={field} /></label>
        </>
      )}
      {bulk && <p className="mt-2 text-xs text-gray-500">They'll be named Table 1, Table 2… You can rename any of them after.</p>}
      {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
      <button onClick={save} className="mt-4 w-full rounded-xl bg-marigold py-3 text-sm font-semibold text-white">{bulk ? `Add ${count || ''} tables` : 'Save table'}</button>
    </Sheet>
  );
}
