import { useEffect, useState } from 'react';
import { toast, toastError } from '../../lib/toast';
import PremiumUsagePanel from './PremiumUsagePanel';
import { supabase } from '../../lib/supabaseClient';
import { ListSkeleton } from '../ui/Skeleton';

interface Row { feature: string; people: number; uses: number; uses_30d: number; repeat_people: number; last_used: string | null; love: number; ok: number; meh: number; would_pay: number }
interface Data {
  features: Row[];
  comments: { feature: string; rating: string; worth_paying: string | null; comment: string | null; name: string | null; email: string; at: string }[];
  reservations: { org: string | null; email: string; name: string | null; plan: string; features: string[]; note: string | null; at: string; founding_number: number | null }[];
  wanted: { feature: string; votes: number }[];
}
const NAMES: Record<string, string> = {
  templates: 'Event templates', invoices: 'Pay-by-invoice', receipts: 'Business receipts', promo_codes: 'Promo codes', ticket_types: 'Ticket types',
  promotion_links: 'Promotion links', boost: 'Boost', networking: 'Networking (joined)', networking_connections: 'Networking connections', meetings: 'Meetings',
  find_a_time: 'Find a time polls', org_photos: 'Organization photos', planning_tasks: 'Planning tasks', scouting: 'Scouting boards', donations: 'Donations',
  profile_qr: 'Personal TapIN QR', qr_scan: 'In-app QR scans', org_sales: 'Sales insights', org_attendees: 'Attendee list',
};
const PLAN: Record<string, string> = { monthly: 'Monthly', yearly: 'Yearly', per_event: 'Per event', unsure: 'Not sure yet' };
const ago = (iso: string | null) => { if (!iso) return '—'; const d = Math.round((Date.now() - new Date(iso).getTime()) / 86400000); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d}d ago`; };

// Admin > Usage: which features people use (and come back to), what they say about them, and Business plan reservations.
export default function UsageTab() {
  const [d, setD] = useState<Data | null>(null);
  useEffect(() => { supabase.rpc('admin_feature_usage').then(({ data }) => setD((data ?? null) as Data | null)); }, []);
  if (!d) return <ListSkeleton rows={6} />;
  return (
    <div className="flex flex-col gap-8">
      <ComplimentaryAccess />
      <DomainCount />
      <section>
        <h2 className="font-display text-xl font-bold text-bone">Feature usage</h2>
        <p className="text-sm text-muted">Who uses each feature and whether they come back. "Repeat" = people who used it on 2 or more events. Feedback comes from the one-question check-ins.</p>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-gray-200 bg-surface">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-muted">
              <th className="p-3 font-semibold">Feature</th><th className="p-3 text-right font-semibold">People</th><th className="p-3 text-right font-semibold">Uses</th><th className="p-3 text-right font-semibold">30 days</th><th className="p-3 text-right font-semibold">Repeat</th><th className="p-3 font-semibold">Feedback</th><th className="p-3 text-right font-semibold">Last used</th>
            </tr></thead>
            <tbody>
              {d.features.map((r) => (
                <tr key={r.feature} className="border-b border-gray-100 last:border-0">
                  <td className="p-3 font-medium text-bone">{NAMES[r.feature] ?? r.feature}</td>
                  <td className="p-3 text-right">{r.people}</td><td className="p-3 text-right">{r.uses}</td>
                  <td className="p-3 text-right font-semibold text-bone">{r.uses_30d}</td><td className="p-3 text-right">{r.repeat_people}</td>
                  <td className="p-3 text-xs text-muted">{r.love + r.ok + r.meh > 0 ? <>🔥 {r.love} · 👌 {r.ok} · 👎 {r.meh}{r.would_pay ? <span className="ml-1 font-semibold text-green-700">· {r.would_pay} would pay</span> : null}</> : '—'}</td>
                  <td className="p-3 text-right text-xs text-muted">{ago(r.last_used)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <BillingAdmin />

      <PremiumUsagePanel />
      <NewsletterAdmin />

      <section>
        <h2 className="font-display text-xl font-bold text-bone">Business plan reservations <span className="text-base font-normal text-muted">· {d.reservations.length}</span></h2>
        {d.wanted.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {d.wanted.map((w) => <span key={w.feature} className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-800">{w.feature} · {w.votes}</span>)}
          </div>
        )}
        {d.reservations.length === 0 ? <p className="mt-2 text-sm text-muted">No reservations yet.</p> : (
          <ul className="mt-3 flex flex-col gap-2">
            {d.reservations.map((r, i) => (
              <li key={i} className="rounded-xl border border-gray-200 bg-surface p-3 text-sm">
                <p className="font-semibold text-bone">{r.org || 'No organization yet'}{r.founding_number ? <span className="ml-1.5 text-xs text-[#C9A227]">Founding #{r.founding_number}</span> : null} <span className="font-normal text-muted">· {PLAN[r.plan] ?? r.plan}</span></p>
                <p className="text-xs text-muted">{r.name || r.email} · {r.email} · {ago(r.at)}</p>
                {r.features.length > 0 && <p className="mt-1 text-xs text-bone">Wants: {r.features.join(', ')}</p>}
                {r.note && <p className="mt-1 text-xs italic text-muted">“{r.note}”</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-display text-xl font-bold text-bone">Recent feedback</h2>
        {d.comments.length === 0 ? <p className="mt-2 text-sm text-muted">No feedback yet. Check-ins appear after people use invoices, promotion links, Boost, networking, meetings, templates and organization insights.</p> : (
          <ul className="mt-3 flex flex-col gap-2">
            {d.comments.map((c, i) => (
              <li key={i} className="rounded-xl border border-gray-200 bg-surface p-3 text-sm">
                <p className="text-bone"><span className="mr-1">{c.rating === 'love' ? '🔥' : c.rating === 'ok' ? '👌' : '👎'}</span><strong>{NAMES[c.feature] ?? c.feature}</strong>{c.worth_paying && <span className="text-muted"> · worth paying: {c.worth_paying}</span>}</p>
                {c.comment && <p className="mt-1 text-bone">“{c.comment}”</p>}
                <p className="mt-1 text-xs text-muted">{c.name || c.email} · {ago(c.at)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// Organization newsletters: sending mode and Resend contacts (free plan includes 1,000 marketing contacts).
function NewsletterAdmin() {
  const [st, setSt] = useState<{ mode: string; daily_cap: string; resend_contacts: number; campaigns_sent: number; emails_sent: number } | null>(null);
  const load = () => supabase.rpc('newsletter_admin_status').then(({ data }) => setSt((data ?? null) as typeof st));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!st) return null;
  const used = Number(st.resend_contacts) || 0;
  const pct = Math.min(100, Math.round((used / 1000) * 100));
  async function setMode(mode: 'broadcast' | 'direct') {
    if (!window.confirm(mode === 'direct' ? 'Send organization newsletters one at a time through the everyday-email plan? Use this after upgrading Resend Pro ($20/mo), ideally from a separate newsletter subdomain.' : 'Send organization newsletters through Resend Broadcasts (free up to 1,000 contacts)?')) return;
    await supabase.rpc('set_newsletter_mode', { p_mode: mode }); load();
  }
  return (
    <section>
      <h2 className="font-display text-xl font-bold text-bone">Newsletters</h2>
      <div className="mt-3 rounded-2xl border border-gray-200 bg-surface p-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-bone"><strong>{used}</strong> of 1,000 free newsletter contacts used <span className="text-muted">(Resend marketing)</span></p>
          <p className="text-muted">{st.campaigns_sent} emails sent · {st.emails_sent} deliveries</p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200"><div className={`h-full ${pct >= 85 ? 'bg-red-500' : pct >= 60 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${pct}%` }} /></div>
        {pct >= 85 && <p className="mt-2 text-xs font-semibold text-red-600">Close to the free limit. Upgrade Resend marketing ($40/mo for 5,000) or switch to one-at-a-time sending on Resend Pro ($20/mo).</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-muted">Sending:</span>
          {(['broadcast', 'direct'] as const).map((m) => (
            <button key={m} onClick={() => st.mode !== m && setMode(m)} aria-pressed={st.mode === m}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${st.mode === m ? 'bg-[#0F1B3D] text-white' : 'border border-gray-300 bg-white text-gray-700'}`}>
              {m === 'broadcast' ? 'Newsletter feature (free to 1,000)' : `One at a time (${st.daily_cap}/day cap)`}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

