import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import Sheet from '../scouting/Sheet';
import PremiumBadge from './PremiumBadge';
import { downloadCsv, fileSlug } from '../../lib/csv';

// Workshop / session sign-ups (Preview, Business plan), built on the business page agenda.
export interface SessionSeat { id: string; capacity: number | null; filled: number; waitlist: number; my_status: 'confirmed' | 'waitlist' | null }
export interface SessionInfo { requires_ticket: boolean; allow_overlap: boolean; can_sign_up: boolean; sessions: SessionSeat[] }

export function useSessionSignups(eventId: string, on: boolean) {
  const { user } = useAuth();
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const load = useCallback(async () => {
    if (!on) return;
    const { data } = await supabase.rpc('session_signup_info', { p_event_id: eventId });
    const d = (data ?? null) as SessionInfo | null;
    setInfo(d ? { ...d, sessions: d.sessions.map((s) => ({ ...s, filled: Number(s.filled), waitlist: Number(s.waitlist) })) } : null);
  }, [eventId, on]);
  useEffect(() => { load(); }, [load, user]);
  return { info, reload: load };
}

// Event page: seats left + Sign up / Join waitlist / You're in for one agenda session.
export function SessionSignupControl({ seat, info, title, accent, onChanged }: { seat: SessionSeat; info: SessionInfo; title: string; accent: string; onChanged: () => void }) {
  const { user } = useAuth();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const left = seat.capacity == null ? null : Math.max(0, seat.capacity - seat.filled);
  async function signUp() {
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc('session_signup', { p_session_id: seat.id });
    setBusy(false);
    if (error) return setErr(error.message && !/function|permission/i.test(error.message) ? error.message : "Couldn't sign you up.");
    onChanged();
  }
  async function cancel() {
    if (!window.confirm(`Leave "${title}"?`)) return;
    setBusy(true);
    await supabase.rpc('session_cancel', { p_session_id: seat.id, p_email: null });
    setBusy(false); onChanged();
  }
  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        {seat.my_status === 'confirmed' ? (
          <><span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">✓ You're in</span><button onClick={cancel} disabled={busy} className="text-xs text-gray-400">Leave</button></>
        ) : seat.my_status === 'waitlist' ? (
          <><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">On the waitlist</span><button onClick={cancel} disabled={busy} className="text-xs text-gray-400">Leave</button></>
        ) : !user ? (
          <Link to="/login" state={{ from: `${location.pathname}#agenda` }} className="rounded-full px-4 py-1.5 text-xs font-bold text-white" style={{ background: accent }}>Sign in to save a seat</Link>
        ) : !info.can_sign_up ? (
          <span className="text-xs font-medium text-gray-500">Get a ticket to pick your sessions</span>
        ) : (
          <button onClick={signUp} disabled={busy} className="rounded-full px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50" style={{ background: left === 0 ? '#6B7280' : accent }}>{busy ? '…' : left === 0 ? 'Join waitlist' : 'Save my seat'}</button>
        )}
        <span className="text-xs text-gray-500">{left == null ? 'Sign-up required' : left === 0 ? `Full${seat.waitlist ? ` · ${seat.waitlist} waiting` : ''}` : `${left} seat${left === 1 ? '' : 's'} left`}</span>
      </div>
      {err && <p role="alert" className="mt-1 text-xs text-red-600">{err}</p>}
    </div>
  );
}

// Event page: your saved sessions at the top of the agenda.
export function MySessions({ info, titles, accent }: { info: SessionInfo; titles: Record<string, { title: string; time: string }>; accent: string }) {
  const mine = info.sessions.filter((s) => s.my_status);
  if (!mine.length) return null;
  return (
    <div className="mt-3 rounded-xl border p-3 text-sm" style={{ borderColor: accent }}>
      <p className="font-semibold text-gray-900">📋 Your sessions</p>
      <ul className="mt-1 text-gray-700">{mine.map((s) => <li key={s.id}>{titles[s.id]?.time ? `${titles[s.id].time} · ` : ''}{titles[s.id]?.title}{s.my_status === 'waitlist' ? ' (waitlist)' : ''}</li>)}</ul>
    </div>
  );
}

