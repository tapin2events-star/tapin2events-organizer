import { useCallback, useEffect, useState } from 'react';
import AnnounceLineupsToggle from '../components/resources/AnnounceLineupsToggle';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import BackButton from '../components/BackButton';
import { ConfirmDialog, FormDialog } from '../components/admin/shared';
import GroupProfileFields, { type GroupFields } from '../components/groups/GroupProfileFields';
import { ROLE_LABELS, rpcError, type GroupRole, type ManagedMember } from '../lib/groups';
import ResourceMediaManager from '../components/resources/ResourceMediaManager';
import GroupBookings from '../components/groups/GroupBookings';
import GroupPayments from '../components/groups/GroupPayments';
import GroupContent from '../components/groups/GroupContent';
import type { Resource } from '../lib/types';

const btn = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:border-marigold disabled:opacity-50';
const input = 'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900';

function toFields(r: Resource): GroupFields {
  return { name: r.display_name, bio: r.bio ?? '', categories: r.categories ?? [], city: r.city ?? '', state: r.state ?? '', profile_image: r.profile_image, cover_image: r.cover_image ?? null, instagram: r.instagram_url ?? '', website: r.website_url ?? '', pricing_type: (r.pricing_type as GroupFields['pricing_type']) ?? 'contact_quote', base_rate: r.pricing_type === 'contact_quote' ? '' : String(r.base_rate ?? ''), pricing_details: r.pricing_details ?? '' };
}

interface Person { email: string; full_name: string | null; profile_photo: string | null; is_resource: boolean }

