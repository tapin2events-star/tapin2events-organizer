import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { ARTIST_FEATURES, ARTIST_PLAN, money } from '../../lib/plans';

interface MyArtistPlan { status: string | null; interval: string | null; renews_at: string | null; cancel_at_period_end: boolean; live: boolean; has_profile: boolean }
async function call(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('business-plan', { body: { ...body, returnBase: `${window.location.origin}${import.meta.env.BASE_URL}` } });
  if (error || data?.error) throw new Error(data?.error ?? "Couldn't reach Stripe. Please try again.");
  return data as { url?: string; status?: string };
}
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');

// The Artist plan for individuals: status, checkout and billing. compact = small card for the artist dashboard.
export default function ArtistPlanCard({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const [p, setP] = useState<MyArtistPlan | null>(null);
  const [interval, setInterval] = useState<'month' | 'year'>('month');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    if (!user) return;
    (async () => {
      if (new URLSearchParams(window.location.search).get('artist') === 'done') {
        try { await call({ action: 'artist_sync' }); setMsg({ ok: true, text: '🎉 Your Artist plan is active. Thank you!' }); } catch { /* hourly sync catches up */ }
      }
      const { data } = await supabase.rpc('my_artist_plan');
      setP((data ?? null) as MyArtistPlan | null);
    })();
  }, [user]);
  async function go(body: Record<string, unknown>) {
    setBusy(true); setMsg(null);
    try { const r = await call(body); if (r.url) { window.location.href = r.url; return; } } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    setBusy(false);
  }
  const live = !!p?.live;
  const per = interval === 'year' ? '/year' : '/month';
  if (compact) {
    if (!user || !p) return null;
    return (
      <div className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 ${live ? 'border-green-200 bg-green-50' : 'border-[#C9A227]/50 bg-[#C9A227]/10'}`}>
        <div className="min-w-0">
          <p className="font-semibold text-bone">{live ? '✓ 🎤 Artist plan' : '🎤 Artist plan · $10/month'}</p>
          <p className="text-sm text-muted">{live ? `${p.interval === 'year' ? 'Yearly' : 'Monthly'} · ${p.cancel_at_period_end ? `ends ${day(p.renews_at)}` : `renews ${day(p.renews_at)}`}` : 'Video header on your profile, Featured Artist placement, and promotion tools for shows you host. Free for now.'}</p>
        </div>
        <Link to="/business/plan#artist-plan" className={`rounded-xl px-4 py-2 text-sm font-semibold ${live ? 'border border-gray-300 bg-white text-gray-700' : 'bg-[#C9A227] text-[#0F1B3D]'}`}>{live ? 'Manage' : 'See the Artist plan ›'}</Link>
      </div>
    );
  }
  return (
    <section id="artist-plan" className="mt-10 scroll-mt-24 rounded-2xl border-2 border-purple-300 bg-purple-50/40 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-purple-700">For artists & performers</p>
      <h2 className="mt-1 font-display text-2xl font-bold text-bone">🎤 Artist plan · {money(ARTIST_PLAN.month)}/month</h2>
      <p className="mt-1 text-sm text-muted">For individual artists, no organization needed. Stand out to organizers and fans, and promote the shows you host.</p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {ARTIST_FEATURES.map((f) => (
          <li key={f.key} className="flex items-start gap-3 rounded-xl border border-gray-200 bg-surface p-3">
            <span className="text-xl" aria-hidden="true">{f.icon}</span>
            <span><span className="block text-sm font-semibold text-bone">{f.name}</span><span className="block text-xs text-muted">{f.desc}</span></span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">Revenue splits and getting paid for bookings are always free.</p>
      {msg && <p role="status" className={`mt-3 rounded-xl px-3 py-2 text-sm ${msg.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{msg.text}</p>}
      {!user ? (
        <Link to="/login" className="mt-4 inline-block rounded-xl bg-purple-700 px-5 py-3 text-sm font-semibold text-white">Sign in to get the Artist plan</Link>
      ) : live ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-sm text-green-800">✓ You have the Artist plan · {p?.interval === 'year' ? 'yearly' : 'monthly'} · {p?.cancel_at_period_end ? `ends ${day(p?.renews_at ?? null)}` : `renews ${day(p?.renews_at ?? null)}`}</p>
          <button onClick={() => go({ action: 'artist_portal' })} disabled={busy} className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50">{busy ? 'Opening…' : 'Billing & invoices'}</button>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-xl bg-white p-1 text-sm font-medium" role="radiogroup" aria-label="Artist plan billing">
            {(['month', 'year'] as const).map((i) => <button key={i} role="radio" aria-checked={interval === i} onClick={() => setInterval(i)} className={`rounded-lg px-3 py-1.5 ${interval === i ? 'bg-purple-700 text-white' : 'text-gray-600'}`}>{i === 'month' ? 'Monthly' : 'Yearly · 2 months free'}</button>)}
          </div>
          <button onClick={() => go({ action: 'artist_checkout', interval })} disabled={busy} className="rounded-xl bg-purple-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Opening checkout…' : `Get the Artist plan · ${money(ARTIST_PLAN[interval])}${per}`}</button>
          <a href="#get-plan" className="text-sm font-medium text-purple-700">Add packs ›</a>
          {p && !p.has_profile && <Link to="/resources/new" className="text-sm font-medium text-purple-700">Create your artist profile first ›</Link>}
        </div>
      )}
    </section>
  );
}
