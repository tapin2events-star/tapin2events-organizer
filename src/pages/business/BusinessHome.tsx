import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import BusinessGate from '../../components/business/BusinessGate';
import { loadMyOrgs, slugify, type MyOrg, type OrgKind } from '../../lib/business';

const NAVY = '#0F1B3D';
const GOLD = '#C9A227';

// TapIN for Business: the landing page for companies and nonprofits, plus "your organizations".
export default function BusinessHome() {
  return <BusinessGate><BusinessHomeInner /></BusinessGate>;
}

function BusinessHomeInner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState<MyOrg[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [kind, setKind] = useState<OrgKind>('business');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (user) loadMyOrgs().then(setOrgs); else setOrgs([]); }, [user]);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || slug.length < 2) return;
    setBusy(true); setError(null);
    const { error: err } = await supabase.rpc('create_organization', { p_name: name.trim(), p_slug: slug, p_kind: kind });
    setBusy(false);
    if (err) return setError(/taken|limit|sign in/i.test(err.message) ? err.message : "Couldn't create the organization. Please try again.");
    navigate(`/business/${slug}/manage`);
  }

  const field = 'mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-base text-gray-900';
  return (
    <div className="-mx-4 -mt-4 sm:-mx-6">
      {/* Hero */}
      <section className="px-6 py-14 text-white sm:px-10" style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #1E3A8A 100%)` }}>
        <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: GOLD }}>TapIN for Business</p>
        <h1 className="mt-3 max-w-2xl font-display text-4xl font-extrabold leading-tight sm:text-5xl">Professional events, without the enterprise price.</h1>
        <p className="mt-4 max-w-xl text-base text-white/80">Conferences, summits, galas, workshops and fundraisers with agendas, speakers, sponsors and branded pages, on the same TapIN your community already uses.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button onClick={() => setCreating(true)} className="rounded-full px-6 py-3 text-sm font-bold text-[#0F1B3D]" style={{ background: GOLD }}>Create your organization</button>
          <a href="#features" className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white">See what's included</a>
        </div>
      </section>

      <div className="px-6 py-8 sm:px-10">
        {/* Your organizations */}
        {orgs && orgs.length > 0 && (
          <section className="mb-10">
            <h2 className="font-display text-xl font-bold text-bone">Your organizations</h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {orgs.map((o) => (
                <li key={o.id}>
                  <Link to={`/business/${o.slug}/manage`} className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-surface p-4 hover:border-[#C9A227]">
                    {o.logo_url ? <img src={o.logo_url} alt="" className="h-12 w-12 rounded-xl object-cover" /> : <span className="flex h-12 w-12 items-center justify-center rounded-xl font-bold text-white" style={{ background: o.brand.primary }}>{o.name.charAt(0)}</span>}
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-bone">{o.name}{o.verified && <span className="ml-1 text-[#C9A227]" title="Verified">✓</span>}</span>
                      <span className="block text-xs text-muted">{o.kind === 'nonprofit' ? 'Nonprofit' : 'Business'} · {o.role}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {creating && (
          <form onSubmit={create} className="mb-10 max-w-lg rounded-2xl border border-gray-200 bg-surface p-5">
            <h2 className="font-display text-lg font-bold text-bone">Create your organization</h2>
            {!user ? <p className="mt-2 text-sm text-muted"><Link to="/login" className="text-marigold">Sign in</Link> first.</p> : (
              <>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {(['business', 'nonprofit'] as OrgKind[]).map((k) => (
                    <button type="button" key={k} onClick={() => setKind(k)} className={`rounded-xl border p-3 text-left text-sm ${kind === k ? 'border-[#C9A227] bg-[#C9A227]/10' : 'border-gray-200 bg-white'}`}>
                      <span className="block font-semibold text-gray-900">{k === 'business' ? 'Business' : 'Nonprofit'}</span>
                      <span className="block text-xs text-gray-500">{k === 'business' ? 'Companies, associations, schools' : 'Charities and 501(c)(3)s'}</span>
                    </button>
                  ))}
                </div>
                <label className="mt-3 block text-xs font-medium text-gray-500">Organization name
                  <input className={field} value={name} maxLength={120} onChange={(e) => { setName(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)); }} placeholder="Acme Corporation" autoFocus />
                </label>
                <label className="mt-3 block text-xs font-medium text-gray-500">Page address
                  <div className="mt-1 flex items-center rounded-xl border border-gray-300 bg-white pl-3 text-sm text-gray-500">
                    <span className="shrink-0">tapin2events.com/o/</span>
                    <input className="min-w-0 flex-1 rounded-r-xl px-1 py-3 text-base text-gray-900 outline-none" value={slug} onChange={(e) => { setSlugTouched(true); setSlug(slugify(e.target.value)); }} />
                  </div>
                </label>
                {error && <p role="alert" className="mt-2 text-sm text-magenta">{error}</p>}
                <div className="mt-4 flex gap-2">
                  <button type="submit" disabled={busy || !name.trim() || slug.length < 2} className="rounded-xl px-5 py-3 text-sm font-bold text-white disabled:opacity-50" style={{ background: NAVY }}>{busy ? 'Creating…' : 'Create organization'}</button>
                  <button type="button" onClick={() => setCreating(false)} className="rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-700">Cancel</button>
                </div>
              </>
            )}
          </form>
        )}

        {/* Features */}
        <section id="features" className="scroll-mt-20">
          <h2 className="font-display text-2xl font-bold text-bone">Everything a professional event needs</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Agenda & sessions', 'Keynotes, panels and workshops with times, rooms and tracks.'],
              ['Speakers', 'Photos, bios and titles, linked to their sessions.'],
              ['Sponsors', 'Tiered sponsor wall: Presenting, Platinum, Gold and more.'],
              ['Your brand', 'Your logo, colors and fonts on every event page.'],
              ['Your team', 'Invite colleagues to manage events with you.'],
              ['Tickets & check-in', 'Ticket sales, QR check-in and transfers, built in.'],
            ].map(([t, d]) => (
              <div key={t} className="rounded-2xl border border-gray-200 bg-surface p-4">
                <p className="font-semibold text-bone">{t}</p>
                <p className="mt-1 text-sm text-muted">{d}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted">Coming next: ticket tiers and promo codes, registration questions, donations and fundraising goals, networking, invoices, and white-label pages.</p>
        </section>
      </div>
    </div>
  );
}
