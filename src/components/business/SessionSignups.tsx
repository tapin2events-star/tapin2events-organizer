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
      <p className="flex flex-wrap items-center gap-2 font-semibold text-bone">📋 Session sign-ups <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700">Preview</span> <PremiumBadge /></p>
      <p className="mt-1 text-muted">Turn on "People sign up for this session" on any workshop or limited-seat session. Attendees save seats from your agenda; full sessions get a waitlist.</p>
      <label className="mt-3 flex items-start gap-2"><input type="checkbox" checked={requiresTicket} onChange={(e) => save(e.target.checked, allowOverlap)} className="mt-0.5 h-4 w-4 accent-marigold" /><span>Only ticket holders can sign up for sessions</span></label>
      <label className="mt-2 flex items-start gap-2"><input type="checkbox" checked={allowOverlap} onChange={(e) => save(requiresTicket, e.target.checked)} className="mt-0.5 h-4 w-4 accent-marigold" /><span>Allow signing up for sessions at the same time</span></label>
    </div>
  );
}

interface RosterRow { signup_id: string; session_id: string; email: string; full_name: string | null; status: 'confirmed' | 'waitlist'; checked_in_at: string | null }
// Organizer: one session's sign-ups with check-in, remove and export.
export function SessionRosterSheet({ eventId, eventTitle, session, onClose }: { eventId: string; eventTitle: string; session: { id: string; title: string; capacity: number | null }; onClose: () => void }) {
  const [rows, setRows] = useState<RosterRow[] | null>(null);
  const load = useCallback(async () => {
    const { data } = await supabase.rpc('session_roster', { p_event_id: eventId });
    setRows(((data ?? []) as RosterRow[]).filter((r) => r.session_id === session.id));
  }, [eventId, session.id]);
  useEffect(() => { load(); }, [load]);
  const confirmed = (rows ?? []).filter((r) => r.status === 'confirmed');
  const waiting = (rows ?? []).filter((r) => r.status === 'waitlist');
  async function toggle(r: RosterRow) { await supabase.rpc('session_check_in', { p_signup_id: r.signup_id, p_in: !r.checked_in_at }); load(); }
  async function remove(r: RosterRow) { if (!window.confirm(`Remove ${r.full_name || r.email}? The next person on the waitlist moves up.`)) return; await supabase.rpc('session_cancel', { p_session_id: session.id, p_email: r.email }); load(); }
  return (
    <Sheet title={session.title} onClose={onClose}>
      <p className="-mt-2 text-sm text-gray-600">{confirmed.length}{session.capacity ? ` of ${session.capacity}` : ''} signed up{waiting.length ? ` · ${waiting.length} on the waitlist` : ''} · {confirmed.filter((r) => r.checked_in_at).length} checked in</p>
      {rows === null ? <p className="mt-3 text-sm text-gray-500">Loading…</p> : rows.length === 0 ? <p className="mt-3 text-sm text-gray-500">No one yet.</p> : (
        <ul className="mt-3 flex flex-col gap-1.5">
          {confirmed.map((r) => (
            <li key={r.signup_id} className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm">
              <button onClick={() => toggle(r)} aria-pressed={!!r.checked_in_at} aria-label={r.checked_in_at ? 'Undo check-in' : 'Check in'} className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${r.checked_in_at ? 'border-green-600 bg-green-600 text-white' : 'border-gray-300 text-transparent'}`}>✓</button>
              <span className="min-w-0 flex-1"><span className="block truncate font-medium text-gray-900">{r.full_name || r.email}</span>{r.full_name && <span className="block truncate text-xs text-gray-500">{r.email}</span>}</span>
              <button onClick={() => remove(r)} className="text-xs text-gray-400 hover:text-red-600">Remove</button>
            </li>
          ))}
          {waiting.length > 0 && <li className="mt-2 text-xs text-gray-500">Waitlist: {waiting.map((r) => r.full_name || r.email).join(', ')}</li>}
        </ul>
      )}
      {!!rows?.length && (
        <button onClick={() => downloadCsv(`${fileSlug(eventTitle)}-${fileSlug(session.title)}.csv`, [['Name', 'Email', 'Status', 'Checked in'], ...(rows ?? []).map((r) => [r.full_name ?? '', r.email, r.status === 'waitlist' ? 'Waitlist' : 'Confirmed', r.checked_in_at ? 'Yes' : 'No'])])}
          className="mt-4 w-full rounded-xl border border-gray-300 py-2.5 text-sm font-medium text-gray-700">Download list</button>
      )}
    </Sheet>
  );
}