// Business plan billing: who's subscribed, and the enforcement switch (off = premium features free for everyone).
function BillingAdmin() {
  const [b, setB] = useState<{ enforcement: string; subscriptions: { org: string; interval: string | null; status: string | null; renews_at: string | null; founding: boolean; cancelling: boolean }[]; event_purchases: number } | null>(null);
  const load = () => supabase.rpc('billing_admin_status').then(({ data }) => setB((data ?? null) as typeof b));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!b) return null;
  const on = b.enforcement === 'on';
  async function toggle() {
    if (!on && !window.confirm('Turn ON enforcement? Organizations without the Business plan will be asked for a plan to use premium features. Give organizations notice first. You can turn it back off anytime.')) return;
    await supabase.rpc('set_billing_enforcement', { p_on: !on }); load();
  }
  return (
    <section>
      <h2 className="font-display text-xl font-bold text-bone">Business plan billing</h2>
      <div className="mt-3 rounded-2xl border border-gray-200 bg-surface p-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-bone"><strong>{b.subscriptions.filter((x) => ['active', 'trialing', 'past_due'].includes(x.status ?? '')).length}</strong> active subscriptions · <strong>{b.event_purchases}</strong> single-event purchases</p>
          <button onClick={toggle} className={`rounded-full px-3 py-1.5 text-xs font-bold ${on ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700'}`}>Enforcement: {on ? 'ON' : 'OFF'}</button>
        </div>
        <p className="mt-1 text-xs text-muted">{on ? 'Premium features require a plan.' : 'Premium features are free for everyone ("free for now"). Plans can still be purchased.'}</p>
        <StripeKeyField />
        {b.subscriptions.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1">
            {b.subscriptions.map((x, i) => <li key={i} className="flex justify-between gap-2"><span className="truncate text-bone">{x.org}{x.founding ? ' · founding' : ''}</span><span className="shrink-0 text-muted">{x.interval ?? ''} · {x.status ?? '—'}{x.cancelling ? ' · cancelling' : ''}{x.renews_at ? ` · ${new Date(x.renews_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}</span></li>)}
          </ul>
        )}
      </div>
    </section>
  );
}

// Stripe's publishable key (public by design) for embedded checkout on white-labeled events.
function StripeKeyField() {
  const [current, setCurrent] = useState<string | null | undefined>(undefined);
  const [val, setVal] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { supabase.rpc('stripe_publishable_key').then(({ data }) => setCurrent((data as string | null) ?? null)); }, []);
  async function save() {
    const { error } = await supabase.rpc('set_stripe_publishable_key', { p_key: val.trim() });
    if (error) return setMsg(error.message);
    setCurrent(val.trim()); setVal(''); setMsg('Saved. White-labeled events now use embedded checkout.');
  }
  if (current === undefined) return null;
  return (
    <div className="mt-4 border-t border-gray-200 pt-3">
      <p className="text-sm font-medium text-bone">Stripe publishable key <span className="font-normal text-muted">(for embedded checkout on white-labeled events)</span></p>
      {current ? <p className="mt-1 text-xs text-green-700">✓ Set ({current.slice(0, 8)}…{current.slice(-4)})</p> : <p className="mt-1 text-xs text-muted">Not set yet. In Stripe: Developers → API keys → Publishable key (starts with pk_live_). It's safe to share; it can only start a checkout.</p>}
      <div className="mt-2 flex gap-2">
        <input value={val} onChange={(e) => setVal(e.target.value)} placeholder="pk_live_…" aria-label="Stripe publishable key" className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" />
        <button onClick={save} disabled={!val.trim()} className="rounded-xl bg-[#0F1B3D] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{current ? 'Replace' : 'Save'}</button>
      </div>
      {msg && <p className="mt-1 text-xs text-muted">{msg}</p>}
    </div>
  );
}

// Custom addresses in use vs Cloudflare's 100 free (app.tapin2events.com counts as one). Heads-up from 80.
function DomainCount() {
  const [d, setD] = useState<{ connected: number; redirecting: number; used: number; limit: number } | null>(null);
  useEffect(() => { supabase.rpc('admin_domain_count').then(({ data }) => setD((data ?? null) as typeof d)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return null;
  const warn = d.used >= 80;
  return (
    <section className={`rounded-2xl border p-4 ${warn ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-surface'}`}>
      <p className="text-sm font-semibold text-bone">🌐 Custom addresses: {d.used} of {d.limit}</p>
      <p className="mt-0.5 text-xs text-muted">{d.connected} connected · {d.redirecting} redirecting after disconnecting · plus app.tapin2events.com</p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200"><div className={`h-full ${warn ? 'bg-amber-500' : 'bg-marigold'}`} style={{ width: `${Math.min(100, (d.used / d.limit) * 100)}%` }} /></div>
      {warn && <p className="mt-2 text-xs font-medium text-amber-900">Getting close to Cloudflare's 100 free custom addresses. Time to move free name.tapin2events.com addresses to a wildcard setup (they'd stop counting) and own domains to Cloudflare for SaaS.</p>}
    </section>
  );
}

// People who get every premium feature free (their own events and organizations they own), even after billing
// turns on. Optional note and end date.
function ComplimentaryAccess() {
  const [rows, setRows] = useState<{ email: string; name: string | null; note: string | null; expires_at: string | null; active: boolean; orgs: string[] }[] | null>(null);
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [until, setUntil] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => supabase.rpc('admin_complimentary_list').then(({ data }) => setRows((data ?? []) as NonNullable<typeof rows>));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function save(remove = false, who = email) {
    if (remove && !window.confirm(`Remove complimentary access for ${who}?`)) return;
    setBusy(true);
    const { error } = await supabase.rpc('admin_set_complimentary', { p_email: who, p_note: remove ? null : note, p_expires_at: !remove && until ? new Date(`${until}T23:59:59`).toISOString() : null, p_remove: remove });
    setBusy(false);
    if (error) return toastError(error.message);
    toast(remove ? 'Removed' : '✓ Complimentary access added');
    if (!remove) { setEmail(''); setNote(''); setUntil(''); }
    load();
  }
  const field = 'rounded-xl border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 sm:text-sm';
  return (
    <section>
      <h2 className="font-display text-xl font-bold text-bone">🎁 Complimentary access</h2>
      <p className="mt-1 text-sm text-muted">These people get every premium feature free, for their own events and the organizations they own, even after billing turns on.</p>
      {rows && rows.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.email} className={`flex flex-wrap items-start justify-between gap-2 rounded-xl border p-3 text-sm ${r.active ? 'border-gray-200 bg-surface' : 'border-gray-200 bg-gray-50 opacity-70'}`}>
              <span className="min-w-0">
                <span className="block font-semibold text-bone [overflow-wrap:anywhere]">{r.name ? `${r.name} · ` : ''}{r.email}</span>
                <span className="block text-xs text-muted">
                  {[r.note, r.orgs.length ? `Owns: ${r.orgs.join(', ')}` : null, r.expires_at ? `${r.active ? 'Until' : 'Ended'} ${new Date(r.expires_at).toLocaleDateString()}` : 'No end date'].filter(Boolean).join(' · ')}
                </span>
              </span>
              <button onClick={() => save(true, r.email)} disabled={busy} className="shrink-0 text-xs text-gray-500 hover:text-red-600">Remove</button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="their@email.com" autoCapitalize="none" aria-label="Email" className={field} />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" aria-label="Note" className={field} />
        <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} aria-label="End date (optional)" title="End date (optional)" className={field} />
        <button onClick={() => save(false)} disabled={busy || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())} className="rounded-xl bg-[#0F1B3D] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Add</button>
      </div>
    </section>
  );
}