export default function GroupManage() {
  const { id = '' } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [group, setGroup] = useState<Resource | null>(null);
  const [role, setRole] = useState<GroupRole | null>(null);
  const [members, setMembers] = useState<ManagedMember[]>([]);
  const [fields, setFields] = useState<GroupFields | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(params.get('created') ? { ok: true, text: 'Your group is live! Now invite your members below.' } : null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Person[]>([]);
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member');
  const [inviteTitle, setInviteTitle] = useState('');
  const [confirm, setConfirm] = useState<null | { kind: 'remove' | 'leave' | 'delete' | 'owner'; member?: ManagedMember }>(null);
  const [titleFor, setTitleFor] = useState<ManagedMember | null>(null);

  const isAdmin = role === 'owner' || role === 'admin';
  const me = members.find((m) => m.user_email === user?.email);
  const say = (ok: boolean, text: string) => setNotice({ ok, text });

  const load = useCallback(async () => {
    const [{ data: g }, { data: r }, { data: rows }] = await Promise.all([
      supabase.from('resources').select('*').eq('id', id).eq('kind', 'group').maybeSingle(),
      supabase.rpc('group_role', { p_group: id }),
      supabase.from('group_members').select('user_email, role, title, status, show_on_group').eq('group_id', id),
    ]);
    setGroup((g as Resource) ?? null);
    if (g) setFields((f) => f ?? toFields(g as Resource));
    setRole((r as GroupRole) ?? null);
    const list = (rows ?? []) as ManagedMember[];
    if (list.length) {
      const { data: people } = await supabase.from('public_profiles').select('email, full_name, profile_photo').in('email', list.map((m) => m.user_email));
      const byEmail = new Map((people ?? []).map((p) => [p.email, p]));
      list.forEach((m) => { m.full_name = byEmail.get(m.user_email)?.full_name ?? null; m.profile_photo = byEmail.get(m.user_email)?.profile_photo ?? null; });
    }
    const order = { owner: 0, admin: 1, member: 2 } as const;
    list.sort((a, b) => Number(a.status === 'invited') - Number(b.status === 'invited') || order[a.role] - order[b.role]);
    setMembers(list);
    setLoading(false);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  // People search for invites (waits for a pause in typing).
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    const t = window.setTimeout(async () => {
      const { data } = await supabase.rpc('search_people', { p_query: query.trim() });
      const taken = new Set(members.map((m) => m.user_email));
      setResults(((data ?? []) as Person[]).filter((p) => !taken.has(p.email)));
    }, 300);
    return () => window.clearTimeout(t);
  }, [query, members]);

  async function saveProfile() {
    if (!fields || !group) return;
    if (fields.name.trim().length < 2) return say(false, 'Give your group a name.');
    const rate = parseFloat(fields.base_rate);
    if (fields.pricing_type !== 'contact_quote' && !(rate >= 0)) return say(false, 'Enter your rate, or choose Contact for a quote.');
    setSaving(true);
    const { error } = await supabase.from('resources').update({
      display_name: fields.name.trim().slice(0, 120), bio: fields.bio.trim().slice(0, 3000), categories: fields.categories,
      city: fields.city.trim() || null, state: fields.state.trim() || null,
      location: [fields.city.trim(), fields.state.trim()].filter(Boolean).join(', ') || null,
      profile_image: fields.profile_image, cover_image: fields.cover_image,
      instagram_url: fields.instagram.trim() || null, website_url: fields.website.trim() || null,
      pricing_type: fields.pricing_type, base_rate: fields.pricing_type === 'contact_quote' ? 0 : Math.min(rate, 1000000),
      pricing_details: fields.pricing_details.trim().slice(0, 2000) || null,
    }).eq('id', group.id);
    setSaving(false);
    say(!error, error ? "Couldn't save. Please try again." : 'Group profile saved.');
    if (!error) load();
  }

  async function invite(email: string) {
    const { error } = await supabase.rpc('invite_to_group', { p_group: id, p_email: email, p_role: inviteRole, p_title: inviteTitle || null });
    if (error) return say(false, rpcError(error));
    setQuery(''); setResults([]); setInviteTitle('');
    say(true, 'Invite sent. They\u2019ll get a notification to join.');
    load();
  }

  async function updateMember(m: ManagedMember, patch: { p_role?: string; p_title?: string; p_show?: boolean; p_remove?: boolean }, okText?: string) {
    const { error } = await supabase.rpc('update_group_member', { p_group: id, p_email: m.user_email, ...patch });
    if (error) { say(false, rpcError(error)); return false; }
    if (okText) say(true, okText);
    load();
    return true;
  }

  if (loading) return <p className="text-sm text-muted">Loading…</p>;
  if (!group || !role) {
    return (
      <div className="mx-auto max-w-2xl">
        <BackButton fallback="/groups" fallbackLabel="Groups" />
        <p className="mt-4 rounded-xl border border-gray-200 bg-surface p-6 text-center text-sm text-muted">This group doesn't exist or you're not a member.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-3"><BackButton fallback="/groups" fallbackLabel="Groups" /></div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-muted">{ROLE_LABELS[role]}</p>
          <h1 className="truncate font-display text-3xl font-extrabold text-bone">{group.display_name}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/groups/${group.id}/chat`} className="rounded-lg bg-marigold px-3 py-2 text-sm font-semibold text-white hover:bg-marigold/90">Group chat</Link>
          <Link to={`/resources/${group.id}`} className={btn}>View group page</Link>
        </div>
      </div>

      {notice && <p role={notice.ok ? 'status' : 'alert'} className={`mt-4 rounded-lg px-3 py-2 text-sm ${notice.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{notice.text}</p>}

      <GroupBookings groupId={group.id} groupName={group.display_name} canRespond={isAdmin} />
      <GroupPayments groupId={group.id} isOwner={role === 'owner'} />
      {isAdmin && <div className="mt-6"><AnnounceLineupsToggle resourceId={group.id} isGroup /></div>}
      <GroupContent groupId={group.id} groupName={group.display_name} isAdmin={isAdmin} />

      {/* ---------- Members ---------- */}
      <section className="mt-6 rounded-2xl border border-gray-200 bg-surface p-4 sm:p-5">
        <h2 className="font-display text-lg font-semibold text-bone">Members</h2>
        {isAdmin && (
          <div className="mt-3 rounded-xl border border-dashed border-gray-300 p-3">
            <label className="text-sm font-medium text-gray-700">Invite someone
              <input className={input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or enter their email" />
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="text-xs font-medium text-gray-600">Role
                <select className={input} value={inviteRole} onChange={(e) => setInviteRole(e.target.value as 'member' | 'admin')}>
                  <option value="member">Member</option>
                  {role === 'owner' && <option value="admin">Admin (can edit and invite)</option>}
                </select>
              </label>
              <label className="text-xs font-medium text-gray-600">Title <span className="font-normal text-gray-400">(optional)</span>
                <input className={input} value={inviteTitle} maxLength={60} onChange={(e) => setInviteTitle(e.target.value)} placeholder="e.g. Drums, Manager" />
              </label>
            </div>
            {results.length > 0 && (
              <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
                {results.map((p) => (
                  <li key={p.email} className="flex items-center gap-3 p-2">
                    {p.profile_photo ? <img src={p.profile_photo} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-200 text-sm font-bold text-gray-600">{(p.full_name || '?').charAt(0)}</span>}
                    <span className="min-w-0 flex-1 truncate text-sm text-gray-900">{p.full_name || 'TapIN member'}{p.is_resource && <span className="ml-1 text-xs text-purple-700">· Resource</span>}</span>
                    <button onClick={() => invite(p.email)} className="rounded-lg bg-marigold px-3 py-1.5 text-xs font-semibold text-white">Invite</button>
                  </li>
                ))}
              </ul>
            )}
            {query.includes('@') && results.length === 0 && query.trim().length > 5 && (
              <button onClick={() => invite(query.trim())} className="mt-2 rounded-lg bg-marigold px-3 py-2 text-sm font-semibold text-white">Invite {query.trim()}</button>
            )}
            <p className="mt-2 text-xs text-muted">Anyone with a TapIN account can join, including managers and crew without a resource profile. They choose whether to accept.</p>
          </div>
        )}

        <ul className="mt-3 flex flex-col gap-2">
          {members.map((m) => {
            const self = m.user_email === user?.email;
            const name = m.full_name || 'TapIN member';
            const canRemove = !self && isAdmin && m.role !== 'owner' && !(m.role === 'admin' && role !== 'owner');
            return (
              <li key={m.user_email} className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="flex flex-wrap items-center gap-3">
                  {m.profile_photo ? <img src={m.profile_photo} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 font-bold text-gray-600">{name.charAt(0)}</span>}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{name}{self && <span className="text-gray-400"> (you)</span>}</p>
                    <p className="text-xs text-gray-500">{ROLE_LABELS[m.role]}{m.title ? ` · ${m.title}` : ''}{m.status === 'invited' ? ' · Invite pending' : ''}{m.status === 'active' && !m.show_on_group ? ' · Hidden from group page' : ''}</p>
                  </div>
                </div>
                {(isAdmin && !self) && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button className={btn} onClick={() => setTitleFor(m)}>Edit title</button>
                    {role === 'owner' && m.role !== 'owner' && m.status === 'active' && (
                      <button className={btn} onClick={() => updateMember(m, { p_role: m.role === 'admin' ? 'member' : 'admin' }, m.role === 'admin' ? `${name} is now a member.` : `${name} is now an admin.`)}>{m.role === 'admin' ? 'Make member' : 'Make admin'}</button>
                    )}
                    {role === 'owner' && m.role !== 'owner' && m.status === 'active' && <button className={btn} onClick={() => setConfirm({ kind: 'owner', member: m })}>Make owner</button>}
                    {canRemove && <button className={`${btn} text-red-600`} onClick={() => setConfirm({ kind: 'remove', member: m })}>{m.status === 'invited' ? 'Cancel invite' : 'Remove'}</button>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* ---------- My membership ---------- */}
      {me && (
        <section className="mt-6 rounded-2xl border border-gray-200 bg-surface p-4 sm:p-5">
          <h2 className="font-display text-lg font-semibold text-bone">Your membership</h2>
          <label className="mt-3 flex items-start gap-3 text-sm text-gray-700">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-marigold" checked={me.show_on_group} onChange={(e) => updateMember(me, { p_show: e.target.checked }, e.target.checked ? 'You\u2019re shown on the group page.' : 'You\u2019re hidden from the group page.')} />
            <span>Show me on the group's page<span className="block text-xs text-muted">Links to your resource profile (or your TapIN profile), and shows "Member of {group.display_name}" on your profile.</span></span>
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className={btn} onClick={() => setTitleFor(me)}>Edit my title</button>
            {role !== 'owner' && <button className={`${btn} text-red-600`} onClick={() => setConfirm({ kind: 'leave' })}>Leave group</button>}
          </div>
        </section>
      )}

      {/* ---------- Profile ---------- */}
      {isAdmin && fields && (
        <section className="mt-6 rounded-2xl border border-gray-200 bg-surface p-4 sm:p-5">
          <h2 className="mb-3 font-display text-lg font-semibold text-bone">Group profile</h2>
          <GroupProfileFields value={fields} onChange={setFields} />
          <button onClick={saveProfile} disabled={saving} className="mt-4 rounded-lg bg-marigold px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save profile'}</button>

        </section>
      )}

      {isAdmin && (
        <section className="mt-6 rounded-2xl border border-gray-200 bg-surface p-4 sm:p-5">
          <h2 className="mb-1 font-display text-lg font-semibold text-bone">Photos, videos &amp; music</h2>
          <p className="mb-3 text-xs text-muted">Shown on the group's page.</p>
          <ResourceMediaManager resourceId={group.id} />
        </section>
      )}

      {role === 'owner' && (
        <section className="mt-6 rounded-2xl border border-red-200 bg-red-50/50 p-4 sm:p-5">
          <h2 className="font-display text-lg font-semibold text-red-800">Delete group</h2>
          <p className="mt-1 text-sm text-red-700">Removes the group page and all memberships. Members' own profiles aren't affected. To leave instead, make someone else the owner first.</p>
          <button onClick={() => setConfirm({ kind: 'delete' })} className="mt-3 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700">Delete group</button>
        </section>
      )}

      {titleFor && (
        <FormDialog title={titleFor.user_email === user?.email ? 'Your title in this group' : `Title for ${titleFor.full_name || 'this member'}`}
          initial={{ title: titleFor.title ?? '' }} fields={[{ key: 'title', label: 'Title (e.g. Lead vocals, DJ, Manager)' }]}
          onClose={() => setTitleFor(null)} onSave={async (v) => { await updateMember(titleFor, { p_title: v.title }, 'Title updated.'); }} />
      )}
      {confirm?.kind === 'remove' && confirm.member && (
        <ConfirmDialog danger title={confirm.member.status === 'invited' ? 'Cancel this invite?' : `Remove ${confirm.member.full_name || 'this member'}?`} confirmLabel={confirm.member.status === 'invited' ? 'Cancel invite' : 'Remove'}
          body="They'll no longer be part of the group or appear on its page." onClose={() => setConfirm(null)}
          onConfirm={async () => { await updateMember(confirm.member!, { p_remove: true }, 'Done.'); }} />
      )}
      {confirm?.kind === 'owner' && confirm.member && (
        <ConfirmDialog title={`Make ${confirm.member.full_name || 'them'} the owner?`} confirmLabel="Make owner"
          body="They'll control the group, including roles and deleting it. You'll become an admin." onClose={() => setConfirm(null)}
          onConfirm={async () => { await updateMember(confirm.member!, { p_role: 'owner' }, 'Ownership handed over. You\u2019re now an admin.'); }} />
      )}
      {confirm?.kind === 'leave' && me && (
        <ConfirmDialog danger title={`Leave ${group.display_name}?`} confirmLabel="Leave group" body="You'll come off the group page. An admin can invite you back later." onClose={() => setConfirm(null)}
          onConfirm={async () => { if (await updateMember(me, { p_remove: true })) navigate('/groups', { replace: true }); }} />
      )}
      {confirm?.kind === 'delete' && (
        <ConfirmDialog danger title={`Delete ${group.display_name}?`} confirmLabel="Delete group" body="This can't be undone." onClose={() => setConfirm(null)}
          onConfirm={async () => {
            const { error } = await supabase.rpc('delete_group', { p_group: group.id });
            if (error) return say(false, rpcError(error));
            navigate('/groups', { replace: true });
          }} />
      )}
    </div>
  );
}
