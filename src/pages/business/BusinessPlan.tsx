import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { loadMyOrgs, type MyOrg } from '../../lib/business';

const NAVY = '#0F1B3D';
const GOLD = '#C9A227';
// Planned premium features (also the "what matters most to you?" options on the reservation).
const PREMIUM: { icon: string; name: string; desc: string }[] = [
  { icon: '✨', name: 'Event templates', desc: 'Conference, Gala, Summit and more, ready in minutes' },
  { icon: '🧾', name: 'Invoices', desc: 'Bill companies for group tickets; business receipts' },
  { icon: '📈', name: 'Organization insights', desc: 'Sales across events, attendee list and CSV export' },
  { icon: '📣', name: 'Promotion links', desc: 'Track every link and pay promoters a commission' },
  { icon: '🚀', name: 'Boost credit', desc: 'Monthly credit to feature events in Discover' },
  { icon: '🤝', name: 'Attendee networking', desc: 'Cards, suggestions and QR connect at your events' },
  { icon: '💸', name: 'Revenue splits', desc: 'Split event money by percentage with partners' },
  { icon: '🎬', name: 'Video headers & highlight reel', desc: 'A trailer at the top of event pages and your organization page, plus a past-events reel' },
  { icon: '📝', name: 'Meeting extras', desc: 'Recurring meetings, minutes as PDF, agenda templates' },
  { icon: '⭐', name: 'Featured on Discover', desc: 'Your organization in the Featured row' },
];
const FREE = ['Create events and sell tickets (buyers pay the fees)', 'Organization page with your brand', 'Team roles across all your events', 'Planning hub, tasks, meetings and polls',
  'Photo gallery (24 photos)', 'Promo codes', 'Donations and support', 'Payouts to your own bank', 'Personal TapIN QR and profile sharing', 'Feed videos (and, coming soon, featuring them on your organization page)'];
const PLANS = [
  { id: 'monthly', label: 'Monthly', price: '$59', per: '/month' },
  { id: 'yearly', label: 'Yearly', price: '$590', per: '/year', note: '2 months free' },
  { id: 'per_event', label: 'Per event', price: '$199', per: '/event' },
] as const;

