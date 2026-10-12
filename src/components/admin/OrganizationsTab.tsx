import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

interface Org { id: string; name: string; slug: string; kind: 'business' | 'nonprofit'; ein: string | null; website: string | null; city: string | null; state: string | null; logo_url: string | null; verified: boolean; status: string; created_by: string | null; created_at: string }

// Admin > Organizations: review companies and nonprofits and give them the verified badge.
export default function OrganizationsTab({ notify }: { notify: (kind: 'ok' | 'err', text: string) => void }) {
  const [orgs, setOrgs] = useState<Org[] | null>(null);
  const [eventCounts, setEventCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<'review' | 'verified' | 'all'>('review');
  const [confirm, setConfirm] = useState<Org | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('organizations').select('id, name, slug, kind, ein, website, city, state, logo_url, verified, status, created_by, created_at').order('created_at', { ascending: false });
    const list = (data ?? []) as Org[];
    setOrgs(list);
    if (list.length) {
      const { data: ev } = await supabase.from('events').select('organization_id').in('organization_id', list.map((o) => o.id));
      const m: Record<string, number> = {};
      (ev ?? []).forEach((e) => { const k = e.organization_id as string; m[k] = (m[k] ?? 0) + 1; });
      setEventCounts(m);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function setVerified(o: Org, verified: boolean) {
    const { error } = await supabase.from('organizations').update({ verified }).eq('id', o.id);
    if (error) return notify('err', "Couldn't update that organization.");
    notify('ok', verified ? `${o.name} is now verified.` : `Removed the verified badge from ${o.name}.`);
    setConfirm(null);
    load();
  }
  async function setStatus(o: Org, status: 'active' | 'suspended') {
    const { error } = await supabase.from('organizations').update({ status }).eq('id', o.id);
    if (error) return notify('err', "Couldn't update that organization.");
    notify('ok', status === 'suspended' ? `${o.name} is hidden from the public.` : `${o.name} is visible again.`);
    load();
  }

  const shown = (orgs ?? []).filter((o) => (filter === 'all' ? true : filter === 'verified' ? o.verified : !o.verified));
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold text-bone">Organizations</h2>
        <p className="text-sm text-muted">Give the <strong>verified</strong> badge once you've confirmed an organization is real. For nonprofits, check the EIN with the IRS's free Tax Exempt Organization Search.</p>
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        {([['review', 'Not verified yet'], ['verified', 'Verified'], ['all', 'All']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`rounded-full px-3 py-1.5 font-medium ${filter === k ? 'bg-marigold text-white' : 'border border-gray-300 bg-white text-gray-600'}`}>
            {l}{orgs ? ` (${(orgs ?? []).filter((o) => (k === 'all' ? true : k === 'verified' ? o.verified : !o.verified)).length})` : ''}
          </button>
        ))}
      </div>
      {orgs === null ? <p className="text-sm text-muted">Loading…</p> : shown.length === 0 ? <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-muted">Nothing here.</p> : (
        <ul className="flex flex-col gap-2">
          {shown.map((o) => (
            <li key={o.id} className={`rounded-2xl border border-gray-200 bg-surface p-4 ${o.status === 'suspended' ? 'opacity-60' : ''}`}>
              <div className="flex items-start gap-3">
                {o.logo_url ? <img src={o.logo_url} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" /> : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-200 font-bold text-gray-600">{o.name.charAt(0)}</span>}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-bone">{o.name}{o.verified && <span className="ml-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">✓ Verified</span>}{o.status === 'suspended' && <span className="ml-1.5 rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-bold text-gray-600">Hidden</span>}</p>
                  <p className="text-xs text-muted">{o.kind === 'nonprofit' ? 'Nonprofit' : 'Business'}{o.city ? ` · ${o.city}${o.state ? `, ${o.state}` : ''}` : ''} · created {new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} by {o.created_by ?? 'unknown'} · {eventCounts[o.id] ?? 0} event{(eventCounts[o.id] ?? 0) === 1 ? '' : 's'}</p>
                  <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    {o.kind === 'nonprofit' && (o.ein ? <span className="text-gray-700">EIN <strong>{o.ein}</strong></span> : <span className="text-amber-700">No EIN entered</span>)}
                    {o.kind === 'nonprofit' && <a href="https://apps.irs.gov/app/eos/" target="_blank" rel="noopener noreferrer" className="font-medium text-marigold">IRS search ↗</a>}
                    {o.website && <a href={o.website} target="_blank" rel="noopener noreferrer" className="font-medium text-marigold">Website ↗</a>}
                    <Link to={`/o/${o.slug}`} className="font-medium text-marigold">Public page</Link>
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {o.verified
                  ? <button onClick={() => setVerified(o, false)} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700">Remove badge</button>
                  : <button onClick={() => setConfirm(o)} className="rounded-xl bg-[#0F1B3D] px-4 py-2 text-sm font-bold text-white">Verify</button>}
                {o.status === 'suspended'
                  ? <button onClick={() => setStatus(o, 'active')} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700">Show again</button>
                  : <button onClick={() => setStatus(o, 'suspended')} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-500 hover:text-red-600">Hide from public</button>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {confirm && (
        <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setConfirm(null)}>
          <div className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:rounded-3xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Verify organization">
            <p className="font-display text-lg font-bold text-gray-900">Verify {confirm.name}?</p>
            <p className="mt-2 text-sm text-gray-600">A gold ✓ appears next to their name on their page, their events, and receipts. Only verify organizations you've confirmed are real.</p>
            {confirm.kind === 'nonprofit' && (
              <ul className="mt-3 list-disc pl-5 text-sm text-gray-600">
                <li>{confirm.ein ? <>Look up EIN <strong>{confirm.ein}</strong> in the IRS Tax Exempt Organization Search and confirm the name matches.</> : 'They haven\u2019t entered an EIN yet. Consider asking for it first.'}</li>
                <li>Make sure the person who created it ({confirm.created_by}) works with the organization.</li>
              </ul>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setConfirm(null)} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-700">Cancel</button>
              <button onClick={() => setVerified(confirm, true)} className="rounded-xl bg-[#0F1B3D] px-4 py-2.5 text-sm font-bold text-white">Verify</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
