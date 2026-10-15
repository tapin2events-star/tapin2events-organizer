import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import Sheet from '../scouting/Sheet';

interface Shift { id: string; role: string; description: string | null; starts_at: string; ends_at: string; spots: number; filled: number; waitlist: number; my_status: 'confirmed' | 'waitlist' | null }
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const dayLabel = (iso: string) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

// Event page (Preview): volunteer shifts with spots left; sign up, join a waitlist, or cancel.
export default function VolunteerCard({ eventId }: { eventId: string }) {
  const { user } = useAuth();
  const location = useLocation();
  const [shifts, setShifts] = useState<Shift[] | null>(null);
  const [signing, setSigning] = useState<Shift | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => {
    const { data } = await supabase.rpc('volunteer_shifts', { p_event_id: eventId });
    setShifts(((data ?? []) as Shift[]).filter((s) => new Date(s.ends_at).getTime() > Date.now()).map((s) => ({ ...s, filled: Number(s.filled), waitlist: Number(s.waitlist) })));
  }, [eventId]);
  useEffect(() => { load(); }, [load, user]);
  useEffect(() => { if (shifts?.length && location.hash === '#volunteer') document.getElementById('volunteer')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [shifts?.length, location.hash]);
  async function cancel(s: Shift) {
    if (!window.confirm(`Cancel your ${s.my_status === 'waitlist' ? 'waitlist spot' : 'shift'} (${s.role})?`)) return;
    await supabase.rpc('volunteer_cancel', { p_shift_id: s.id, p_email: null });
    setMsg('Cancelled. Thanks for letting the organizer know.'); load();
  }
  if (!shifts?.length) return null;
  return (
    <section id="volunteer" className="mt-6 scroll-mt-24 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
      <h2 className="font-display text-lg font-bold text-gray-900">🙋 Volunteer</h2>
      <p className="text-sm text-gray-600">Help make this event happen. Pick a shift that works for you.</p>
      {msg && <p role="status" className="mt-2 rounded-xl bg-white px-3 py-2 text-sm text-green-800">{msg}</p>}
      <ul className="mt-3 flex flex-col gap-2">
        {shifts.map((s) => {
          const left = Math.max(0, s.spots - s.filled);
          return (
            <li key={s.id} className="rounded-xl border border-gray-200 bg-white p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">{s.role}</p>
                  <p className="text-xs text-gray-500">{dayLabel(s.starts_at)} · {time(s.starts_at)}–{time(s.ends_at)} · {left > 0 ? `${left} spot${left === 1 ? '' : 's'} left` : 'Full'}</p>
                  {s.description && <p className="mt-1 text-sm text-gray-600">{s.description}</p>}
                </div>
                <div className="shrink-0">
                  {s.my_status === 'confirmed' ? (
                    <span className="flex flex-col items-end gap-1"><span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-800">✓ You're in</span><button onClick={() => cancel(s)} className="text-xs text-gray-400">Cancel</button></span>
                  ) : s.my_status === 'waitlist' ? (
                    <span className="flex flex-col items-end gap-1"><span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">On waitlist</span><button onClick={() => cancel(s)} className="text-xs text-gray-400">Leave</button></span>
                  ) : !user ? (
                    <Link to="/login" state={{ from: `${location.pathname}#volunteer` }} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Sign in to help</Link>
                  ) : (
                    <button onClick={() => setSigning(s)} className={`rounded-xl px-4 py-2 text-sm font-semibold text-white ${left > 0 ? 'bg-emerald-600' : 'bg-gray-500'}`}>{left > 0 ? 'Sign up' : 'Join waitlist'}</button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {signing && <SignupSheet shift={signing} onClose={() => setSigning(null)} onDone={(st) => { setSigning(null); setMsg(st === 'confirmed' ? `🎉 You're volunteering: ${signing.role}. We'll remind you the day before.` : `You're on the waitlist for ${signing.role}. We'll let you know if a spot opens.`); load(); }} />}
    </section>
  );
}

function SignupSheet({ shift, onClose, onDone }: { shift: Shift; onClose: () => void; onDone: (status: string) => void }) {
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const full = shift.filled >= shift.spots;
  async function go() {
    setBusy(true); setErr(null);
    const { data, error } = await supabase.rpc('volunteer_signup', { p_shift_id: shift.id, p_phone: phone || null, p_note: note || null });
    setBusy(false);
    if (error) return setErr(error.message && !/function|permission/i.test(error.message) ? error.message : "Couldn't sign you up.");
    onDone(String(data));
  }
  return (
    <Sheet title={full ? 'Join the waitlist' : 'Volunteer for this shift'} onClose={onClose}>
      <p className="font-semibold text-gray-900">{shift.role}</p>
      <p className="text-sm text-gray-500">{dayLabel(shift.starts_at)} · {time(shift.starts_at)}–{time(shift.ends_at)}</p>
      {full && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">This shift is full. If someone cancels, you'll move up automatically and get a notification.</p>}
      <label className="mt-4 block text-xs font-medium text-gray-500">Phone (optional, so the organizer can reach you day-of)
        <input value={phone} inputMode="tel" maxLength={30} onChange={(e) => setPhone(e.target.value)} className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900" />
      </label>
      <label className="mt-3 block text-xs font-medium text-gray-500">Anything the organizer should know? (optional)
        <textarea rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900" />
      </label>
      {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
      <button onClick={go} disabled={busy} className="mt-4 w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Signing up…' : full ? 'Join waitlist' : 'Count me in'}</button>
    </Sheet>
  );
}
