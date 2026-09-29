import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { money } from '../../lib/bookings';
import { LoadingRegion, Skeleton } from '../ui/Skeleton';
import { fmtDate } from './shared';

interface Overview {
  users: number; users_30d: number; organizers: number; resources: number; banned: number;
  events_upcoming: number; events_total: number; posts: number;
  gross_sales: number; fees_collected: number; fees_30d: number; gross_30d: number; refunded: number;
  by_source: { source: string; gross: number; fees: number }[];
  monthly: { month: string; signups: number; fees: number; gross: number }[];
  open_reports: number;
}
interface Health {
  unconnected_paid_organizers: { id: string; full_name: string | null; email: string; events: number; next_date: string }[];
  recent_refunds: { kind: string; id: string; label: string; email: string; amount: number; refunded_at: string }[];
  paid_bookings_on_cancelled_events: { id: string; title: string; organizer_email: string; display_name: string; final_rate: number }[];
  email_failures: { id: string; kind: string; attempts: number; last_error: string | null; created_at: string }[];
  email_queue: number; emails_sent_24h: number;
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 text-center sm:p-4">
      <p className="font-display text-xl font-extrabold text-marigold sm:text-2xl">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
      {sub && <p className="mt-0.5 text-[11px] text-gray-400">{sub}</p>}
    </div>
  );
}

