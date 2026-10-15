import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

interface OrgPlan { id: string; name: string; slug: string; role: string; founding_number: number | null; plan: string; interval: string | null; status: string | null; renews_at: string | null; cancel_at_period_end: boolean }
interface EventPlan { id: string; title: string; start_date: string | null; has_plan: boolean }
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
const isActive = (o: OrgPlan) => o.plan === 'business' && ['active', 'trialing', 'past_due'].includes(o.status ?? '');
async function call(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('business-plan', { body: { ...body, returnBase: `${window.location.origin}${import.meta.env.BASE_URL}` } });
  if (error) { let m = "Couldn't reach billing. Please try again."; try { const j = await (error as { context?: Response }).context?.json(); if (j?.error) m = j.error; } catch { /* default */ } throw new Error(m); }
  return data as { url?: string; status?: string };
}

// Business plan page (Preview): start a plan for an organization, buy one event, or manage billing.
export default function PlanCheckout() {
  const [st, setSt] = useState<{ enforcement: string; orgs: OrgPlan[]; events: EventPlan[] } | null>(null);
  const [interval, setInterval_] = useState<'month' | 'year'>('year');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = () => supabase.rpc('my_plan_status').then(({ data }) => setSt((data ?? null) as typeof st));
  useEffect(() => {
    // Back from Stripe: confirm right away.
    const q = new URLSearchParams(window.location.search);
    const org = q.get('org'); const ev = q.get('event');
    (async () => {
      if (q.get('done') && org) { try { await call({ action: 'sync', org_id: org }); setMsg({ ok: true, text: '🎉 Your Business plan is active. Thank you!' }); } catch { /* the hourly sync will catch up */ } }
      if (q.get('done') && ev) { try { await call({ action: 'sync_event', event_id: ev }); setMsg({ ok: true, text: '🎉 Business plan features are unlocked for your event. Thank you!' }); } catch { /* hourly sync */ } }
      load();
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function go(key: string, body: Record<string, unknown>) {
    setBusy(key); setMsg(null);
    try { const r = await call(body); if (r.url) window.location.href = r.url; else setBusy(null); }
    catch (e) { setBusy(null); setMsg({ ok: false, text: (e as Error).message }); }
  }
  if (!st) return null;
  const leads = st.orgs.filter((o) => o.role === 'owner' || o.role === 'admin');
  const events = st.events.filter((e) => !e.has_plan);
  return (
    <section id="get-plan" className="mt-10 max-w-2xl scroll-mt-24 rounded-2xl border-2 border-[#0F1B3D] p-5">
      <p className="flex flex-wrap items-center gap-2 font-display text-2xl font-bold text-bone">Get the Business plan <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700">Preview</span></p>
      <p className="mt-1 text-sm text-muted">Secure checkout with Stripe. Cancel anytime from Manage billing.{st.enforcement !== 'on' ? ' Features stay free for everyone during early access either way.' : ''}</p>
      {msg && <p role="status" className={`mt-3 rounded-xl px-3 py-2 text-sm ${msg.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{msg.text}</p>}

      {leads.length > 0 && (
        <>
          <div className="mt-4 inline-flex rounded-full border border-gray-200 bg-white p-1">
            {(['month', 'year'] as const).map((i) => <button key={i} onClick={() => setInterval_(i)} aria-pressed={interval === i} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${interval === i ? 'bg-[#0F1B3D] text-white' : 'text-gray-600'}`}>{i === 'month' ? 'Monthly' : 'Yearly · 2 months free'}</button>)}
          </div>
          <ul className="mt-3 flex flex-col gap-2">
            {leads.map((o) => {
              const full = interval === 'month' ? 59 : 590;
              const price = o.founding_number ? Math.round(full * 0.6 * 100) / 100 : full;
              return (
                <li key={o.id} className="rounded-2xl border border-gray-200 bg-surface p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-bone">{o.name}{o.founding_number ? <span className="ml-1.5 text-xs text-[#C9A227]">Founding #{o.founding_number}</span> : null}</p>
                      {isActive(o) ? (
                        <p className="text-sm text-green-700">✓ Business plan · {o.interval === 'year' ? 'Yearly' : 'Monthly'}{o.status === 'past_due' ? ' · payment past due' : ''} · {o.cancel_at_period_end ? `ends ${day(o.renews_at)}` : `renews ${day(o.renews_at)}`}</p>
                      ) : (
                        <p className="text-sm text-muted">{o.founding_number && <span className="mr-1 text-gray-400 line-through">${full.toLocaleString()}</span>}<strong className="text-bone">${price.toLocaleString()}</strong>/{interval === 'month' ? 'month' : 'year'}{o.founding_number ? ' · 40% off for life' : ''}</p>
                      )}
                    </div>
                    {isActive(o) ? (
                      <button onClick={() => go(`portal-${o.id}`, { action: 'portal', org_id: o.id })} disabled={!!busy} className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50">{busy === `portal-${o.id}` ? 'Opening…' : 'Manage billing'}</button>
                    ) : (
                      <button onClick={() => go(`org-${o.id}`, { action: 'checkout', org_id: o.id, interval })} disabled={!!busy} className="rounded-xl bg-[#C9A227] px-4 py-2 text-sm font-bold text-[#0F1B3D] disabled:opacity-50">{busy === `org-${o.id}` ? 'Opening checkout…' : 'Start Business plan'}</button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <div className="mt-6">
        <p className="font-semibold text-bone">Organizing on your own?</p>
        <p className="text-sm text-muted">Unlock Business plan features for a single event: <strong className="text-bone">$199</strong>, one time.</p>
        {events.length === 0 ? <p className="mt-2 text-sm text-muted">{st.events.length ? 'All your upcoming events already have Business plan features.' : 'Create an event first, then come back to unlock it.'}</p> : (
          <ul className="mt-2 flex flex-col gap-2">
            {events.slice(0, 8).map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-surface px-3 py-2 text-sm">
                <span className="min-w-0 truncate text-bone">{e.title}{e.start_date ? <span className="text-muted"> · {day(e.start_date)}</span> : null}</span>
                <button onClick={() => go(`ev-${e.id}`, { action: 'event_checkout', event_id: e.id })} disabled={!!busy} className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 disabled:opacity-50">{busy === `ev-${e.id}` ? '…' : 'Buy for $199'}</button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {leads.length === 0 && st.orgs.length === 0 && <p className="mt-4 text-sm text-muted">Plans are for organizations. <Link to="/business" className="font-medium text-marigold">Create an organization ›</Link></p>}
    </section>
  );
}

// Organization settings > Sales & payouts (Preview): the organization's plan at a glance.
export function OrgPlanStatus({ orgId }: { orgId: string }) {
  const [o, setO] = useState<OrgPlan | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { supabase.rpc('my_plan_status').then(({ data }) => setO(((data as { orgs?: OrgPlan[] } | null)?.orgs ?? []).find((x) => x.id === orgId) ?? null)); }, [orgId]);
  if (!o) return null;
  return (
    <div className={`mb-6 rounded-2xl border p-4 ${isActive(o) ? 'border-green-200 bg-green-50' : 'border-[#C9A227]/50 bg-[#C9A227]/10'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-bone">{isActive(o) ? '✓ Business plan' : '⭐ Free during early access'} <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700">Preview</span></p>
          <p className="text-sm text-muted">{isActive(o) ? `${o.interval === 'year' ? 'Yearly' : 'Monthly'} · ${o.cancel_at_period_end ? `ends ${day(o.renews_at)}` : `renews ${day(o.renews_at)}`}` : `Premium features are free for now.${o.founding_number ? ' Founding pricing: 40% off for life.' : ''}`}</p>
        </div>
        {isActive(o)
          ? <button onClick={async () => { setBusy(true); try { const r = await call({ action: 'portal', org_id: orgId }); if (r.url) window.location.href = r.url; } catch { setBusy(false); } }} disabled={busy} className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50">{busy ? 'Opening…' : 'Manage billing'}</button>
          : <Link to={`/business/plan?org=${orgId}#get-plan`} className="rounded-xl bg-[#C9A227] px-4 py-2 text-sm font-bold text-[#0F1B3D]">See plans ›</Link>}
      </div>
    </div>
  );
}
