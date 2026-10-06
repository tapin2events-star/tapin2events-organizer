import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import BackButton from '../components/BackButton';
import { ListSkeleton } from '../components/ui/Skeleton';
import { ROLE_LABELS, rpcError, type MyGroup } from '../lib/groups';

// Groups you're in, invites waiting on you, and a way to start a new group.
export default function MyGroups() {
  const [groups, setGroups] = useState<MyGroup[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.rpc('my_groups');
    setGroups((data ?? []) as MyGroup[]);
  }
  useEffect(() => { load(); }, []);

  async function respond(g: MyGroup, accept: boolean) {
    setBusy(g.group_id); setError(null);
    const { error: e } = await supabase.rpc('respond_group_invite', { p_group: g.group_id, p_accept: accept });
    setBusy(null);
    if (e) return setError(rpcError(e));
    load();
  }

  const invites = (groups ?? []).filter((g) => g.status === 'invited');
  const mine = (groups ?? []).filter((g) => g.status === 'active');

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-3"><BackButton fallback="/profile" fallbackLabel="Profile" /></div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-bone">Groups</h1>
          <p className="mt-1 text-sm text-muted">Bands, crews, collectives, teams: a shared profile for people who work together.</p>
        </div>
        <Link to="/groups/new" className="rounded-lg bg-marigold px-4 py-2.5 text-sm font-semibold text-white hover:bg-marigold/90">+ Create a group</Link>
      </div>
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {groups === null ? <ListSkeleton rows={3} className="mt-6" /> : (
        <>
          {invites.length > 0 && (
            <section className="mt-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Invites</h2>
              <div className="mt-2 flex flex-col gap-2">
                {invites.map((g) => (
                  <div key={g.group_id} className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                    <p className="text-sm text-gray-800"><strong>{g.invited_by_name || 'Someone'}</strong> invited you to join <Link to={`/resources/${g.group_id}`} className="font-semibold text-marigold hover:underline">{g.name}</Link>{g.title ? ` as ${g.title}` : ''}.</p>
                    <div className="mt-3 flex gap-2">
                      <button disabled={busy === g.group_id} onClick={() => respond(g, true)} className="rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Join</button>
                      <button disabled={busy === g.group_id} onClick={() => respond(g, false)} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 disabled:opacity-50">Decline</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Your groups</h2>
            {mine.length === 0 ? (
              <p className="mt-2 rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-muted">You're not in any groups yet. Create one and invite the people you perform or work with.</p>
            ) : (
              <div className="mt-2 flex flex-col gap-2">
                {mine.map((g) => (
                  <div key={g.group_id} className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-surface p-3">
                    {g.profile_image
                      ? <img src={g.profile_image} alt="" className="h-12 w-12 rounded-full object-cover" />
                      : <span className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 font-bold text-purple-700">{g.name.charAt(0)}</span>}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-bone">{g.name}</p>
                      <p className="text-xs text-muted">{ROLE_LABELS[g.role]}{g.title ? ` · ${g.title}` : ''} · {g.member_count} member{g.member_count === 1 ? '' : 's'}</p>
                    </div>
                    <div className="flex gap-2">
                      <Link to={`/groups/${g.group_id}/chat`} className="rounded-lg bg-marigold px-3 py-2 text-sm font-semibold text-white">Chat</Link>
                      <Link to={`/resources/${g.group_id}`} className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:border-marigold">View</Link>
                      <Link to={`/groups/${g.group_id}/manage`} className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:border-marigold">{g.role === 'member' ? 'Settings' : 'Manage'}</Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
