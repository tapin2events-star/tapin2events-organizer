import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFeature } from '../../lib/preview';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { ListSkeleton } from '../ui/Skeleton';
import { answerText, loadQuestions, type Question } from '../../lib/registration';
import { downloadCsv, fileSlug } from '../../lib/csv';
import { DecideSheet, type Registrant } from '../business/RegistrationTab';
import type { Ticket, TapEvent } from '../../lib/types';

type T = Ticket & { tier?: { name?: string } | null; checked_in_at?: string | null; transferred_from?: string | null; guest_name?: string | null };
interface Person { email: string; name: string | null; tickets: T[]; qty: number; paid: number; checkedIn: boolean; answers: Record<string, unknown>; request: Registrant | null }

// Event dashboard > Attendees: everyone coming in one place: their tickets, check-in, answers to your
// registration questions, and join requests to approve. One spreadsheet with all of it.
export default function AttendeesTab({ event }: { event: TapEvent }) {
  const [tickets, setTickets] = useState<T[] | null>(null);
  const [regs, setRegs] = useState<Registrant[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<{ r: Registrant; approve: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  // Workshop sign-ups (Preview): which sessions each person saved.
  const workshopsOn = useFeature('workshops');
  const [sessionsBy, setSessionsBy] = useState<Map<string, string[]>>(new Map());
  useEffect(() => {
    if (!workshopsOn) return;
    Promise.all([
      supabase.rpc('session_roster', { p_event_id: event.id }),
      supabase.from('event_sessions').select('id, title').eq('event_id', event.id),
    ]).then(([{ data: r }, { data: ss }]) => {
      const title = new Map(((ss ?? []) as { id: string; title: string }[]).map((x) => [x.id, x.title]));
      const m = new Map<string, string[]>();
      for (const x of (r ?? []) as { email: string; session_id: string; status: string }[]) {
        if (x.status !== 'confirmed') continue;
        m.set(x.email, [...(m.get(x.email) ?? []), title.get(x.session_id) ?? 'Session']);
      }
      setSessionsBy(m);
    });
  }, [workshopsOn, event.id]);

  const load = useCallback(async () => {
    const [{ data: t }, { data: r }, qs] = await Promise.all([
      supabase.from('tickets').select('*, tier:event_ticket_tiers(name)').eq('event_id', event.id).order('created_at', { ascending: false }),
      supabase.rpc('event_registrants', { p_event_id: event.id }),
      loadQuestions(event.id, true),
    ]);
    const list = (t ?? []) as T[];
    setTickets(list);
    setRegs(((r ?? []) as Registrant[]).map((x) => ({ ...x, tickets: Number(x.tickets) })));
    setQuestions(qs.filter((x) => x.active));
    const emails = [...new Set(list.map((x) => x.attendee_email.toLowerCase()))];
    if (emails.length) {
      const { data: p } = await supabase.from('public_profiles').select('email, full_name').in('email', emails);
      setNames(new Map(((p ?? []) as { email: string; full_name: string | null }[]).filter((x) => x.full_name).map((x) => [x.email.toLowerCase(), x.full_name as string])));
    }
  }, [event.id]);
  useEffect(() => { load(); }, [load]);

  const people = useMemo<Person[]>(() => {
    const map = new Map<string, Person>();
    for (const t of tickets ?? []) {
      if (t.status === 'transferred') continue;
      const em = t.attendee_email.toLowerCase();
      const p = map.get(em) ?? { email: em, name: names.get(em) ?? null, tickets: [], qty: 0, paid: 0, checkedIn: false, answers: {}, request: null };
      p.tickets.push(t);
      if (t.status === 'confirmed' || String(t.status) === 'used') { p.qty += t.quantity || 1; p.paid += (t.price_paid || 0) * (t.quantity || 1); }
      if (t.checked_in_at || String(t.status) === 'used') p.checkedIn = true;
      map.set(em, p);
    }
    for (const r of regs) {
      const em = r.email.toLowerCase();
      const p = map.get(em);
      if (p) { p.answers = r.answers ?? {}; p.request = r.request_id ? r : null; p.name = p.name || r.full_name; }
      else if (r.request_status && r.request_status !== 'pending') map.set(em, { email: em, name: r.full_name, tickets: [], qty: 0, paid: 0, checkedIn: false, answers: r.answers ?? {}, request: r });
    }
    return [...map.values()];
  }, [tickets, regs, names]);
  const pending = regs.filter((r) => r.request_status === 'pending');
  const shown = people.filter((p) => !q.trim() || p.email.includes(q.trim().toLowerCase()) || (p.name ?? '').toLowerCase().includes(q.trim().toLowerCase())
    || p.tickets.some((t) => (t.guest_name ?? '').toLowerCase().includes(q.trim().toLowerCase())));
  const totalQty = people.reduce((n, p) => n + p.qty, 0);
  const checkedIn = people.filter((p) => p.checkedIn).length;

  async function approveAll() {
    setBusy(true);
    for (const p of pending) if (p.request_id) await supabase.rpc('decide_registration', { p_request_id: p.request_id, p_approve: true, p_note: null });
    setBusy(false); load();
  }
  async function exportCsv() {
    const orderIds = [...new Set((tickets ?? []).map((t) => t.order_id).filter(Boolean))] as string[];
    const { data: orders } = orderIds.length ? await supabase.from('orders').select('id, order_number, customer_name').in('id', orderIds) : { data: [] };
    const byId = new Map(((orders ?? []) as { id: string; order_number: string | null; customer_name: string | null }[]).map((o) => [o.id, o]));
    const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '');
    const rows: unknown[][] = [['Name', 'Guest name', 'Email', 'Ticket type', 'Section', 'Seat', 'Quantity', 'Price per ticket', 'Total paid', 'Status', 'Checked in', 'Checked in at', 'Registered', 'Order #', 'Request', ...questions.map((x) => x.label), ...(workshopsOn ? ['Sessions'] : [])]];
    for (const p of people) {
      const ans = [...questions.map((x) => answerText(p.answers[x.id])), ...(workshopsOn ? [(sessionsBy.get(p.email) ?? []).join('; ')] : [])];
      if (!p.tickets.length) { rows.push([p.name ?? '', '', p.email, '', '', '', 0, '', '', '', 'No', '', '', '', p.request?.request_status ?? '', ...ans]); continue; }
      for (const t of p.tickets) {
        const o = t.order_id ? byId.get(t.order_id) : undefined;
        rows.push([o?.customer_name || p.name || '', t.guest_name ?? '', p.email, t.tier?.name || t.ticket_type, t.section_name ?? '', t.seat_assignment ?? '', t.quantity, t.price_paid, (t.price_paid || 0) * (t.quantity || 1), t.status,
          t.checked_in_at || String(t.status) === 'used' ? 'Yes' : 'No', when(t.checked_in_at), when(t.created_at), o?.order_number ?? '', p.request?.request_status ?? '', ...ans]);
      }
    }
    downloadCsv(`${fileSlug(event.title)}-attendees-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  if (tickets === null) return <ListSkeleton rows={4} className="mt-4" />;
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border border-gray-200 bg-surface p-3"><p className="text-2xl font-extrabold text-marigold">{totalQty}</p><p className="text-xs text-muted">tickets</p></div>
        <div className="rounded-xl border border-gray-200 bg-surface p-3"><p className="text-2xl font-extrabold text-bone">{people.filter((p) => p.qty > 0).length}</p><p className="text-xs text-muted">people</p></div>
        <div className="rounded-xl border border-gray-200 bg-surface p-3"><p className="text-2xl font-extrabold text-green-700">{checkedIn}</p><p className="text-xs text-muted">checked in</p></div>
      </div>

      {pending.length > 0 && (
        <section>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-lg font-bold text-bone">Requests to join <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">{pending.length} waiting</span></h3>
            {pending.length > 1 && <button onClick={approveAll} disabled={busy} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 disabled:opacity-50">{busy ? 'Approving…' : `Approve all ${pending.length}`}</button>}
          </div>
          <ul className="mt-3 flex flex-col gap-3">
            {pending.map((p) => (
              <li key={p.email} className="rounded-2xl border border-amber-200 bg-white p-4">
                <p className="font-semibold text-gray-900">{p.full_name || p.email}</p>
                <p className="text-xs text-gray-500">{p.email}{p.requested_at ? ` · asked ${new Date(p.requested_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}</p>
                {p.request_message && <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">"{p.request_message}"</p>}
                {questions.some((x) => p.answers?.[x.id] != null) && (
                  <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                    {questions.filter((x) => p.answers?.[x.id] != null).map((x) => <div key={x.id} className="min-w-0"><dt className="text-xs text-gray-500">{x.label}</dt><dd className="break-words text-gray-900">{answerText(p.answers[x.id])}</dd></div>)}
                  </dl>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2 sm:flex">
                  <button onClick={() => setDeciding({ r: p, approve: true })} className="min-h-[44px] rounded-xl bg-[#0F1B3D] px-4 text-sm font-bold text-white">Approve</button>
                  <button onClick={() => setDeciding({ r: p, approve: false })} className="min-h-[44px] rounded-xl border border-gray-300 px-4 text-sm font-medium text-gray-700">Decline</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-lg font-bold text-bone">Attendees <span className="text-sm font-normal text-muted">({people.length})</span></h3>
          <div className="flex gap-2">
            <Link data-tour="checkin" to={`/organizer/events/${event.id}/checkin`} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700">Check-in</Link>
            {people.length > 0 && <button onClick={exportCsv} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700">Download spreadsheet</button>}
          </div>
        </div>
        {people.length > 5 && <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${people.length} people`} aria-label="Search attendees" className="mt-3 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 sm:text-sm" />}
        {people.length === 0 ? <p className="mt-2 text-sm text-muted">No one yet. Tickets and registrations show up here.</p> : (
          <ul className="mt-3 flex flex-col gap-2">
            {shown.map((p) => {
              const mySessions = sessionsBy.get(p.email) ?? [];
              const hasAnswers = questions.some((x) => p.answers?.[x.id] != null) || mySessions.length > 0;
              const expanded = open === p.email;
              const types = [...new Set(p.tickets.map((t) => t.tier?.name || (t.section_name ? `${t.section_name}${t.seat_assignment ? ` · ${t.seat_assignment}` : ''}` : t.ticket_type)))];
              const transferred = p.tickets.find((t) => t.transferred_from);
              return (
                <li key={p.email} className="rounded-xl border border-gray-200 bg-surface">
                  <button type="button" onClick={() => setOpen(expanded ? null : p.email)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left" aria-expanded={expanded}>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-bone">{p.name || p.email}</span>
                      {p.tickets.some((t) => t.guest_name) && <span className="block truncate text-xs text-gray-600">Guests: {p.tickets.map((t) => t.guest_name).filter(Boolean).join(', ')}</span>}
                      <span className="block truncate text-xs text-muted">{p.name ? `${p.email} · ` : ''}{p.qty > 0 ? `${p.qty} ${p.qty === 1 ? 'ticket' : 'tickets'}` : p.request?.request_status === 'approved' ? 'Approved, not registered yet' : p.request?.request_status === 'declined' ? 'Declined' : 'No ticket'}{types.length ? ` · ${types.join(', ')}` : ''}{transferred ? ' · transferred to them' : ''}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {p.paid > 0 && <span className="text-sm font-medium text-bone">${p.paid.toFixed(2).replace(/\.00$/, '')}</span>}
                      {p.checkedIn ? <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800">✓ In</span> : p.tickets.some((t) => t.status === 'refunded' || t.status === 'cancelled') && p.qty === 0 ? <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">Refunded</span> : null}
                      {(hasAnswers || p.tickets.length > 1) && <span className="text-xs text-gray-400">{expanded ? '▲' : '▼'}</span>}
                    </span>
                  </button>
                  {expanded && (
                    <div className="border-t border-gray-100 px-4 py-3 text-sm">
                      {mySessions.length > 0 && <p className="mb-2 text-xs text-bone"><span className="text-muted">Sessions:</span> {mySessions.join(' · ')}</p>}
                      {hasAnswers && (
                        <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
                          {questions.filter((x) => p.answers?.[x.id] != null).map((x) => <div key={x.id} className="min-w-0"><dt className="text-xs text-muted">{x.label}</dt><dd className="break-words text-bone">{answerText(p.answers[x.id])}</dd></div>)}
                        </dl>
                      )}
                      {p.tickets.length > 0 && (
                        <ul className={`${hasAnswers ? 'mt-3 border-t border-gray-100 pt-2' : ''} flex flex-col gap-1 text-xs text-muted`}>
                          {p.tickets.map((t) => (
                            <li key={t.id}>{t.guest_name && <strong className="text-gray-800">{t.guest_name} · </strong>}{t.tier?.name || t.ticket_type} · Qty {t.quantity}{t.section_name ? ` · ${t.section_name}` : ''}{t.seat_assignment ? ` · Seat ${t.seat_assignment}` : ''} · ${((t.price_paid || 0) * (t.quantity || 1)).toFixed(2)} · {t.status}{t.checked_in_at ? ` · checked in ${new Date(t.checked_in_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : ''}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {deciding && <DecideSheet r={deciding.r} approve={deciding.approve} onClose={() => setDeciding(null)} onDone={() => { setDeciding(null); load(); }} />}
    </div>
  );
}
