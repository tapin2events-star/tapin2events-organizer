import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import OrgCard from '../../components/business/OrgCard';
import { loadOrgDirectory, type DirOrg } from '../../lib/orgDirectory';

const PAGE = 24;

// Organizations directory: find companies, nonprofits and community groups on TapIN.
export default function OrgDirectory() {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<'' | 'business' | 'nonprofit'>('');
  const [verified, setVerified] = useState(false);
  const [city, setCity] = useState('');
  const [cities, setCities] = useState<string[]>([]);
  const [orgs, setOrgs] = useState<DirOrg[] | null>(null);
  const [more, setMore] = useState(false);

  useEffect(() => { supabase.rpc('organization_cities').then(({ data }) => setCities(((data ?? []) as { city: string }[]).map((c) => c.city))); }, []);
  useEffect(() => {
    const t = setTimeout(() => {
      loadOrgDirectory({ query, kind: kind || null, verified, city: city || null, limit: PAGE }).then((list) => { setOrgs(list); setMore(list.length === PAGE); });
    }, 250);
    return () => clearTimeout(t);
  }, [query, kind, verified, city]);

  async function loadMore() {
    const next = await loadOrgDirectory({ query, kind: kind || null, verified, city: city || null, limit: PAGE, offset: orgs?.length ?? 0 });
    setOrgs([...(orgs ?? []), ...next]); setMore(next.length === PAGE);
  }
  const chip = (on: boolean) => `min-h-[40px] rounded-full px-4 text-sm font-medium ${on ? 'bg-[#0F1B3D] text-white' : 'border border-gray-300 bg-white text-gray-700'}`;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-3xl font-extrabold text-bone">Organizations</h1>
      <p className="mt-1 text-sm text-muted">Companies, nonprofits and community groups hosting events on TapIN. Follow the ones you love to hear about their new events first.</p>

      <div className="mt-5 flex items-center rounded-2xl border border-gray-300 bg-white px-4">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" strokeLinecap="round" /></svg>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search organizations" aria-label="Search organizations" className="min-w-0 flex-1 bg-transparent px-3 py-3 text-base text-gray-900 outline-none" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={() => setKind('')} className={chip(kind === '')}>All</button>
        <button onClick={() => setKind('business')} className={chip(kind === 'business')}>Businesses</button>
        <button onClick={() => setKind('nonprofit')} className={chip(kind === 'nonprofit')}>Nonprofits</button>
        <button onClick={() => setVerified(!verified)} className={chip(verified)} aria-pressed={verified}>✓ Verified</button>
        {cities.length > 0 && (
          <select value={city} onChange={(e) => setCity(e.target.value)} aria-label="City" className="min-h-[40px] rounded-full border border-gray-300 bg-white px-3 text-sm text-gray-700">
            <option value="">Any city</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {orgs === null ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-56 animate-pulse rounded-2xl bg-gray-100" />)}</div>
      ) : orgs.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-gray-300 p-10 text-center">
          <p className="font-semibold text-bone">No organizations found</p>
          <p className="mt-1 text-sm text-muted">Try a different search or filter.</p>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{orgs.map((o) => <OrgCard key={o.id} org={o} />)}</div>
          {more && <div className="mt-6 text-center"><button onClick={loadMore} className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700">Show more</button></div>}
        </>
      )}

      <div className="mt-10 rounded-2xl bg-[#0F1B3D] p-5 text-white">
        <p className="font-semibold">Run events for a company, nonprofit or community group?</p>
        <p className="mt-1 text-sm text-white/75">Create your organization's page, free, with branded event pages, ticket tiers, registration questions and donations.</p>
        <Link to="/business" className="mt-3 inline-block rounded-full bg-[#C9A227] px-4 py-2 text-sm font-bold text-[#0F1B3D]">Get started</Link>
      </div>
    </div>
  );
}