// Organizer: session sign-up rules (above the agenda list).
export function SessionRulesCard({ eventId, requiresTicket, allowOverlap, onChange }: { eventId: string; requiresTicket: boolean; allowOverlap: boolean; onChange: (r: boolean, o: boolean) => void }) {
  async function save(r: boolean, o: boolean) { onChange(r, o); await supabase.rpc('set_session_rules', { p_event_id: eventId, p_requires_ticket: r, p_allow_overlap: o }); }
  return (
    <div className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 text-sm">
      <p className="flex flex-wrap items-center gap-2 font-semibold text-bone">📋 Session sign-ups <PremiumBadge /></p>
      <p className="mt-1 text-muted">Turn on "People sign up for this session" on any workshop or limited-seat session. Attendees save seats from your agenda; full sessions get a waitlist.</p>
      <label className="mt-3 flex items-start gap-2"><input type="checkbox" checked={requiresTicket} onChange={(e) => save(e.target.checked, allowOverlap)} className="mt-0.5 h-4 w-4 accent-marigold" /><span>Only ticket holders can sign up for sessions</span></label>
      <label className="mt-2 flex items-start gap-2"><input type="checkbox" checked={allowOverlap} onChange={(e) => save(requiresTicket, e.target.checked)} className="mt-0.5 h-4 w-4 accent-marigold" /><span>Allow signing up for sessions at the same time</span></label>
    </div>
  );
}

