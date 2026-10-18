import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { PACKS, PLAN_PRICES, AGENCY_EXTRA, ARTIST_PLAN, planTotal, money, type PackId, type PlanId } from '../../lib/plans';

interface OrgPlan { id: string; name: string; slug: string; role: string; kind: string; founding_number: number | null; plan: string; packs: PackId[]; interval: string | null; status: string | null; renews_at: string | null; cancel_at_period_end: boolean; extra_clients: number; agency: { id: string; name: string } | null; full_access: boolean }
interface Status { enforcement: string; founding_left: number; orgs: OrgPlan[]; events: { id: string; title: string; start_date: string | null; has_plan: boolean }[] }

async function call(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('business-plan', { body: { ...body, returnBase: `${window.location.origin}${import.meta.env.BASE_URL}` } });
  if (error || data?.error) throw new Error(data?.error ?? "Couldn't reach Stripe. Please try again.");
  return data as { url?: string; status?: string };
}
const isLive = (o: { plan: string; status: string | null }) => o.plan !== 'free' && ['active', 'trialing', 'past_due'].includes(String(o.status));
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
export const PLAN_LABEL: Record<string, string> = { essentials: 'Essentials', business: 'Business', agency: 'Agency', free: 'Free' };
const PLAN_ICON: Record<string, string> = { essentials: '🌱', business: '⭐', agency: '🏢' };

