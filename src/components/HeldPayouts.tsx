import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

// Ticket money TapIN is holding because payouts aren't connected yet (payout_holds).
const dollars = (c: number) => `$${(c / 100).toFixed(2)}`;

// Organizer Dashboard / TapIN for Business: money waiting for you and for each organization you run.
export function HeldPayoutsNotice({ orgsOnly = false }: { orgsOnly?: boolean }) {
  const [d, setD] = useState<{ personal_cents: number; orgs: { org_id: string; name: string; slug: string | null; cents: number }[] } | null>(null);
  useEffect(() => { supabase.rpc('my_held_payouts').then(({ data }) => setD((data ?? null) as typeof d)); }, []);
  if (!d) return null;
  const rows = [
    ...(!orgsOnly && d.personal_cents > 0 ? [{ key: 'me', text: `${dollars(d.personal_cents)} from your ticket sales is waiting for you.`, to: '/profile#payouts' }] : []),
    ...(d.orgs ?? []).map((o) => ({ key: o.org_id, text: `${dollars(o.cents)} from ticket sales is waiting for ${o.name}.`, to: o.slug ? `/business/${o.slug}/manage` : '/business' })),
  ];
  if (!rows.length) return null;
  return (
    <div className="mb-4 flex flex-col gap-2">
      {rows.map((r) => (
        <div key={r.key} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-900"><span aria-hidden="true">💰 </span><strong>{r.text}</strong> TapIN is holding it safely and sends it automatically once payouts are connected.</p>
          <Link to={r.to} className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white">Connect payouts</Link>
        </div>
      ))}
    </div>
  );
}

// Event dashboard: a heads-up when this paid event's ticket money would be held.
export function EventPayoutWarning({ eventId, paid }: { eventId: string; paid: boolean }) {
  const [d, setD] = useState<{ ready: boolean; split: boolean; holds_for: string; org_name: string | null; org_slug: string | null; held_cents: number } | null>(null);
  useEffect(() => { if (paid) supabase.rpc('event_payout_info', { p_event_id: eventId }).then(({ data }) => setD((data ?? null) as typeof d)); }, [eventId, paid]);
  if (!paid || !d || d.ready || d.split) return null;
  const forOrg = d.holds_for === 'organization' && d.org_name;
  const to = forOrg ? (d.org_slug ? `/business/${d.org_slug}/manage` : '/business') : '/profile#payouts';
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3">
      <p className="text-sm text-amber-900">
        <span aria-hidden="true">💰 </span>
        <strong>{forOrg ? `${d.org_name} hasn't connected payouts yet.` : "You haven't connected payouts yet."}</strong>{' '}
        Tickets still sell, and TapIN holds the money safely{d.held_cents > 0 ? ` (${dollars(d.held_cents)} so far)` : ''} until {forOrg ? 'the organization connects' : 'you connect'} payouts. Then it's sent automatically.
      </p>
      <Link to={to} className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white">Connect payouts</Link>
    </div>
  );
}
