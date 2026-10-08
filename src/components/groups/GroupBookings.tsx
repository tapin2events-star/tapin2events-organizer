import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { BOOKING_STATUS_LABELS, BOOKING_STATUS_STYLES, agreedRate, formatServiceDate, money } from '../../lib/bookings';
import { rpcError } from '../../lib/groups';
import type { ResourceBooking } from '../../lib/types';

type Row = ResourceBooking & { event_title: string; event_start: string | null; organizer_name: string | null; group_split?: { email: string; cents: number; transfer_id?: string; reversal_id?: string }[] | null };

// The group's booking requests. Owners and admins respond; every member can see them and their share.
export default function GroupBookings({ groupId, groupName, canRespond }: { groupId: string; groupName: string; canRespond: boolean }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [countering, setCountering] = useState<string | null>(null);
  const [counterRate, setCounterRate] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.from('resource_bookings').select('*').eq('resource_id', groupId).neq('status', 'deleted').order('created_at', { ascending: false });
    const list = (data ?? []) as Row[];
    const eventIds = [...new Set(list.map((b) => b.event_id))];
    const orgs = [...new Set(list.map((b) => b.organizer_email))];
    const [{ data: events }, { data: people }] = await Promise.all([
      eventIds.length ? supabase.from('events').select('id, title, start_date').in('id', eventIds) : Promise.resolve({ data: [] as { id: string; title: string; start_date: string | null }[] }),
      orgs.length ? supabase.from('public_profiles').select('email, full_name').in('email', orgs) : Promise.resolve({ data: [] as { email: string; full_name: string | null }[] }),
    ]);
    const ev = new Map((events ?? []).map((e) => [e.id, e]));
    const names = new Map((people ?? []).map((p) => [p.email, p.full_name]));
    setRows(list.map((b) => ({ ...b, event_title: ev.get(b.event_id)?.title ?? 'Untitled event', event_start: ev.get(b.event_id)?.start_date ?? null, organizer_name: names.get(b.organizer_email) ?? null }))
      .sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending')));
  }
  useEffect(() => { load(); }, [groupId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function update(b: Row, patch: Record<string, unknown>, note: string) {
    setBusy(b.id); setError(null);
    const { error: e } = await supabase.from('resource_bookings').update(patch).eq('id', b.id);
    setBusy(null);
    if (e) return setError(rpcError(e, 'Could not update this booking. Please try again.'));
    supabase.from('notifications').insert({ user_email: b.organizer_email, type: `booking_${patch.status}`, message: `${groupName} ${note} for ${b.event_title}`, link: `/organizer/bookings?booking=${b.id}` }).then(() => {});
    setCountering(null); setCounterRate('');
    load();
  }

  if (!rows) return null;
  return (
    <section className="mt-6 rounded-2xl border border-gray-200 bg-surface p-4 sm:p-5">
      <h2 className="font-display text-lg font-semibold text-bone">Bookings</h2>
      {!canRespond && <p className="mt-1 text-xs text-muted">The group's owner and admins respond to booking requests.</p>}
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No bookings yet. Organizers can book the group from its page.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {rows.map((b) => {
            const price = agreedRate(b);
            const myShare = b.group_split?.find((p) => p.email === user?.email);
            const when = formatServiceDate(b.event_start);
            return (
              <li key={b.id} className={`rounded-xl border bg-white p-3 ${b.status === 'pending' && canRespond ? 'border-orange-300' : 'border-gray-200'}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-900">{b.event_title}</p>
                    <p className="text-xs text-gray-500">From {b.organizer_name ?? b.organizer_email}{when ? ` · ${when}` : ''}{price ? ` · ${money(price)}` : ''}</p>
                  </div>
                  <span className="flex flex-wrap justify-end gap-1.5">
                    {b.status === 'pending' && canRespond && <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-800">Needs a reply</span>}
                    {b.payment_status === 'paid' && <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">Paid</span>}
                    {b.payment_status === 'refunded' && <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">Refunded</span>}
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${BOOKING_STATUS_STYLES[b.status] ?? BOOKING_STATUS_STYLES.pending}`}>{BOOKING_STATUS_LABELS[b.status] ?? b.status}</span>
                  </span>
                </div>
                {b.kind === 'lineup_invite' && <p className="mt-2 rounded-lg bg-purple-50 px-3 py-2 text-sm text-purple-900"><strong>Lineup invite (no payment).</strong> Accept to appear on this event's lineup.</p>}
                {b.message_from_organizer && <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">“{b.message_from_organizer}”</p>}
                {myShare && (
                  <p className="mt-2 text-sm text-emerald-800">
                    Your share: <strong>{money(myShare.cents / 100)}</strong>{myShare.reversal_id ? ' (returned to the organizer)' : myShare.transfer_id ? ', sent to your bank through Stripe' : b.payment_status === 'paid' ? ', being sent' : ''}
                  </p>
                )}
                {canRespond && b.status === 'pending' && (
                  countering === b.id ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <input type="number" min="0" step="0.01" inputMode="decimal" value={counterRate} onChange={(e) => setCounterRate(e.target.value)} placeholder="Your rate ($)" className="w-36 rounded-lg border border-gray-300 px-3 py-2 text-base text-gray-900" />
                      <button disabled={busy === b.id || !counterRate} onClick={() => update(b, { status: 'counter_offered', counter_offer_rate: parseFloat(counterRate) }, `sent a counter offer of ${money(parseFloat(counterRate))}`)} className="rounded-lg bg-marigold px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Send counter</button>
                      <button onClick={() => setCountering(null)} className="text-sm text-muted">Cancel</button>
                    </div>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button disabled={busy === b.id} onClick={() => update(b, { status: 'accepted' }, 'accepted your booking request')} className="rounded-lg bg-marigold px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Accept</button>
                      {b.kind !== 'lineup_invite' && <button disabled={busy === b.id} onClick={() => setCountering(b.id)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700">Counter offer</button>}
                      <button disabled={busy === b.id} onClick={() => update(b, { status: 'rejected' }, 'declined your booking request')} className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-red-600">Decline</button>
                    </div>
                  )
                )}
                {canRespond && (b.status === 'accepted' || b.status === 'confirmed') && (
                  <button disabled={busy === b.id} onClick={() => update(b, { status: 'completed' }, 'marked the booking completed')} className="mt-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700">Mark completed</button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