function Bars({ title, data, color, format }: { title: string; data: { label: string; value: number }[]; color: string; format: (n: number) => string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      <div className="mt-3 flex h-28 items-end gap-1" role="img" aria-label={`${title}, last 12 months`}>
        {data.map((d) => (
          <div key={d.label} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${d.label}: ${format(d.value)}`}>
            <div className={`w-full rounded-t ${color}`} style={{ height: `${Math.max((d.value / max) * 100, d.value > 0 ? 4 : 1)}%`, opacity: d.value > 0 ? 1 : 0.25 }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-gray-400"><span>{data[0]?.label}</span><span>{data[data.length - 1]?.label}</span></div>
    </div>
  );
}

const SOURCE_LABELS: Record<string, string> = { 'tickets & merch': 'Tickets & merchandise', 'vendor fees': 'Vendor fees', tips: 'Tips', bookings: 'Resource bookings' };

export default function OverviewTab({ onOpenTab }: { onOpenTab: (tab: string, q?: string) => void }) {
  const [ov, setOv] = useState<Overview | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    (async () => {
      const [a, b] = await Promise.all([supabase.rpc('admin_overview'), supabase.rpc('admin_health')]);
      if (a.error || b.error) { console.error(a.error ?? b.error); setError(true); return; }
      setOv(a.data as Overview);
      setHealth(b.data as Health);
    })();
  }, []);

  if (error) return <p className="mt-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Couldn't load the overview. Please refresh.</p>;
  if (!ov || !health) {
    return (
      <LoadingRegion className="mt-6 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
        <Skeleton className="h-40 rounded-xl" />
      </LoadingRegion>
    );
  }

  const attention: { key: string; tone: 'red' | 'orange'; text: string; action?: { label: string; onClick: () => void } }[] = [];
  if (ov.open_reports > 0) attention.push({ key: 'reports', tone: 'red', text: `${ov.open_reports} reported post${ov.open_reports === 1 ? '' : 's'} or comment${ov.open_reports === 1 ? '' : 's'} to review`, action: { label: 'Review', onClick: () => onOpenTab('Reports') } });
  if (health.email_failures.length > 0) attention.push({ key: 'emails', tone: 'red', text: `${health.email_failures.length} email${health.email_failures.length === 1 ? '' : 's'} failed to send after several tries (${health.email_failures[0].kind}${health.email_failures[0].last_error ? ': ' + health.email_failures[0].last_error : ''})` });
  health.paid_bookings_on_cancelled_events.forEach((b) => attention.push({ key: 'pb' + b.id, tone: 'red', text: `${b.organizer_email} paid ${money(b.final_rate)} to ${b.display_name} for "${b.title}", which was cancelled. The organizer needs to cancel & refund it.` }));
  health.unconnected_paid_organizers.forEach((o) => attention.push({
    key: 'org' + o.id, tone: 'orange',
    text: `${o.full_name || o.email} sells paid tickets (${o.events} upcoming event${o.events === 1 ? '' : 's'}, next ${fmtDate(o.next_date)}) but hasn't connected Stripe payouts, so the money is going to TapIN's account.`,
    action: { label: 'Find user', onClick: () => onOpenTab('Users', o.email) },
  }));

  return (
    <div className="mt-6 flex flex-col gap-5">
      <section aria-label="Needs attention">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Needs attention</h2>
        {attention.length === 0 ? (
          <p className="mt-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">✓ All clear. No reports, failed emails, or payout problems.</p>
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            {attention.map((a) => (
              <div key={a.key} className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3 text-sm ${a.tone === 'red' ? 'border-red-200 bg-red-50 text-red-900' : 'border-orange-200 bg-orange-50 text-orange-900'}`}>
                <span className="min-w-0 flex-1">{a.text}</span>
                {a.action && <button onClick={a.action.onClick} className="shrink-0 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-800 shadow-sm hover:text-marigold">{a.action.label}</button>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section aria-label="Money" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="TapIN fees (all time)" value={money(ov.fees_collected)} sub="before Stripe's cut" />
        <Stat label="TapIN fees (30 days)" value={money(ov.fees_30d)} />
        <Stat label="Sales through TapIN" value={money(ov.gross_sales)} sub={`${money(ov.gross_30d)} in 30 days`} />
        <Stat label="Refunded" value={money(ov.refunded)} />
      </section>

      <section aria-label="Platform" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Users" value={ov.users} sub={`+${ov.users_30d} in 30 days`} />
        <Stat label="Organizers" value={ov.organizers} />
        <Stat label="Active resources" value={ov.resources} />
        <Stat label="Upcoming events" value={ov.events_upcoming} sub={`${ov.events_total} total`} />
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Bars title="Fees collected per month" color="bg-marigold" data={ov.monthly.map((m) => ({ label: m.month, value: Number(m.fees) }))} format={money} />
        <Bars title="New users per month" color="bg-teal" data={ov.monthly.map((m) => ({ label: m.month, value: Number(m.signups) }))} format={(n) => String(n)} />
      </section>

      {ov.by_source.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-sm font-semibold text-gray-900">Where the money comes from</p>
          <div className="mt-2 divide-y divide-gray-100">
            {ov.by_source.map((s) => (
              <div key={s.source} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-gray-700">{SOURCE_LABELS[s.source] ?? s.source}</span>
                <span className="text-right text-gray-900"><strong>{money(s.fees)}</strong> <span className="text-xs text-gray-400">fees on {money(s.gross)}</span></span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-400">Vendor-fee amounts are estimated from TapIN's fee formula.</p>
        </section>
      )}

      {health.recent_refunds.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-sm font-semibold text-gray-900">Recent refunds (60 days)</p>
          <div className="mt-2 divide-y divide-gray-100">
            {health.recent_refunds.slice(0, 8).map((r) => (
              <div key={r.kind + r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate text-gray-700">{r.label} <span className="text-xs text-gray-400">· {r.kind} · {r.email}</span></span>
                <span className="shrink-0 text-gray-900">{money(r.amount)} <span className="text-xs text-gray-400">{fmtDate(r.refunded_at)}</span></span>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="text-xs text-gray-400">
        Emails: {health.emails_sent_24h} sent in the last 24 hours{health.email_queue > 0 ? `, ${health.email_queue} waiting` : ''}. Details of every admin change are in the <Link to="/admin?tab=Activity" className="text-marigold hover:underline">Activity</Link> tab.
      </p>
    </div>
  );
}