// Plan page > "Choose your plan": an organization plan (and packs / extra clients) or the Artist plan (for you
// personally, with packs), with the live price, checkout or change.
type UIPlan = PlanId | 'artist';
interface MyArtist { status: string | null; interval: string | null; renews_at: string | null; cancel_at_period_end: boolean; live: boolean; packs: PackId[]; has_profile: boolean }
const ARTIST_PACK_IDS: PackId[] = ['performers', 'conference', 'fundraising', 'community'];
export default function PlanCheckout({ preferArtist = false }: { preferArtist?: boolean }) {
  const [st, setSt] = useState<Status | null>(null);
  const [artist, setArtist] = useState<MyArtist | null>(null);
  const [orgId, setOrgId] = useState('');
  const [plan, setPlan] = useState<UIPlan>('business');
  const [interval, setInterval] = useState<'month' | 'year'>('month');
  const [packs, setPacks] = useState<PackId[]>([]);
  const [extra, setExtra] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = async () => {
    const [{ data: a }, { data: b }] = await Promise.all([supabase.rpc('my_plan_status'), supabase.rpc('my_artist_plan')]);
    setSt((a ?? null) as Status | null); setArtist((b ?? null) as MyArtist | null);
    return { status: (a ?? null) as Status | null, artist: (b ?? null) as MyArtist | null };
  };
  useEffect(() => {
    (async () => {
      const q = new URLSearchParams(window.location.search);
      const org = q.get('org'); const ev = q.get('event');
      if (org) setOrgId(org);
      if (q.get('done') && org) { try { await call({ action: 'sync', org_id: org }); setMsg({ ok: true, text: '🎉 Your plan is active. Thank you!' }); } catch { /* the hourly sync catches up */ } }
      if (q.get('done') && ev) { try { await call({ action: 'sync_event', event_id: ev }); setMsg({ ok: true, text: '🎉 Every premium feature is unlocked for your event. Thank you!' }); } catch { /* hourly sync */ } }
      if (q.get('artist') === 'done') { try { await call({ action: 'artist_sync' }); setMsg({ ok: true, text: '🎉 Your Artist plan is active. Thank you!' }); } catch { /* hourly sync */ } }
      const r = await load();
      const leadsNow = (r.status?.orgs ?? []).filter((o) => o.role === 'owner' || o.role === 'admin');
      if (r.artist?.live || (!org && (preferArtist || leadsNow.length === 0))) setPlan('artist');
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const leads = useMemo(() => (st?.orgs ?? []).filter((o) => o.role === 'owner' || o.role === 'admin'), [st]);
  const org = leads.find((o) => o.id === orgId) ?? leads[0] ?? null;
  const isArtist = plan === 'artist';
  // Start from what they have now.
  useEffect(() => {
    if (isArtist) {
      if (artist?.live) { setPacks((artist.packs ?? []).filter((p) => ARTIST_PACK_IDS.includes(p))); setInterval(artist.interval === 'year' ? 'year' : 'month'); }
      else setPacks((x) => x.filter((p) => ARTIST_PACK_IDS.includes(p)));
      return;
    }
    if (!org) return;
    if (isLive(org)) { setPlan(org.plan as PlanId); setPacks(org.packs ?? []); setExtra(org.extra_clients ?? 0); setInterval(org.interval === 'year' ? 'year' : 'month'); }
  }, [org?.id, isArtist]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!st) return null;
  const founding = !isArtist && !!org?.founding_number;
  const price = planTotal(plan, interval, packs, extra, founding);
  const orgLive = org ? isLive(org) : false;
  const live = isArtist ? !!artist?.live : orgLive;
  const same = isArtist
    ? !!artist?.live && (artist.interval === 'year' ? 'year' : 'month') === interval && [...(artist.packs ?? [])].sort().join() === [...packs].sort().join()
    : !!org && orgLive && org.plan === plan && (org.interval === 'year' ? 'year' : 'month') === interval
      && [...(org.packs ?? [])].sort().join() === [...(plan === 'essentials' ? packs : [])].sort().join() && (org.extra_clients ?? 0) === (plan === 'agency' ? extra : 0);
  const per = interval === 'year' ? '/year' : '/month';
  async function go(key: string, body: Record<string, unknown>) {
    setBusy(key); setMsg(null);
    try {
      const r = await call(body);
      if (r.url) { window.location.href = r.url; return; }
      setMsg({ ok: true, text: 'Your plan was updated.' }); await load();
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    setBusy(null);
  }
  const togglePack = (p: PackId) => setPacks((x) => (x.includes(p) ? x.filter((y) => y !== p) : [...x, p]));
  const packChoices = isArtist ? PACKS.filter((p) => ARTIST_PACK_IDS.includes(p.id)) : PACKS;
  const cards: { id: UIPlan; label: string; price: number; desc: string }[] = [
    { id: 'essentials', label: '🌱 Essentials', price: PLAN_PRICES.essentials[interval], desc: 'Core tools, add packs as you need them' },
    { id: 'business', label: '⭐ Business', price: PLAN_PRICES.business[interval], desc: 'Everything, for one organization' },
    { id: 'agency', label: '🏢 Agency', price: PLAN_PRICES.agency[interval], desc: 'Everything, for up to 5 client organizations' },
    { id: 'artist', label: '🎤 Artist', price: ARTIST_PLAN[interval], desc: 'For you as an artist or performer, no organization needed' },
  ];
  return (
    <section id="get-plan" className="mt-10 scroll-mt-24 rounded-2xl border-2 border-[#0F1B3D] p-5">
      <h2 className="font-display text-2xl font-bold text-bone">Choose your plan</h2>
      {st.enforcement !== 'on' && <p className="mt-1 text-sm text-muted">Premium features are free during early access, so there's no need to buy yet. You can still choose a plan now to support TapIN or lock in founding pricing.</p>}
      {msg && <p role="status" className={`mt-3 rounded-xl px-3 py-2 text-sm ${msg.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{msg.text}</p>}

      {!isArtist && leads.length > 1 && (
        <label className="mt-4 block text-xs font-medium text-gray-500">Organization
          <select value={org?.id ?? ''} onChange={(e) => setOrgId(e.target.value)} className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 sm:text-sm">
            {leads.map((o) => <option key={o.id} value={o.id}>{o.name}{isLive(o) ? ` · ${PLAN_LABEL[o.plan]}` : ''}</option>)}
          </select>
        </label>
      )}
      {isArtist ? (
        <div className="mt-3 rounded-xl bg-purple-50 px-3 py-2 text-sm text-purple-900">
          <strong>Billed to you personally.</strong> {artist?.live ? `🎤 Artist plan${artist.packs?.length ? ` + ${artist.packs.length} pack${artist.packs.length === 1 ? '' : 's'}` : ''} · ${artist.interval === 'year' ? 'yearly' : 'monthly'} · ${artist.cancel_at_period_end ? `ends ${day(artist.renews_at)}` : `renews ${day(artist.renews_at)}`}` : 'Video header on your artist profile, Featured Artist placement and Boost credit. Add packs for shows you host.'}
          {artist && !artist.has_profile && <Link to="/resources/new" className="ml-1 font-semibold underline">Create your artist profile</Link>}
        </div>
      ) : org ? (
        <div className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-700">
          <strong>{org.name}</strong>: {orgLive ? `${PLAN_ICON[org.plan] ?? ''} ${PLAN_LABEL[org.plan]}${org.packs?.length ? ` + ${org.packs.length} pack${org.packs.length === 1 ? '' : 's'}` : ''} · ${org.interval === 'year' ? 'yearly' : 'monthly'} · ${org.cancel_at_period_end ? `ends ${day(org.renews_at)}` : `renews ${day(org.renews_at)}`}` : org.agency ? `covered by ${org.agency.name}'s Agency plan` : 'Free'}
          {founding && <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">Founding #{org.founding_number}</span>}
        </div>
      ) : (
        <p className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-700">Organization plans need an organization. <Link to="/business" className="font-medium text-marigold">Create your organization</Link>, or choose the Artist plan.</p>
      )}

      <div className="mt-4 flex gap-1 rounded-xl bg-gray-100 p-1 text-sm font-medium" role="radiogroup" aria-label="Billing">
        {(['month', 'year'] as const).map((i) => <button key={i} role="radio" aria-checked={interval === i} onClick={() => setInterval(i)} className={`flex-1 rounded-lg py-2 ${interval === i ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>{i === 'month' ? 'Monthly' : 'Yearly · 2 months free'}</button>)}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Plan">
        {cards.map((c) => {
          const needsOrg = c.id !== 'artist' && !org;
          const chosen = plan === c.id;
          return (
            <button key={c.id} role="radio" aria-checked={chosen} disabled={needsOrg} onClick={() => setPlan(c.id)}
              className={`rounded-2xl border-2 p-3 text-left disabled:opacity-50 ${chosen ? (c.id === 'artist' ? 'border-purple-700 bg-white shadow-sm' : 'border-[#0F1B3D] bg-white shadow-sm') : c.id === 'artist' ? 'border-purple-200 bg-purple-50/50' : 'border-gray-200 bg-white'}`}>
              <span className="block text-sm font-bold text-gray-900">{c.label}</span>
              <span className="block text-lg font-extrabold text-gray-900">{money(c.price)}<span className="text-xs font-normal text-gray-500">{per}</span></span>
              <span className="block text-xs text-gray-500">{needsOrg ? 'Needs an organization' : c.desc}</span>
            </button>
          );
        })}
      </div>

      {(plan === 'essentials' || isArtist) && (
        <div className="mt-4">
          <p className="text-sm font-semibold text-gray-900">Add packs{isArtist ? ' (for events you host)' : ''}</p>
          {isArtist && <p className="text-xs text-gray-500">Hosting your own shows? Performers & Promotion adds automatic promoter payouts and event video headers.</p>}
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {packChoices.map((p) => (
              <li key={p.id}><label className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 ${packs.includes(p.id) ? 'border-marigold bg-white' : 'border-gray-200 bg-white'}`}>
                <input type="checkbox" checked={packs.includes(p.id)} onChange={() => togglePack(p.id)} className="mt-1 h-4 w-4 accent-marigold" />
                <span className="min-w-0"><span className="block text-sm font-semibold text-gray-900">{p.icon} {p.name} · +{money(p.price[interval])}{per}</span><span className="block text-xs text-gray-500">{p.features.map((f) => f.name).join(', ')}</span></span>
              </label></li>
            ))}
          </ul>
          {plan === 'essentials' && price.full >= PLAN_PRICES.business[interval] && <p className="mt-2 rounded-xl bg-indigo-50 px-3 py-2 text-xs text-indigo-800">💡 Business ({money(PLAN_PRICES.business[interval])}{per}) includes every pack{founding ? `, and your founding discount makes it ${money(PLAN_PRICES.business[interval] * 0.6)}${per}` : ''}. <button onClick={() => setPlan('business')} className="font-semibold underline">Switch to Business</button></p>}
        </div>
      )}

      {plan === 'agency' && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-gray-50 p-3 text-sm">
          <span>Client organizations: <strong>5 included</strong></span>
          <span className="flex items-center gap-2">+ extra clients
            <button onClick={() => setExtra(Math.max(0, extra - 1))} aria-label="Fewer extra clients" className="h-8 w-8 rounded-lg border border-gray-300 bg-white">−</button>
            <span className="w-6 text-center font-semibold">{extra}</span>
            <button onClick={() => setExtra(Math.min(50, extra + 1))} aria-label="More extra clients" className="h-8 w-8 rounded-lg border border-gray-300 bg-white">+</button>
            <span className="text-xs text-gray-500">{money(AGENCY_EXTRA[interval])}{per} each</span>
          </span>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-gray-200 pt-4">
        <div>
          <p className="text-xs text-gray-500">Total</p>
          <p className="text-2xl font-extrabold text-gray-900">{price.due !== price.full && <span className="mr-2 text-base font-normal text-gray-400 line-through">{money(price.full)}</span>}{money(price.due)}<span className="text-sm font-normal text-gray-500">{per}</span></p>
          {founding && plan === 'essentials' && <p className="text-xs text-amber-800">Founding member: Essentials price locked for life.</p>}
          {founding && (plan === 'business' || plan === 'agency') && <p className="text-xs text-amber-800">Founding member: 40% off for life.</p>}
        </div>
        {isArtist ? (
          live
            ? <div className="flex flex-wrap gap-2">
                <button onClick={() => go('portal', { action: 'artist_portal' })} disabled={!!busy} className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 disabled:opacity-50">{busy === 'portal' ? 'Opening…' : 'Billing & invoices'}</button>
                <button onClick={() => go('change', { action: 'artist_change', interval, packs })} disabled={!!busy || same} className="rounded-xl bg-purple-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy === 'change' ? 'Updating…' : same ? 'Current plan' : 'Change plan'}</button>
              </div>
            : <button onClick={() => go('checkout', { action: 'artist_checkout', interval, packs })} disabled={!!busy} className="rounded-xl bg-purple-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy === 'checkout' ? 'Opening checkout…' : 'Get the Artist plan'}</button>
        ) : org && (orgLive
          ? <div className="flex flex-wrap gap-2">
              <button onClick={() => go('portal', { action: 'portal', org_id: org.id })} disabled={!!busy} className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 disabled:opacity-50">{busy === 'portal' ? 'Opening…' : 'Billing & invoices'}</button>
              <button onClick={() => go('change', { action: 'change', org_id: org.id, plan, interval, packs, extra_clients: extra })} disabled={!!busy || same} className="rounded-xl bg-[#0F1B3D] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy === 'change' ? 'Updating…' : same ? 'Current plan' : 'Change plan'}</button>
            </div>
          : <button onClick={() => go('checkout', { action: 'checkout', org_id: org.id, plan, interval, packs, extra_clients: extra })} disabled={!!busy || !!org.agency} className="rounded-xl bg-[#0F1B3D] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy === 'checkout' ? 'Opening checkout…' : org.agency ? 'Covered by your agency' : `Get ${PLAN_LABEL[plan]}`}</button>)}
      </div>
      {live && <p className="mt-2 text-xs text-gray-500">Plan changes take effect right away; Stripe adjusts your bill for the rest of the period.</p>}
      {!isArtist && org && orgLive && org.plan === 'agency' && <AgencyClients agencyId={org.id} />}

      {st.events.filter((e) => !e.has_plan).length > 0 && (
        <div className="mt-6 border-t border-gray-200 pt-4">
          <p className="text-sm font-semibold text-gray-900">Or unlock one event · $199 once</p>
          <p className="text-xs text-gray-500">Every premium feature for a single event, no subscription.</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {st.events.filter((e) => !e.has_plan).slice(0, 6).map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
                <span className="min-w-0 truncate">{e.title}</span>
                <button onClick={() => go(`ev-${e.id}`, { action: 'event_checkout', event_id: e.id })} disabled={!!busy} className="shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-800 disabled:opacity-50">{busy === `ev-${e.id}` ? 'Opening…' : 'Unlock · $199'}</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// Agency plan: the client organizations it covers.
function AgencyClients({ agencyId }: { agencyId: string }) {
  const [d, setD] = useState<{ limit: number; live: boolean; clients: { id: string; name: string; slug: string; logo: string | null }[]; available: { id: string; name: string }[] } | null>(null);
  const [pick, setPick] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const load = () => supabase.rpc('agency_clients', { p_agency_id: agencyId }).then(({ data }) => setD((data ?? null) as typeof d));
  useEffect(() => { load(); }, [agencyId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return null;
  async function set(clientId: string, add: boolean) {
    setErr(null);
    const { error } = await supabase.rpc('set_agency_client', { p_agency_id: agencyId, p_client_id: clientId, p_add: add });
    if (error) setErr(error.message && !/function|permission/i.test(error.message) ? error.message : "Couldn't update clients.");
    setPick(''); load();
  }
  return (
    <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-4">
      <p className="font-semibold text-gray-900">🏢 Client organizations · {d.clients.length} of {d.limit}</p>
      <p className="text-xs text-gray-500">Each client organization gets every premium feature through your Agency plan. Create a client's organization from TapIN for Business, then add it here.</p>
      {err && <p role="alert" className="mt-2 text-sm text-red-600">{err}</p>}
      <ul className="mt-2 flex flex-col gap-1.5">
        {d.clients.map((c) => (
          <li key={c.id} className="flex items-center gap-3 rounded-xl border border-gray-200 px-3 py-2 text-sm">
            {c.logo ? <img src={c.logo} alt="" className="h-8 w-8 rounded-lg object-contain" /> : <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">🏢</span>}
            <Link to={`/business/${c.slug}/manage`} className="min-w-0 flex-1 truncate font-medium text-gray-900">{c.name}</Link>
            <button onClick={() => set(c.id, false)} className="text-xs text-gray-400 hover:text-red-600">Remove</button>
          </li>
        ))}
      </ul>
      {d.clients.length < d.limit && d.available.length > 0 && (
        <div className="mt-2 flex gap-2">
          <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Organization to add" className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 sm:text-sm">
            <option value="">Add an organization you manage…</option>
            {d.available.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <button onClick={() => pick && set(pick, true)} disabled={!pick} className="rounded-xl bg-[#0F1B3D] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Add</button>
        </div>
      )}
    </div>
  );
}

// Organization settings > Sales & payouts: the organization's plan at a glance.
export function OrgPlanStatus({ orgId }: { orgId: string }) {
  const [o, setO] = useState<OrgPlan | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { supabase.rpc('my_plan_status').then(({ data }) => setO(((data as { orgs?: OrgPlan[] } | null)?.orgs ?? []).find((x) => x.id === orgId) ?? null)); }, [orgId]);
  if (!o) return null;
  const live = isLive(o);
  const packNames = (o.packs ?? []).map((p) => PACKS.find((x) => x.id === p)?.name).filter(Boolean).join(', ');
  return (
    <div className={`mb-6 rounded-2xl border p-4 ${live || o.agency ? 'border-green-200 bg-green-50' : 'border-[#C9A227]/50 bg-[#C9A227]/10'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-bone">{live ? `✓ ${PLAN_ICON[o.plan] ?? ''} ${PLAN_LABEL[o.plan]} plan` : o.agency ? `✓ Covered by ${o.agency.name}` : '⭐ Free during early access'}</p>
          <p className="text-sm text-muted">{live ? `${packNames ? `Packs: ${packNames} · ` : ''}${o.interval === 'year' ? 'Yearly' : 'Monthly'} · ${o.cancel_at_period_end ? `ends ${day(o.renews_at)}` : `renews ${day(o.renews_at)}`}` : o.agency ? 'Every premium feature, through their Agency plan.' : `Premium features are free for now.${o.founding_number ? ' Founding member: 40% off Business for life.' : ''}`}</p>
        </div>
        {live
          ? <div className="flex gap-2">
              <Link to={`/business/plan?org=${orgId}#get-plan`} className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700">Change plan</Link>
              <button onClick={async () => { setBusy(true); try { const r = await call({ action: 'portal', org_id: orgId }); if (r.url) window.location.href = r.url; } catch { setBusy(false); } }} disabled={busy} className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50">{busy ? 'Opening…' : 'Billing'}</button>
            </div>
          : !o.agency && <Link to={`/business/plan?org=${orgId}#get-plan`} className="rounded-xl bg-[#C9A227] px-4 py-2 text-sm font-bold text-[#0F1B3D]">See plans ›</Link>}
      </div>
    </div>
  );
}