interface RosterRow { signup_id: string; session_id: string; email: string; full_name: string | null; status: 'confirmed' | 'waitlist'; checked_in_at: string | null; created_at?: string }
interface Found { id: string; full_name: string; profile_photo: string | null }
// Organizer: one session's sign-ups with check-in and remove, plus waitlist tools (let in, reorder, remove,
// add seats, add someone) and export.
export function SessionRosterSheet({ eventId, eventTitle, session, onClose }: { eventId: string; eventTitle: string; session: { id: string; title: string; capacity: number | null }; onClose: () => void }) {
  const [rows, setRows] = useState<RosterRow[] | null>(null);
  const [cap, setCap] = useState<number | null>(session.capacity);
  const [addSeats, setAddSeats] = useState('2');
  const [msg, setMsg] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Found[]>([]);
  const load = useCallback(async () => {
    const { data } = await supabase.rpc('session_roster', { p_event_id: eventId });
    setRows(((data ?? []) as RosterRow[]).filter((r) => r.session_id === session.id).sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''))));
  }, [eventId, session.id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (q.trim().length < 2) { setFound([]); return; }
    const t = setTimeout(() => { supabase.rpc('search_people_for_splits', { p_query: q.trim() }).then(({ data }) => setFound((data ?? []) as Found[])); }, 250);
    return () => clearTimeout(t);
  }, [q]);
  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(null), 4000); };
  const confirmed = (rows ?? []).filter((r) => r.status === 'confirmed');
  const waiting = (rows ?? []).filter((r) => r.status === 'waitlist');
  const name = (r: RosterRow) => r.full_name || r.email;
  async function toggle(r: RosterRow) { await supabase.rpc('session_check_in', { p_signup_id: r.signup_id, p_in: !r.checked_in_at }); load(); }
  async function remove(r: RosterRow) { if (!window.confirm(`Remove ${name(r)}? The next person on the waitlist moves up.`)) return; await supabase.rpc('session_cancel', { p_session_id: session.id, p_email: r.email }); load(); }
  async function act(r: RosterRow, action: 'let_in' | 'remove' | 'up' | 'down') {
    if (action === 'remove' && !window.confirm(`Take ${name(r)} off the waitlist? They'll get a notification.`)) return;
    const { error } = await supabase.rpc('session_waitlist_action', { p_signup_id: r.signup_id, p_action: action });
    if (error) flash(error.message && !/function|permission/i.test(error.message) ? error.message : "Couldn't do that.");
    else if (action === 'let_in') flash(`${name(r)} is in. They'll get a notification.`);
    load();
  }
  async function seats() {
    const n = Math.floor(Number(addSeats));
    if (!n || n < 1) return;
    const { data, error } = await supabase.rpc('session_add_seats', { p_session_id: session.id, p_add: n });
    if (error) return flash(error.message && !/function|permission/i.test(error.message) ? error.message : "Couldn't add seats.");
    setCap((c) => (c ?? 0) + n);
    flash(`Added ${n} seat${n === 1 ? '' : 's'}${Number(data) ? `, and let in ${data} from the waitlist` : ''}.`);
    load();
  }
  async function addPerson(f: Found, waitlist: boolean) {
    const { error } = await supabase.rpc('session_add_person', { p_session_id: session.id, p_user_id: f.id, p_waitlist: waitlist });
    if (error) return flash(error.message && !/function|permission/i.test(error.message) ? error.message : "Couldn't add them.");
    setQ(''); setFound([]);
    flash(waitlist ? `${f.full_name} is on the waitlist.` : `${f.full_name} has a seat.`);
    load();
  }
  return (
    <Sheet title={session.title} onClose={onClose}>
      <p className="-mt-2 text-sm text-gray-600">{confirmed.length}{cap ? ` of ${cap}` : ''} signed up{waiting.length ? ` · ${waiting.length} on the waitlist` : ''} · {confirmed.filter((r) => r.checked_in_at).length} checked in</p>
      {msg && <p role="status" className="mt-2 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">{msg}</p>}
      {rows === null ? <p className="mt-3 text-sm text-gray-500">Loading…</p> : (
        <>
          {confirmed.length === 0 ? <p className="mt-3 text-sm text-gray-500">No one signed up yet.</p> : (
            <ul className="mt-3 flex flex-col gap-1.5">
              {confirmed.map((r) => (
                <li key={r.signup_id} className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm">
                  <button onClick={() => toggle(r)} aria-pressed={!!r.checked_in_at} aria-label={r.checked_in_at ? 'Undo check-in' : 'Check in'} className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${r.checked_in_at ? 'border-green-600 bg-green-600 text-white' : 'border-gray-300 text-transparent'}`}>✓</button>
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium text-gray-900">{name(r)}</span>{r.full_name && <span className="block truncate text-xs text-gray-500">{r.email}</span>}</span>
                  <button onClick={() => remove(r)} className="text-xs text-gray-400 hover:text-red-600">Remove</button>
                </li>
              ))}
            </ul>
          )}

          {waiting.length > 0 && (
            <>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-amber-700">Waitlist (in order)</p>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {waiting.map((r, i) => (
                  <li key={r.signup_id} className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/50 px-3 py-2 text-sm">
                    <span className="w-5 shrink-0 text-center text-xs font-bold text-amber-700">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate font-medium text-gray-900">{name(r)}</span>
                    <button onClick={() => act(r, 'up')} disabled={i === 0} aria-label={`Move ${name(r)} up`} className="px-1 text-gray-500 disabled:opacity-30">↑</button>
                    <button onClick={() => act(r, 'down')} disabled={i === waiting.length - 1} aria-label={`Move ${name(r)} down`} className="px-1 text-gray-500 disabled:opacity-30">↓</button>
                    <button onClick={() => act(r, 'let_in')} className="rounded-lg bg-[#0F1B3D] px-2.5 py-1 text-xs font-semibold text-white">Let in</button>
                    <button onClick={() => act(r, 'remove')} aria-label={`Remove ${name(r)} from the waitlist`} className="px-1 text-xs text-gray-400 hover:text-red-600">✕</button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {cap !== null && (
            <div className="mt-4 flex flex-wrap items-end gap-2 rounded-xl bg-gray-50 p-3">
              <label className="block text-xs font-medium text-gray-500">Add seats<input value={addSeats} inputMode="numeric" onChange={(e) => setAddSeats(e.target.value.replace(/\D/g, ''))} className="mt-1 block w-20 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-base text-gray-900 sm:text-sm" /></label>
              <button onClick={seats} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800">+ Add seats</button>
              {waiting.length > 0 && <span className="text-xs text-gray-500">People are let in from the top of the waitlist.</span>}
            </div>
          )}

          <div className="mt-4">
            <p className="text-xs font-medium text-gray-500">Add someone</p>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people on TapIN by name" aria-label="Search people to add" className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 sm:text-sm" />
            {found.length > 0 && (
              <ul className="mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white">
                {found.map((f) => (
                  <li key={f.id} className="flex items-center gap-2 border-b border-gray-100 px-3 py-2 last:border-0">
                    {f.profile_photo ? <img src={f.profile_photo} alt="" className="h-7 w-7 rounded-full object-cover" /> : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600">{f.full_name.charAt(0)}</span>}
                    <span className="min-w-0 flex-1 truncate text-sm text-gray-900">{f.full_name}</span>
                    <button onClick={() => addPerson(f, false)} className="rounded-lg bg-marigold px-2.5 py-1 text-xs font-semibold text-white">Seat</button>
                    <button onClick={() => addPerson(f, true)} className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs text-gray-700">Waitlist</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
      {!!rows?.length && (
        <button onClick={() => downloadCsv(`${fileSlug(eventTitle)}-${fileSlug(session.title)}.csv`, [['Name', 'Email', 'Status', 'Checked in'], ...(rows ?? []).map((r) => [r.full_name ?? '', r.email, r.status === 'waitlist' ? 'Waitlist' : 'Confirmed', r.checked_in_at ? 'Yes' : 'No'])])}
          className="mt-4 w-full rounded-xl border border-gray-300 py-2.5 text-sm font-medium text-gray-700">Download list</button>
      )}
    </Sheet>
  );
}
