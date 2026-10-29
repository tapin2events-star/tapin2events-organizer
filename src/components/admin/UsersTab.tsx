import { useEffect, useState } from 'react';
import AdminDeleteAccount from './AdminDeleteAccount';
import ProfileLink from '../ProfileLink';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { functionError } from '../../lib/functionError';
import { ListSkeleton } from '../ui/Skeleton';
import { Badge, Chips, ConfirmDialog, Empty, FormDialog, PAGE_SIZE, Pager, Row, SearchBox, actionBtn, dangerBtn, fmtDate, safeSearch, useDebounced, type Notify } from './shared';

interface UserRow {
  id: string; email: string; full_name: string | null; is_organizer: boolean | null; is_resource: boolean | null; is_admin: boolean | null;
  is_banned: boolean | null; stripe_charges_enabled: boolean | null; created_at: string;
  first_signed_in_at: string | null; last_signed_in_at: string | null;
}
type Filter = 'all' | 'organizers' | 'resources' | 'admins' | 'banned';
// Activity: who's new (joined, or signed in to the new app for the first time), who's active, who hasn't signed in yet.
type Activity = 'any' | 'joined' | 'first_signin' | 'active' | 'never';
const ACTIVITY: { id: Activity; label: string }[] = [
  { id: 'any', label: 'Everyone' }, { id: 'first_signin', label: 'First signed in' }, { id: 'joined', label: 'New sign-ups' }, { id: 'active', label: 'Active' }, { id: 'never', label: "Haven't signed in yet" },
];
type Range = '1' | '7' | '30' | 'all';
const RANGES: { id: Range; label: string }[] = [{ id: '1', label: 'Last 24 hours' }, { id: '7', label: 'Last 7 days' }, { id: '30', label: 'Last 30 days' }, { id: 'all', label: 'All time' }];
const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${Math.max(m, 1)}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
};
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'organizers', label: 'Organizers' }, { id: 'resources', label: 'Resources' }, { id: 'admins', label: 'Admins' }, { id: 'banned', label: 'Banned' },
];

