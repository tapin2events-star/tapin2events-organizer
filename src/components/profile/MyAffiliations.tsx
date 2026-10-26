import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { toast, toastError } from '../../lib/toast';

// Profile > Organizations on your profile: featured affiliations show automatically (hide any you like);
// team memberships are hidden unless you switch them on.
interface Row { org_id: string; name: string; logo: string | null; kind: 'featured' | 'team'; title: string | null; role: string | null; show_team: boolean | null; hidden: boolean }
export default function MyAffiliations({ bare = false }: { bare?: boolean } = {}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const load = useCallback(() => { supabase.rpc('my_affiliations').then(({ data }) => setRows((data ?? []) as Row[])); }, []);
  useEffect(() => { load(); }, [load]);
  if (!rows) return null;
  if (rows.length === 0) return bare ? <p className="text-sm text-muted">Organizations that feature you, or that you're on the team of, show up here.</p> : null;
  // One line per organization: featured wins over team.
  const byOrg = new Map<string, { featured?: Row; team?: Row }>();
  for (const r of rows) { const e = byOrg.get(r.org_id) ?? {}; e[r.kind] = r; byOrg.set(r.org_id, e); }
  async function set(orgId: string, patch: { p_hidden?: boolean; p_show_team?: boolean }, msg: string) {
    const { error } = await supabase.rpc('set_affiliation', { p_org_id: orgId, p_hidden: patch.p_hidden ?? null, p_show_team: patch.p_show_team ?? null });
    if (error) return toastError();
    toast(msg); load();
  }
  return (
    <div id={bare ? undefined : 'affiliations'} className={bare ? '' : 'mt-8 scroll-mt-20'}>
      {!bare && <h2 className="mb-2 font-display text-lg font-semibold text-bone">Organizations on your profile</h2>}
      <p className="text-sm text-muted">Organizations that feature you show on your profile automatically. Team memberships stay private unless you switch them on.</p>
      <ul className="mt-3 flex flex-col gap-2">
        {[...byOrg.entries()].map(([orgId, { featured, team }]) => {
          const r = (featured ?? team)!;
          const shown = featured ? !featured.hidden : !!team?.show_team && !team.hidden;
          return (
            <li key={orgId} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-surface p-3">
              {r.logo ? <img src={r.logo} alt="" className="h-9 w-9 rounded-xl object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100" aria-hidden="true">🏢</span>}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-bone">{r.name}</span>
                <span className="block truncate text-xs text-muted">{featured ? `Featured${featured.title ? ` · ${featured.title}` : ''}` : `Team${team?.role ? ` · ${team.role}` : ''}`}</span>
              </span>
              <button role="switch" aria-checked={shown} aria-label={`Show ${r.name} on my profile`}
                onClick={() => featured
                  ? set(orgId, { p_hidden: shown }, shown ? `${r.name} hidden from your profile` : `✓ ${r.name} shows on your profile`)
                  : set(orgId, { p_show_team: !shown, ...(shown ? {} : { p_hidden: false }) }, shown ? `${r.name} hidden from your profile` : `✓ ${r.name} shows on your profile`)}
                className={`relative h-7 w-12 shrink-0 rounded-full transition ${shown ? 'bg-marigold' : 'bg-gray-300'}`}>
                <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${shown ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
