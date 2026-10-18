import { useEffect, useMemo, useState } from 'react';
import PremiumBadge, { PremiumNotice } from './PremiumBadge';
import { useFeature } from '../../lib/preview';
import FeatureFeedback from '../feedback/FeatureFeedback';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { ListSkeleton } from '../ui/Skeleton';

const money = (n: number) => `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No date');
const Stat = ({ value, label, tone = '' }: { value: string | number; label: string; tone?: string }) => (
  <div className="rounded-xl border border-gray-200 bg-surface p-3 text-center"><p className={`text-xl font-extrabold ${tone || 'text-bone'}`}>{value}</p><p className="text-xs text-muted">{label}</p></div>
);

// ===== Promote: promotion links and boosts across the organization's events =====
interface PromoEvent { id: string; title: string; start_date: string | null; links: number; visits: number; tickets: number; revenue: number; top_link: string | null; boost: 'live' | 'scheduled' | 'ended' | null; upcoming: boolean }
interface PromoSummary { visits: number; tickets: number; revenue: number; live_boosts: number; events: PromoEvent[]; promoters: { email: string; name: string | null; events: number; tickets: number; revenue: number; commission: number }[] }

export function OrgPromoteTab({ orgId }: { orgId: string }) {
  const [s, setS] = useState<PromoSummary | null>(null);
  const [pick, setPick] = useState('');
  useEffect(() => { supabase.rpc('org_promotion_summary', { p_org_id: orgId }).then(({ data }) => setS((data ?? null) as PromoSummary | null)); }, [orgId]);
  if (!s) return <ListSkeleton rows={4} />;
  const upcoming = s.events.filter((e) => e.upcoming);
  return (
    <div>
      <PremiumNotice feature="The organization Promote tab" featureKey="insights" />
      <p className="mt-2 text-sm text-muted">How your events are being promoted: tracking links, promoters and boosts, all in one place.</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat value={Number(s.visits)} label="link visits" />
        <Stat value={Number(s.tickets)} label="tickets from links" />
        <Stat value={money(s.revenue)} label="from links" />
        <Stat value={Number(s.live_boosts)} label="live boosts" tone="text-indigo-700" />
      </div>

      {upcoming.length > 0 && (
        <div className="mt-4 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-teal-50 p-4">
          <p className="font-semibold text-bone">🚀 Boost an event</p>
          <p className="text-sm text-muted">Show one of your upcoming events in Discover's Promoted row.</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Event to boost" className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900">
              <option value="">Choose an event…</option>
              {upcoming.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
            <Link to={pick ? `/organizer/events/${pick}?tab=Promote` : '#'} aria-disabled={!pick} className={`rounded-xl px-4 py-2.5 text-center text-sm font-semibold text-white ${pick ? 'bg-marigold' : 'pointer-events-none bg-gray-300'}`}>Go to Boost ›</Link>
          </div>
        </div>
      )}

      <h3 className="mt-6 font-display text-lg font-bold text-bone">By event</h3>
      {s.events.length === 0 ? <p className="mt-2 text-sm text-muted">No published events in the last 60 days or coming up.</p> : (
        <ul className="mt-2 flex flex-col gap-2">
          {s.events.map((e) => (
            <li key={e.id} className="rounded-2xl border border-gray-200 bg-surface p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-bone">{e.title}{e.boost === 'live' && <span className="ml-1.5 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase text-green-800">Boost live</span>}{e.boost === 'scheduled' && <span className="ml-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-900">Boost scheduled</span>}</p>
                  <p className="text-xs text-muted">{day(e.start_date)} · {Number(e.links)} link{Number(e.links) === 1 ? '' : 's'}{e.top_link ? ` · best: ${e.top_link}` : ''}</p>
                </div>
                <p className="shrink-0 text-right text-sm"><span className="font-bold text-bone">{money(e.revenue)}</span><span className="block text-xs text-muted">{Number(e.tickets)} tickets · {Number(e.visits)} visits</span></p>
              </div>
              <Link to={`/organizer/events/${e.id}?tab=Promote`} className="mt-1 inline-block text-sm font-medium text-marigold">Promote ›</Link>
            </li>
          ))}
        </ul>
      )}

      {s.promoters.length > 0 && (
        <>
          <h3 className="mt-6 font-display text-lg font-bold text-bone">Promoters</h3>
          <ul className="mt-2 flex flex-col gap-2">
            {s.promoters.map((p) => (
              <li key={p.email} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-surface p-3 text-sm">
                <span className="min-w-0"><span className="block truncate font-semibold text-bone">{p.name || p.email}</span><span className="text-xs text-muted">{Number(p.events)} event{Number(p.events) === 1 ? '' : 's'} · {Number(p.tickets)} tickets · {money(p.revenue)} in sales</span></span>
                <span className="shrink-0 text-right"><span className="block font-bold text-green-700">{money(p.commission)}</span><span className="text-xs text-muted">commission</span></span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-muted">Commission is paid to promoters directly for now.</p>
        </>
      )}
    </div>
  );
}

// ===== Events tab: attendance per event + everyone who's attended =====
export function useOrgAttendance(orgId: string, on: boolean) {
  const [map, setMap] = useState<Record<string, { tickets: number; checked_in: number }>>({});
  useEffect(() => {
    if (!on) return;
    supabase.rpc('org_event_attendance', { p_org_id: orgId }).then(({ data }) => {
      const m: Record<string, { tickets: number; checked_in: number }> = {};
      for (const r of (data ?? []) as { event_id: string; tickets: number; checked_in: number }[]) m[r.event_id] = { tickets: Number(r.tickets), checked_in: Number(r.checked_in) };
      setMap(m);
    });
  }, [orgId, on]);
  return map;
}

interface Attendee { email: string; full_name: string | null; photo: string | null; events: number; tickets: number; spent: number; last_event: string | null; last_date: string | null }

export function OrgAttendees({ orgId, orgName }: { orgId: string; orgName: string }) {
  const [rows, setRows] = useState<Attendee[] | null>(null);
  const [q, setQ] = useState('');
  useEffect(() => { supabase.rpc('org_attendees', { p_org_id: orgId }).then(({ data }) => setRows((data ?? []) as Attendee[])); }, [orgId]);
  const shown = useMemo(() => (rows ?? []).filter((r) => !q.trim() || r.email.includes(q.trim().toLowerCase()) || (r.full_name ?? '').toLowerCase().includes(q.trim().toLowerCase())), [rows, q]);
  function exportCsv() {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = ['Name,Email,Events attended,Tickets,Total spent,Most recent event,Most recent date',
      ...(rows ?? []).map((r) => [r.full_name, r.email, r.events, r.tickets, Number(r.spent).toFixed(2), r.last_event, r.last_date ? r.last_date.slice(0, 10) : ''].map(esc).join(','))].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `${orgName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-attendees.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  }
  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-lg font-bold text-bone">👥 All attendees <PremiumBadge feature="insights" /></h3>
          <p className="text-sm text-muted">Everyone with a ticket to {orgName}'s events. Only Owners and Admins see this.</p>
          <PremiumNotice feature="The attendee list and export" featureKey="insights" />
        </div>
        {!!rows?.length && <button onClick={exportCsv} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700">Export CSV</button>}
      </div>
      {rows === null ? <ListSkeleton rows={3} className="mt-3" /> : rows.length === 0 ? <p className="mt-3 text-sm text-muted">No attendees yet.</p> : (
        <>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${rows.length} people`} aria-label="Search attendees" className="mt-3 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900" />
          <ul className="mt-3 flex flex-col gap-2">
            {shown.slice(0, 200).map((r) => (
              <li key={r.email} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-surface p-3">
                {r.photo ? <img src={r.photo} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-200 font-bold text-gray-600">{(r.full_name || r.email).charAt(0).toUpperCase()}</span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-bone">{r.full_name || r.email}</span>
                  <span className="block truncate text-xs text-muted">{r.email} · {Number(r.events)} event{Number(r.events) === 1 ? '' : 's'}{Number(r.spent) > 0 ? ` · ${money(r.spent)}` : ''}</span>
                  {r.last_event && <span className="block truncate text-xs text-muted">Last: {r.last_event} ({day(r.last_date)})</span>}
                </span>
              </li>
            ))}
          </ul>
          {shown.length > 200 && <p className="mt-2 text-xs text-muted">Showing 200 of {shown.length}. Export CSV for everyone.</p>}
          <FeatureFeedback feature="org_attendees" label="the attendee list" className="mt-3" />
        </>
      )}
    </section>
  );
}

// ===== Sales & payouts: sales across the organization's events =====
interface Sales { tickets: number; invoices: number; merch: number; donations: number; vendor_fees: number; refunds: number; tickets_sold: number; registrations: number;
  by_event: { id: string; title: string; start_date: string | null; gross: number; refunds: number; tickets_sold: number; registrations: number }[]; by_month: { month: string; gross: number }[] }
const PERIODS = [{ id: 'month', label: 'This month' }, { id: 'year', label: 'This year' }, { id: 'all', label: 'All time' }] as const;

export function OrgSales({ orgId }: { orgId: string }) {
  const planPageOn = useFeature('business_plan_page');
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['id']>('year');
  const [s, setS] = useState<Sales | null>(null);
  useEffect(() => {
    setS(null);
    const now = new Date();
    const from = period === 'month' ? new Date(now.getFullYear(), now.getMonth(), 1) : period === 'year' ? new Date(now.getFullYear(), 0, 1) : null;
    supabase.rpc('org_sales', { p_org_id: orgId, p_from: from?.toISOString() ?? null, p_to: null }).then(({ data }) => setS((data ?? null) as Sales | null));
  }, [orgId, period]);
  const gross = s ? Number(s.tickets) + Number(s.invoices) + Number(s.merch) + Number(s.donations) + Number(s.vendor_fees) : 0;
  const maxMonth = Math.max(1, ...(s?.by_month ?? []).map((m) => Number(m.gross)));
  return (
    <section className="mb-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg font-bold text-bone">📈 Sales <PremiumBadge feature="insights" /></h3>
        <div className="flex gap-1.5">{PERIODS.map((p) => <button key={p.id} onClick={() => setPeriod(p.id)} aria-pressed={period === p.id} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${period === p.id ? 'bg-[#0F1B3D] text-white' : 'border border-gray-200 bg-white text-gray-700'}`}>{p.label}</button>)}</div>
      </div>
      {!s ? <ListSkeleton rows={3} className="mt-3" /> : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat value={money(gross - Number(s.refunds))} label="net sales" tone="text-green-700" />
            <Stat value={money(gross)} label="gross" />
            <Stat value={Number(s.tickets_sold)} label="tickets sold" />
            <Stat value={Number(s.registrations)} label="free registrations" />
          </div>
          <div className="mt-3 rounded-2xl border border-gray-200 bg-surface p-3 text-sm">
            {[['Tickets', s.tickets], ['Invoices', s.invoices], ['Donations & support', s.donations], ['Vendor fees', s.vendor_fees], ['Event merch', s.merch]].map(([label, v]) => (
              <div key={label as string} className="flex justify-between py-0.5 text-bone"><span>{label}</span><span>{money(Number(v))}</span></div>
            ))}
            <div className="flex justify-between py-0.5 text-red-600"><span>Refunds</span><span>−{money(Number(s.refunds))}</span></div>
            <div className="mt-1 flex justify-between border-t border-gray-200 pt-1 font-bold text-bone"><span>Net</span><span>{money(gross - Number(s.refunds))}</span></div>
            <p className="mt-1 text-xs text-muted">Amounts are what attendees paid for tickets and items (before TapIN fees, which buyers pay on top). Donations show what you receive.</p>
          </div>
          {s.by_month.length > 1 && (
            <div className="mt-3 rounded-2xl border border-gray-200 bg-surface p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Last 12 months</p>
              <div className="mt-2 flex h-24 items-end gap-1">
                {s.by_month.map((m) => (
                  <div key={m.month} className="flex flex-1 flex-col items-center gap-1" title={`${m.month}: ${money(Number(m.gross))}`}>
                    <div className="w-full rounded-t bg-indigo-400" style={{ height: `${Math.max(4, (Number(m.gross) / maxMonth) * 80)}px` }} />
                    <span className="text-[9px] text-muted">{new Date(`${m.month}-15`).toLocaleDateString('en-US', { month: 'short' })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <FeatureFeedback feature="org_sales" label="these sales insights" className="mt-3" />
          {planPageOn && <Link to="/business/plan" className="mt-3 flex items-center justify-between gap-3 rounded-2xl border-2 border-[#C9A227] bg-white p-3 text-sm"><span><strong className="text-gray-900">Business plan, coming soon</strong><span className="block text-gray-600">See what's planned and reserve founding pricing</span></span><span className="shrink-0 font-semibold text-[#C9A227]">Reserve ›</span></Link>}
          <h4 className="mt-4 font-semibold text-bone">By event</h4>
          {s.by_event.length === 0 ? <p className="mt-1 text-sm text-muted">No sales in this period.</p> : (
            <ul className="mt-2 flex flex-col gap-2">
              {s.by_event.map((e) => (
                <li key={e.id}><Link to={`/organizer/events/${e.id}?tab=Sales`} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-surface p-3 text-sm hover:border-[#C9A227]">
                  <span className="min-w-0"><span className="block truncate font-medium text-bone">{e.title}</span><span className="text-xs text-muted">{day(e.start_date)} · {Number(e.tickets_sold)} sold{Number(e.registrations) ? ` · ${Number(e.registrations)} registered` : ''}</span></span>
                  <span className="shrink-0 text-right"><span className="block font-bold text-bone">{money(Number(e.gross) - Number(e.refunds))}</span>{Number(e.refunds) > 0 && <span className="text-xs text-red-600">−{money(Number(e.refunds))} refunds</span>}</span>
                </Link></li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
