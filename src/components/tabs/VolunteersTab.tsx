import { useCallback, useEffect, useState } from 'react';
import PremiumBadge from '../business/PremiumBadge';
import { supabase } from '../../lib/supabaseClient';
import Sheet from '../scouting/Sheet';
import { ListSkeleton } from '../ui/Skeleton';
import { downloadCsv, fileSlug } from '../../lib/csv';
import type { TapEvent } from '../../lib/types';

interface Shift { id: string; role: string; description: string | null; starts_at: string; ends_at: string; spots: number; filled: number; waitlist: number }
interface Signup { signup_id: string; shift_id: string; email: string; full_name: string | null; photo: string | null; phone: string | null; note: string | null; status: 'confirmed' | 'waitlist'; checked_in_at: string | null }
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const dayLabel = (iso: string) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const field = 'mt-1 block h-12 w-full min-w-0 appearance-none rounded-xl border border-gray-300 bg-white px-3 text-base text-gray-900';

// Event dashboard > Volunteers (Preview): shifts with spots, who signed up (with waitlist), check-in, export.
export default function VolunteersTab({ event }: { event: TapEvent }) {
  const [shifts, setShifts] = useState<Shift[] | null>(null);
  const [roster, setRoster] = useState<Signup[]>([]);
  const [editing, setEditing] = useState<Shift | 'new' | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => {
    const [{ data: s }, { data: r }] = await Promise.all([
      supabase.rpc('volunteer_shifts', { p_event_id: event.id }),
      supabase.rpc('volunteer_roster', { p_event_id: event.id }),
    ]);
    setShifts(((s ?? []) as Shift[]).map((x) => ({ ...x, filled: Number(x.filled), waitlist: Number(x.waitlist) })));
    setRoster((r ?? []) as Signup[]);
  }, [event.id]);
  useEffect(() => { load(); }, [load]);
  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(null), 2500); };

  const [notified, setNotified] = useState<boolean>(!!(event as { volunteers_notified_at?: string | null }).volunteers_notified_at);
  async function notifyPast() {
    if (!window.confirm('Send a notification to everyone who has volunteered at your organization\u2019s other events? You can do this once per event.')) return;
    const { data, error } = await supabase.rpc('notify_past_volunteers', { p_event_id: event.id });
    if (error) return flash(error.message && !/function|permission/i.test(error.message) ? error.message : "Couldn't send.");
    setNotified(true);
    flash(Number(data) ? `Sent to ${data} past volunteer${Number(data) === 1 ? '' : 's'}.` : 'No past volunteers to notify yet.');
  }
  async function checkIn(v: Signup) {
    await supabase.rpc('volunteer_check_in', { p_signup_id: v.signup_id, p_in: !v.checked_in_at });
    setRoster((list) => list.map((x) => (x.signup_id === v.signup_id ? { ...x, checked_in_at: x.checked_in_at ? null : new Date().toISOString() } : x)));
  }
  async function remove(v: Signup) {
    if (!window.confirm(`Remove ${v.full_name || v.email} from this shift? The next person on the waitlist moves up.`)) return;
    await supabase.rpc('volunteer_cancel', { p_shift_id: v.shift_id, p_email: v.email });
    load();
  }
  async function del(s: Shift) {
    if (!window.confirm(`Delete the ${s.role} shift? ${s.filled + s.waitlist ? 'Everyone signed up will be notified.' : ''}`)) return;
    await supabase.rpc('delete_volunteer_shift', { p_shift_id: s.id });
    load();
  }
  function exportCsv() {
    const rows: unknown[][] = [['Shift', 'Date', 'Start', 'End', 'Name', 'Email', 'Phone', 'Status', 'Checked in', 'Note']];
    for (const s of shifts ?? []) for (const v of roster.filter((x) => x.shift_id === s.id)) {
      rows.push([s.role, dayLabel(s.starts_at), time(s.starts_at), time(s.ends_at), v.full_name ?? '', v.email, v.phone ?? '', v.status === 'waitlist' ? 'Waitlist' : 'Confirmed', v.checked_in_at ? 'Yes' : 'No', v.note ?? '']);
    }
    downloadCsv(`${fileSlug(event.title)}-volunteers.csv`, rows);
  }

  if (shifts === null) return <ListSkeleton rows={3} className="mt-4" />;
  const totalSpots = shifts.reduce((n, s) => n + s.spots, 0);
  const totalFilled = shifts.reduce((n, s) => n + Math.min(s.filled, s.spots), 0);
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-display text-lg font-bold text-bone">🙋 Volunteers <PremiumBadge /></p>
          <p className="text-sm text-muted">Create shifts and people sign up from your event page. When a shift is full, others can join a waitlist and move up automatically.</p>
        </div>
        <button onClick={() => setEditing('new')} className="rounded-xl bg-marigold px-4 py-2 text-sm font-semibold text-white">+ Add shift</button>
      </div>
      {msg && <p role="status" className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">{msg}</p>}

      {shifts.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted"><strong className="text-bone">{totalFilled} of {totalSpots}</strong> spots filled across {shifts.length} shift{shifts.length === 1 ? '' : 's'}</p>
          <div className="flex flex-wrap gap-2">
            {event.organization_id && (notified
              ? <span className="rounded-xl bg-gray-100 px-3 py-2 text-sm text-gray-600">✓ Past volunteers notified</span>
              : <button onClick={notifyPast} className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Notify past volunteers</button>)}
            <button onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}${import.meta.env.BASE_URL}events/${event.id}#volunteer`); flash('Volunteer link copied.'); }} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700">Copy sign-up link</button>
            {roster.length > 0 && <button onClick={exportCsv} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700">Export</button>}
          </div>
        </div>
      )}

      {shifts.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-muted">
          No shifts yet. Add shifts like "Door greeter, 5–7 PM, 2 people" or "Setup crew, 3–5 PM, 4 people."
          <div className="mt-3"><button onClick={() => setEditing('new')} className="rounded-xl bg-marigold px-4 py-2 text-sm font-semibold text-white">Add your first shift</button></div>
        </div>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {shifts.map((s) => {
            const people = roster.filter((v) => v.shift_id === s.id);
            const confirmed = people.filter((v) => v.status === 'confirmed');
            const waiting = people.filter((v) => v.status === 'waitlist');
            const full = s.filled >= s.spots;
            return (
              <li key={s.id} className="rounded-2xl border border-gray-200 bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-bone">{s.role}</p>
                    <p className="text-xs text-muted">{dayLabel(s.starts_at)} · {time(s.starts_at)}–{time(s.ends_at)}</p>
                    {s.description && <p className="mt-1 text-sm text-muted">{s.description}</p>}
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${full ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900'}`}>{Math.min(s.filled, s.spots)} / {s.spots}{full ? ' · Full' : ''}</span>
                </div>
                {confirmed.length > 0 && (
                  <ul className="mt-3 flex flex-col gap-1.5">
                    {confirmed.map((v) => (
                      <li key={v.signup_id} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm">
                        <button onClick={() => checkIn(v)} aria-pressed={!!v.checked_in_at} aria-label={v.checked_in_at ? 'Undo check-in' : 'Check in'} className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${v.checked_in_at ? 'border-green-600 bg-green-600 text-white' : 'border-gray-300 text-transparent'}`}>✓</button>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-gray-900">{v.full_name || v.email}</span>
                          <span className="block truncate text-xs text-gray-500">{[v.full_name ? v.email : null, v.phone, v.note].filter(Boolean).join(' · ')}</span>
                        </span>
                        <button onClick={() => remove(v)} className="shrink-0 text-xs text-gray-400 hover:text-red-600">Remove</button>
                      </li>
                    ))}
                  </ul>
                )}
                {waiting.length > 0 && <p className="mt-2 text-xs text-muted">Waitlist: {waiting.map((v) => v.full_name || v.email).join(', ')}</p>}
                {people.length === 0 && <p className="mt-2 text-xs text-muted">No one yet.</p>}
                <div className="mt-3 flex gap-4 text-sm">
                  <button onClick={() => setEditing(s)} className="font-medium text-marigold">Edit</button>
                  <button onClick={() => del(s)} className="text-gray-400 hover:text-red-600">Delete</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {editing && <ShiftSheet event={event} shift={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function ShiftSheet({ event, shift, onClose, onSaved }: { event: TapEvent; shift: Shift | null; onClose: () => void; onSaved: () => void }) {
  const base = shift ? new Date(shift.starts_at) : event.start_date ? new Date(event.start_date) : new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const end0 = shift ? new Date(shift.ends_at) : new Date(base.getTime() + 2 * 3600000);
  const [role, setRole] = useState(shift?.role ?? '');
  const [date, setDate] = useState(ymd(base));
  const [start, setStart] = useState(hm(base));
  const [end, setEnd] = useState(hm(end0));
  const [spots, setSpots] = useState(String(shift?.spots ?? 2));
  const [desc, setDesc] = useState(shift?.description ?? '');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!role.trim()) return setErr('Name the role, like "Door greeter".');
    const s = new Date(`${date}T${start}`); let e = new Date(`${date}T${end}`);
    if (e <= s) e = new Date(e.getTime() + 86400000);
    const n = Number(spots);
    if (!Number.isInteger(n) || n < 1) return setErr('How many people do you need?');
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc('save_volunteer_shift', { p_event_id: event.id, p: { id: shift?.id ?? null, role, description: desc, starts_at: s.toISOString(), ends_at: e.toISOString(), spots: n } });
    setBusy(false);
    if (error) return setErr("Couldn't save the shift.");
    onSaved();
  }
  return (
    <Sheet title={shift ? 'Edit shift' : 'New shift'} onClose={onClose}>
      <label className="block text-xs font-medium text-gray-500">Role<input value={role} maxLength={80} onChange={(e) => setRole(e.target.value)} placeholder="Door greeter" className={field} autoFocus={!shift} /></label>
      <div className="mt-2 flex flex-wrap gap-1.5">{['Door greeter', 'Setup crew', 'Check-in table', 'Merch table', 'Cleanup crew', 'Stage hand'].map((r) => <button key={r} type="button" onClick={() => setRole(r)} className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-gray-700">{r}</button>)}</div>
      <label className="mt-3 block text-xs font-medium text-gray-500">Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} /></label>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="block min-w-0 text-xs font-medium text-gray-500">Starts<input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={field} /></label>
        <label className="block min-w-0 text-xs font-medium text-gray-500">Ends<input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={field} /></label>
      </div>
      <label className="mt-3 block text-xs font-medium text-gray-500">People needed<input value={spots} inputMode="numeric" onChange={(e) => setSpots(e.target.value.replace(/\D/g, ''))} className={field} /></label>
      <label className="mt-3 block text-xs font-medium text-gray-500">What they'll do (optional)
        <textarea rows={3} maxLength={600} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Welcome guests, scan tickets, hand out wristbands." className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900" />
      </label>
      {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
      <button onClick={save} disabled={busy} className="mt-4 w-full rounded-xl bg-marigold py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save shift'}</button>
    </Sheet>
  );
}
