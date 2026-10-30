import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { toast, toastError } from '../../lib/toast';

// Organizations and artist groups: an organization adds a group (shown on its page as "Our artists", and/or the group's
// members on its team), the group's owner or an admin approves, and team access stays in sync with the group.
const ROLE_LABEL: Record<string, string> = { viewer: 'Viewer', helper: 'Helper', editor: 'Editor' };
interface Link_ { group_id: string; name: string; photo: string | null; show_on_page: boolean; team_role: string | null; status: string; members: number }
interface Found { id: string; name: string; photo: string | null; members: number }

// Organization → Team: add groups, and the linked groups with their settings.
export function OrgGroupsManager({ orgId, canEdit }: { orgId: string; canEdit: boolean }) {
  const [links, setLinks] = useState<Link_[]>([]);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Found[]>([]);
  const [picked, setPicked] = useState<Found | null>(null);
  const [show, setShow] = useState(true);
  const [team, setTeam] = useState(true);
  const [role, setRole] = useState('helper');
  const load = useCallback(() => { supabase.rpc('org_group_links', { p_org: orgId }).then(({ data }) => setLinks((data ?? []) as Link_[])); }, [orgId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (picked || q.trim().length < 2) { setFound([]); return; }
    const t = setTimeout(() => { supabase.rpc('search_artist_groups', { p_query: q }).then(({ data }) => setFound(((data ?? []) as Found[]).filter((g) => !links.some((l) => l.group_id === g.id)))); }, 250);
    return () => clearTimeout(t);
  }, [q, picked, links]);
  async function request() {
    if (!picked) return;
    const { error } = await supabase.rpc('request_org_group', { p_org: orgId, p_group: picked.id, p_show: show, p_role: team ? role : null });
    if (error) return toastError(error.message);
    toast(`Request sent to ${picked.name}`); setPicked(null); setQ(''); load();
  }
  async function update(l: Link_, patch: Partial<Pick<Link_, 'show_on_page' | 'team_role'>>) {
    const next = { ...l, ...patch };
    if (!next.show_on_page && !next.team_role) return toastError('Keep at least one: show on your page, or on your team.');
    const { error } = await supabase.rpc('update_org_group', { p_org: orgId, p_group: l.group_id, p_show: next.show_on_page, p_role: next.team_role });
    if (error) return toastError(error.message);
    load();
  }
  async function unlink(l: Link_) {
    if (!window.confirm(`Remove ${l.name}? It comes off your page, and members who were added through the group leave your team.`)) return;
    const { error } = await supabase.rpc('unlink_org_group', { p_org: orgId, p_group: l.group_id });
    if (error) return toastError(error.message);
    toast('Group removed'); load();
  }
  return (
    <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
      <h2 className="font-display text-lg font-semibold text-gray-900">🎤 Artist groups</h2>
      <p className="text-xs text-gray-500">Add a whole group at once: show it on your page as one of &quot;Our artists&quot;, add its members to your team, or both. The group&apos;s owner approves, and your team stays in sync as members join or leave.</p>
      {links.length > 0 && (
        <ul className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-200">
          {links.map((l) => (
            <li key={l.group_id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              {l.photo ? <img src={l.photo} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-700">{l.name.charAt(0)}</span>}
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-gray-900">{l.name}</span>
                <span className="block text-xs text-gray-500">{l.status === 'pending' ? 'Waiting for the group to approve' : `${l.members} member${l.members === 1 ? '' : 's'}`}</span></span>
              {canEdit && l.status === 'active' && (
                <span className="flex flex-wrap items-center gap-2 text-xs">
                  <label className="flex items-center gap-1"><input type="checkbox" checked={l.show_on_page} onChange={(e) => update(l, { show_on_page: e.target.checked })} className="h-4 w-4 accent-indigo-600" /> On our page</label>
                  <select value={l.team_role ?? ''} onChange={(e) => update(l, { team_role: e.target.value || null })} aria-label={`${l.name} team role`} className="min-h-[32px] rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-900">
                    <option value="">Not on team</option><option value="viewer">Team: Viewers</option><option value="helper">Team: Helpers</option><option value="editor">Team: Editors</option>
                  </select>
                </span>
              )}
              {canEdit && <button onClick={() => unlink(l)} className="text-xs font-medium text-red-700">{l.status === 'pending' ? 'Cancel' : 'Remove'}</button>}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <div className="mt-3">
          {picked ? (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3">
              <p className="text-sm font-semibold text-indigo-950">Add {picked.name} ({picked.members} member{picked.members === 1 ? '' : 's'})</p>
              <label className="mt-2 flex items-center gap-2 text-sm text-gray-800"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="h-4 w-4 accent-indigo-600" /> Show on our page (&quot;Our artists&quot;)</label>
              <label className="mt-1 flex items-center gap-2 text-sm text-gray-800"><input type="checkbox" checked={team} onChange={(e) => setTeam(e.target.checked)} className="h-4 w-4 accent-indigo-600" /> Add its members to our team as
                <select value={role} onChange={(e) => setRole(e.target.value)} disabled={!team} className="min-h-[32px] rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900 disabled:opacity-50">
                  <option value="viewer">Viewers</option><option value="helper">Helpers</option><option value="editor">Editors</option>
                </select></label>
              <div className="mt-3 flex gap-2">
                <button onClick={request} disabled={!show && !team} className="min-h-[40px] rounded-full bg-indigo-600 px-4 text-sm font-semibold text-white disabled:opacity-50">Send request</button>
                <button onClick={() => setPicked(null)} className="min-h-[40px] rounded-full border border-gray-300 bg-white px-4 text-sm text-gray-700">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="relative">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add a group: search artist groups by name" aria-label="Search artist groups" className="min-h-[44px] w-full rounded-xl border border-gray-300 px-3 text-base text-gray-900 sm:text-sm" />
              {found.length > 0 && (
                <ul className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
                  {found.map((g) => (
                    <li key={g.id}><button onClick={() => { setPicked(g); setFound([]); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50">
                      {g.photo ? <img src={g.photo} alt="" className="h-7 w-7 rounded-full object-cover" /> : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">{g.name.charAt(0)}</span>}
                      <span className="min-w-0 flex-1 truncate text-gray-900">{g.name}</span><span className="text-xs text-gray-500">{g.members} member{g.members === 1 ? '' : 's'}</span>
                    </button></li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// Group → Manage (Members): organization requests to approve, and linked organizations.
export function GroupOrgLinks({ groupId, canDecide }: { groupId: string; canDecide: boolean }) {
  const [list, setList] = useState<{ org_id: string; name: string; logo: string | null; slug: string; show_on_page: boolean; team_role: string | null; status: string }[]>([]);
  const load = useCallback(() => { supabase.rpc('group_org_links', { p_group: groupId }).then(({ data }) => setList((data ?? []) as typeof list)); }, [groupId]);
  useEffect(() => { load(); }, [load]);
  if (list.length === 0) return null;
  const what = (l: { show_on_page: boolean; team_role: string | null }) => [l.show_on_page ? 'on their page' : null, l.team_role ? `members on their team as ${ROLE_LABEL[l.team_role]}s` : null].filter(Boolean).join(' and ');
  async function decide(orgId: string, approve: boolean) {
    const { error } = await supabase.rpc('decide_org_group', { p_org: orgId, p_group: groupId, p_approve: approve });
    if (error) return toastError(error.message);
    toast(approve ? 'Approved' : 'Declined'); load();
  }
  async function unlink(orgId: string, name: string) {
    if (!window.confirm(`Leave ${name}? The group comes off their page, and team access through the group ends.`)) return;
    const { error } = await supabase.rpc('unlink_org_group', { p_org: orgId, p_group: groupId });
    if (error) return toastError(error.message);
    load();
  }
  return (
    <section className="mt-6 rounded-2xl border border-gray-200 bg-surface p-4 sm:p-5">
      <h2 className="font-display text-lg font-semibold text-bone">🤝 Organizations</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {list.map((l) => (
          <li key={l.org_id} className={`rounded-xl border p-3 ${l.status === 'pending' ? 'border-indigo-200 bg-indigo-50' : 'border-gray-200 bg-white'}`}>
            <p className="text-sm text-gray-900"><Link to={`/o/${l.slug}`} className="font-semibold hover:underline">{l.name}</Link> {l.status === 'pending' ? 'wants to add the group' : 'has the group'} {what(l)}.</p>
            {canDecide && (l.status === 'pending' ? (
              <div className="mt-2 flex gap-2">
                <button onClick={() => decide(l.org_id, true)} className="min-h-[40px] rounded-full bg-indigo-600 px-4 text-sm font-semibold text-white">Approve</button>
                <button onClick={() => decide(l.org_id, false)} className="min-h-[40px] rounded-full border border-gray-300 bg-white px-4 text-sm text-gray-700">Decline</button>
              </div>
            ) : <button onClick={() => unlink(l.org_id, l.name)} className="mt-1 text-xs font-medium text-red-700">Leave this organization</button>)}
          </li>
        ))}
      </ul>
    </section>
  );
}

// Organization page: "Our artists".
export function OrgArtistsSection({ orgId }: { orgId: string }) {
  const [list, setList] = useState<{ id: string; name: string; photo: string | null; cover: string | null; members: number }[]>([]);
  useEffect(() => { supabase.rpc('org_public_groups', { p_org: orgId }).then(({ data }) => setList((data ?? []) as typeof list)); }, [orgId]);
  if (list.length === 0) return null;
  return (
    <section className="pb-10" aria-label="Our artists">
      <h2 className="text-xl font-bold">Our artists</h2>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {list.map((g) => (
          <Link key={g.id} to={`/resources/${g.id}`} className="overflow-hidden rounded-2xl border border-gray-200 bg-white text-gray-900 shadow-sm transition hover:shadow-md">
            <div className="relative h-20 bg-gradient-to-br from-indigo-600 to-teal-500">{g.cover && <img src={g.cover} alt="" className="h-full w-full object-cover" />}</div>
            <div className="-mt-8 flex flex-col items-center px-3 pb-3 text-center">
              {g.photo ? <img src={g.photo} alt="" className="h-16 w-16 rounded-full object-cover ring-4 ring-white" /> : <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-xl font-bold text-indigo-700 ring-4 ring-white">{g.name.charAt(0)}</span>}
              <span className="mt-2 line-clamp-2 text-sm font-semibold">{g.name}</span>
              <span className="text-xs text-gray-500">{g.members} member{g.members === 1 ? '' : 's'}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