// "Business plan, coming soon" (Preview): what's planned, what stays free, and a founding-price reservation.
export default function BusinessPlan() {
  const { user } = useAuth();
  const [spots, setSpots] = useState<number | null>(null);
  const [orgs, setOrgs] = useState<MyOrg[]>([]);
  const [reserved, setReserved] = useState<{ org_name: string | null; plan: string }[]>([]);
  const [orgId, setOrgId] = useState('');
  const [orgName, setOrgName] = useState('');
  const [plan, setPlan] = useState<'monthly' | 'yearly' | 'per_event' | 'unsure'>('yearly');
  const [wanted, setWanted] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    supabase.rpc('founding_spots_left').then(({ data }) => setSpots(typeof data === 'number' ? data : null));
    if (!user) return;
    loadMyOrgs().then((list) => { const mine = list.filter((o) => o.status !== 'deleted' && (o.role === 'owner' || o.role === 'admin')); setOrgs(mine); if (mine[0]) setOrgId(mine[0].id); });
    supabase.rpc('my_plan_reservations').then(({ data }) => setReserved((data ?? []) as { org_name: string | null; plan: string }[]));
  }, [user]);

  async function reserve() {
    if (!orgId && !orgName.trim()) return setMsg({ ok: false, text: 'Add your organization\u2019s name.' });
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc('reserve_business_plan', { p_org_id: orgId || null, p_org_name: orgName, p_plan: plan, p_features: wanted, p_note: note });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message && !/function|permission/i.test(error.message) ? error.message : "Couldn't save your reservation." });
    setMsg({ ok: true, text: '🎉 You\u2019re on the list! We\u2019ll email you before the Business plan launches. Nothing is charged now.' });
    supabase.rpc('my_plan_reservations').then(({ data }) => setReserved((data ?? []) as { org_name: string | null; plan: string }[]));
  }

  return (
    <div className="-mx-4 -mt-4 sm:-mx-6">
      <section className="px-6 py-10 text-white sm:px-10" style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #1E3A8A 100%)` }}>
        <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: GOLD }}>TapIN for Business · Coming soon</p>
        <h1 className="mt-3 max-w-2xl font-display text-3xl font-extrabold leading-tight sm:text-5xl">The Business plan</h1>
        <p className="mt-3 max-w-xl text-white/85">Premium tools for organizations that run events seriously. The core of TapIN stays free forever.</p>
        <p className="mt-2 max-w-xl text-sm text-white/70">Plans are for organizations. Organizing on your own? The per-event option unlocks premium tools for a single event.</p>
        <div className="mt-5 grid max-w-2xl grid-cols-3 gap-2">
          {PLANS.map((p) => (
            <div key={p.id} className="rounded-2xl bg-white/10 p-3 text-center">
              <p className="text-xs text-white/70">{p.label}</p>
              <p className="mt-0.5 text-2xl font-extrabold">{p.price}<span className="text-xs font-normal text-white/70">{p.per}</span></p>
              {'note' in p && p.note && <p className="text-[11px]" style={{ color: GOLD }}>{p.note}</p>}
            </div>
          ))}
        </div>
        <div className="mt-4 max-w-2xl rounded-2xl border border-white/15 bg-white/5 p-4 text-sm">
          🎉 <strong style={{ color: GOLD }}>Founding pricing: 40% off for life</strong> for founding businesses and nonprofits{spots !== null ? <> · <strong>{spots} of 20 spots left</strong></> : null}. Reserve below and we'll hold founding pricing for your organization while spots last.
        </div>
      </section>

      <div className="px-6 py-8 sm:px-10">
        <div className="mb-6 rounded-2xl border border-[#C9A227]/50 bg-[#C9A227]/10 p-4 text-sm text-[#5A460A]">
          <p className="font-semibold">⭐ Free during early access, paid after launch</p>
          <p className="mt-1">Features marked <strong>Business plan</strong> in the app are free to use right now. When the Business plan launches, they'll require a paid plan, so you'll need a plan to keep using them. Founding members keep 40% off for life.</p>
        </div>
        <h2 className="font-display text-2xl font-bold text-bone">What's planned for the Business plan</h2>
        <p className="mt-1 text-sm text-muted">Planned features; the final list may change based on what organizations tell us matters most.</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {PREMIUM.map((f) => (
            <li key={f.name} className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-surface p-4">
              <span className="text-2xl" aria-hidden="true">{f.icon}</span>
              <span><span className="block font-semibold text-bone">{f.name}</span><span className="block text-sm text-muted">{f.desc}</span></span>
            </li>
          ))}
        </ul>
        <section className="mt-8 overflow-hidden rounded-2xl text-white" style={{ background: `linear-gradient(135deg, #111827 0%, ${NAVY} 100%)` }}>
          <div className="grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: GOLD }}>Add-on</p>
              <h3 className="mt-1 font-display text-2xl font-extrabold">White-label events</h3>
              <p className="mt-2 max-w-lg text-sm text-white/80">Run an event that looks entirely like your own brand: your logo, colors and name across the event page, tickets and emails, without TapIN branding. Ideal for conferences, galas and corporate events.</p>
              <ul className="mt-3 grid gap-1.5 text-sm text-white/90 sm:grid-cols-2">
                <li>✓ Your branding on the event page</li><li>✓ Branded tickets and emails</li><li>✓ No TapIN branding for attendees</li><li>✓ Works with any Business plan</li>
              </ul>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 text-center sm:min-w-[170px]">
              <p className="text-4xl font-extrabold">$299</p>
              <p className="text-sm text-white/70">per event</p>
              <a href="#reserve" onClick={() => setWanted((w) => (w.includes('White-label events') ? w : [...w, 'White-label events']))} className="mt-3 inline-block rounded-full px-4 py-2 text-sm font-bold text-[#0F1B3D]" style={{ background: GOLD }}>I'm interested</a>
            </div>
          </div>
        </section>

        <h2 className="mt-10 font-display text-2xl font-bold text-bone">Free forever</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {FREE.map((f) => <li key={f} className="flex items-start gap-2 text-sm text-bone"><span className="text-green-600">✓</span>{f}</li>)}
        </ul>

        <section id="reserve" className="mt-10 max-w-xl scroll-mt-24 rounded-2xl border-2 p-5" style={{ borderColor: GOLD }}>
          <h2 className="font-display text-2xl font-bold text-bone">Reserve founding pricing</h2>
          <p className="mt-1 text-sm text-muted">Takes a minute. Nothing is charged now; we'll email you before launch.</p>
          {reserved.length > 0 && <p className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">✓ Reserved for {reserved.map((r) => r.org_name || 'your organization').join(', ')}. You can update it below.</p>}
          {!user ? (
            <Link to="/login" state={{ from: '/business/plan#reserve' }} className="mt-4 inline-block rounded-full px-6 py-3 text-sm font-bold text-[#0F1B3D]" style={{ background: GOLD }}>Sign in to reserve</Link>
          ) : (
            <>
              <label className="mt-4 block text-xs font-medium text-gray-500">Organization
                {orgs.length > 0 ? (
                  <select value={orgId} onChange={(e) => setOrgId(e.target.value)} className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900">
                    {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}{o.founding_number ? ` (Founding #${o.founding_number})` : ''}</option>)}
                    <option value="">Another organization (not on TapIN yet)</option>
                  </select>
                ) : null}
                {(!orgs.length || !orgId) && <input value={orgName} maxLength={120} onChange={(e) => setOrgName(e.target.value)} placeholder="Organization name" className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900" />}
              </label>
              <p className="mt-4 text-xs font-medium text-gray-500">Which plan would you choose?</p>
              <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[...PLANS.map((p) => ({ id: p.id, label: `${p.label} ${p.price}` })), { id: 'unsure' as const, label: 'Not sure yet' }].map((p) => (
                  <button key={p.id} type="button" onClick={() => setPlan(p.id)} aria-pressed={plan === p.id}
                    className={`min-h-[44px] rounded-xl px-2 text-sm font-semibold ${plan === p.id ? 'bg-[#0F1B3D] text-white' : 'border border-gray-300 bg-white text-gray-800'}`}>{p.label}</button>
                ))}
              </div>
              <p className="mt-4 text-xs font-medium text-gray-500">What matters most to you? (pick any)</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {[...PREMIUM, { icon: '🏷️', name: 'White-label events', desc: '' }].map((f) => (
                  <button key={f.name} type="button" aria-pressed={wanted.includes(f.name)} onClick={() => setWanted(wanted.includes(f.name) ? wanted.filter((x) => x !== f.name) : [...wanted, f.name])}
                    className={`min-h-[36px] rounded-full px-3 text-sm ${wanted.includes(f.name) ? 'bg-marigold font-semibold text-white' : 'border border-gray-300 bg-white text-gray-700'}`}>{f.icon} {f.name}</button>
                ))}
              </div>
              <label className="mt-4 block text-xs font-medium text-gray-500">Anything we should know? (optional)
                <textarea rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What would make the Business plan a no-brainer for you?" className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900" />
              </label>
              {msg && <p role="status" className={`mt-3 rounded-xl px-3 py-2 text-sm ${msg.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{msg.text}</p>}
              <button onClick={reserve} disabled={busy} className="mt-4 w-full rounded-full py-3 text-sm font-bold text-[#0F1B3D] disabled:opacity-50" style={{ background: GOLD }}>{busy ? 'Saving…' : reserved.length ? 'Update my reservation' : 'Reserve founding pricing'}</button>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