export default function UsersTab({ notify, initialSearch = '' }: { notify: Notify; initialSearch?: string }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [activity, setActivity] = useState<Activity>('any');
  const [range, setRange] = useState<Range>('7');
  const [search, setSearch] = useState(initialSearch);
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [banning, setBanning] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState<UserRow | null>(null);
  const [adminChange, setAdminChange] = useState<UserRow | null>(null);
  const q = useDebounced(safeSearch(search));

  useEffect(() => { setPage(0); }, [filter, q, activity, range]);
  useEffect(() => { setSearch(initialSearch); }, [initialSearch]);

  useEffect(() => {
    let stale = false;
    setLoading(true);
    let query = supabase.from('profiles').select('id, email, full_name, is_organizer, is_resource, is_admin, is_banned, stripe_charges_enabled, created_at, first_signed_in_at, last_signed_in_at', { count: 'exact' });
    const since = range === 'all' ? null : new Date(Date.now() - Number(range) * 86400000).toISOString();
    const col = activity === 'joined' ? 'created_at' : activity === 'first_signin' ? 'first_signed_in_at' : activity === 'active' ? 'last_signed_in_at' : null;
    if (activity === 'never') query = query.is('first_signed_in_at', null);
    else if (col) { query = query.not(col, 'is', null); if (since) query = query.gte(col, since); }
    if (filter === 'organizers') query = query.eq('is_organizer', true);
    if (filter === 'resources') query = query.eq('is_resource', true);
    if (filter === 'admins') query = query.eq('is_admin', true);
    if (filter === 'banned') query = query.eq('is_banned', true);
    if (q) query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);
    query.order(col ?? 'created_at', { ascending: false, nullsFirst: false }).range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1).then(({ data, count, error }) => {
      if (stale) return;
      if (error) { console.error(error); notify('err', "Couldn't load users."); }
      setRows((data ?? []) as UserRow[]);
      setTotal(count ?? 0);
      setLoading(false);
    });
    return () => { stale = true; };
  }, [filter, q, page, notify, activity, range]);

  async function setBanned(u: UserRow, banned: boolean, reason: string) {
    const { data, error } = await supabase.functions.invoke('admin-user-action', { body: { action: banned ? 'ban' : 'unban', user_id: u.id, reason } });
    if (error || !data?.ok) return notify('err', (await functionError(error, "That didn't work. Please try again.")).message);
    setRows((prev) => prev.map((x) => (x.id === u.id ? { ...x, is_banned: banned } : x)));
    notify('ok', banned ? `${u.full_name || u.email} is banned${data.sign_in_blocked ? ' and can no longer sign in' : ''}.` : `${u.full_name || u.email} can use TapIN again.`);
  }

  async function setAdmin(u: UserRow, makeAdmin: boolean) {
    const { error } = await supabase.from('profiles').update({ is_admin: makeAdmin }).eq('id', u.id);
    if (error) return notify('err', "That didn't save. Please try again.");
    setRows((prev) => prev.map((x) => (x.id === u.id ? { ...x, is_admin: makeAdmin } : x)));
    notify('ok', makeAdmin ? `${u.full_name || u.email} is now an admin.` : `${u.full_name || u.email} is no longer an admin.`);
  }

  async function saveName(u: UserRow, name: string) {
    const { error } = await supabase.from('profiles').update({ full_name: name || null }).eq('id', u.id);
    if (error) return notify('err', "That didn't save. Please try again.");
    setRows((prev) => prev.map((x) => (x.id === u.id ? { ...x, full_name: name || null } : x)));
    notify('ok', 'Saved.');
  }

  return (
    <div className="mt-6">
      <SearchBox value={search} onChange={setSearch} placeholder="Search by name or email" />
      <div className="mt-3"><Chips options={FILTERS} value={filter} onChange={setFilter} /></div>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Chips options={ACTIVITY} value={activity} onChange={setActivity} />
        {activity !== 'any' && activity !== 'never' && (
          <select value={range} onChange={(e) => setRange(e.target.value as Range)} aria-label="Time range" className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-700">
            {RANGES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        )}
      </div>
      {!loading && activity !== 'any' && <p className="mt-2 text-xs text-gray-500">{total} {total === 1 ? 'person' : 'people'}{activity === 'never' ? " haven't signed in to the new app yet" : activity === 'joined' ? ' signed up' : activity === 'first_signin' ? ' signed in for the first time' : ' were active'}{activity !== 'never' && range !== 'all' ? ` in the ${RANGES.find((r) => r.id === range)?.label.toLowerCase()}` : ''}.</p>}
      {loading ? <ListSkeleton rows={5} className="mt-4" /> : rows.length === 0 ? <div className="mt-4"><Empty text="No users match." /></div> : (
        <div className="mt-4 flex flex-col gap-2">
          {rows.map((u) => {
            const me = u.id === user?.id;
            return (
              <Row key={u.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <ProfileLink email={u.email} className="font-medium text-gray-900 hover:text-marigold">{u.full_name || u.email}</ProfileLink>{me && <span className="ml-1 text-xs text-gray-400">(you)</span>}
                    <p className="truncate text-xs text-gray-500">{u.email} · joined {fmtDate(u.created_at)}</p>
                    <p className="truncate text-xs text-gray-500">
                      {u.first_signed_in_at
                        ? <>First signed in {fmtDate(u.first_signed_in_at)}{u.last_signed_in_at ? ` · last active ${ago(u.last_signed_in_at)}` : ''}</>
                        : <span className="text-amber-700">Hasn't signed in to the new app yet</span>}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {u.is_admin && <Badge tone="purple">Admin</Badge>}
                    {u.is_organizer && <Badge tone="blue">Organizer</Badge>}
                    {u.is_resource && <Badge tone="blue">Resource</Badge>}
                    {u.stripe_charges_enabled && <Badge tone="green">Payouts on</Badge>}
                    {u.is_banned && <Badge tone="red">Banned</Badge>}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button className={actionBtn} onClick={() => setEditing(u)}>Edit name</button>
                  {!me && !u.is_admin && (u.is_banned
                    ? <button className={actionBtn} onClick={() => setBanning(u)}>Unban</button>
                    : <button className={dangerBtn} onClick={() => setBanning(u)}>Ban</button>)}
                  {!me && <button className={actionBtn} onClick={() => setAdminChange(u)}>{u.is_admin ? 'Remove admin' : 'Make admin'}</button>}
                  {!me && !u.is_admin && <button className={dangerBtn} onClick={() => setDeleting(u)}>Delete</button>}
                </div>
              </Row>
            );
          })}
        </div>
      )}
      <Pager page={page} total={total} onPage={setPage} />
      {editing && (
        <FormDialog title="Edit name" initial={{ full_name: editing.full_name ?? '' }} onClose={() => setEditing(null)}
          fields={[{ key: 'full_name', label: 'Full name' }]} onSave={async (v) => saveName(editing, v.full_name.trim())} />
      )}
      {banning && (
        <ConfirmDialog
          title={banning.is_banned ? `Unban ${banning.full_name || banning.email}?` : `Ban ${banning.full_name || banning.email}?`}
          confirmLabel={banning.is_banned ? 'Unban' : 'Ban'} danger={!banning.is_banned}
          askReason={banning.is_banned ? undefined : 'Reason (only you and other admins will see this)'}
          body={banning.is_banned
            ? 'They will be able to sign in and use TapIN again.'
            : "They'll be signed out and can't sign in. They also can't post, comment, follow, create events, list products, book resources, or buy tickets. Their existing content stays as it is."}
          onClose={() => setBanning(null)} onConfirm={async (reason) => setBanned(banning, !banning.is_banned, reason)} />
      )}
      {deleting && <AdminDeleteAccount userId={deleting.id} label={deleting.full_name || deleting.email} onClose={() => setDeleting(null)}
        onDeleted={() => { const gone = deleting; setDeleting(null); setRows((prev) => prev.filter((x) => x.id !== gone.id)); notify('ok', `Deleted ${gone.full_name || gone.email}`); }} />}
      {adminChange && (
        <ConfirmDialog
          title={adminChange.is_admin ? 'Remove admin access?' : 'Make this person an admin?'}
          confirmLabel={adminChange.is_admin ? 'Remove admin' : 'Make admin'} danger={!adminChange.is_admin}
          body={adminChange.is_admin
            ? `${adminChange.full_name || adminChange.email} will lose access to this dashboard.`
            : `${adminChange.full_name || adminChange.email} will be able to see all users, payments, and messages' metadata, ban accounts, and edit or remove any content. Only do this for someone you trust completely.`}
          onClose={() => setAdminChange(null)} onConfirm={async () => setAdmin(adminChange, !adminChange.is_admin)} />
      )}
    </div>
  );
}
