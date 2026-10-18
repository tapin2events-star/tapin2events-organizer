import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { loadMyOrgs } from '../../lib/business';
import Sheet from '../scouting/Sheet';

const WHAT_CHANGES = (
  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-gray-600">
    <li>It shows on the organization's page, calendar, website embed and audience.</li>
    <li>The organization's team is added to the event with their roles.</li>
    <li>Future ticket money goes to the organization's payout account (if it's connected). Money already paid out isn't affected.</li>
    <li>The organization's plan features apply to the event.</li>
  </ul>
);
const nice = (m?: string) => (m && !/function|permission|jwt/i.test(m) ? m : "Couldn't move the event. Please try again.");
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date to be announced');

// Organization settings > Events: add events you created on your own to this organization.
export function AddExistingEventsSheet({ orgId, orgName, onClose, onDone }: { orgId: string; orgName: string; onClose: () => void; onDone: (n: number) => void }) {
  const [events, setEvents] = useState<{ id: string; title: string; start_date: string | null; status: string; is_test: boolean }[] | null>(null);
  const [pick, setPick] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { supabase.rpc('my_movable_events').then(({ data }) => setEvents((data ?? []) as typeof events)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function move() {
    setBusy(true); setErr(null);
    const { data, error } = await supabase.rpc('move_events_to_org', { p_org_id: orgId, p_event_ids: pick });
    setBusy(false);
    if (error) return setErr(nice(error.message));
    onDone(Number(data) || 0);
  }
  return (
    <Sheet title="Add an existing event" onClose={onClose}>
      <p className="-mt-2 text-sm text-gray-600">Events you created on your own that aren't under an organization yet. Choose the ones to add to <strong>{orgName}</strong>.</p>
      {events === null ? <p className="mt-4 text-sm text-gray-500">Loading your events…</p> : events.length === 0 ? (
        <p className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">You don't have any events outside an organization. Create a new event instead.</p>
      ) : (
        <ul className="mt-3 flex max-h-72 flex-col gap-1.5 overflow-y-auto">
          {events.map((e) => (
            <li key={e.id}><label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm">
              <input type="checkbox" checked={pick.includes(e.id)} onChange={(x) => setPick((p) => (x.target.checked ? [...p, e.id] : p.filter((y) => y !== e.id)))} className="h-4 w-4 accent-marigold" />
              <span className="min-w-0 flex-1"><span className="block truncate font-medium text-gray-900">{e.title}</span><span className="block text-xs text-gray-500">{day(e.start_date)} · {e.is_test ? 'Test' : e.status === 'draft' ? 'Draft' : e.status === 'completed' ? 'Past' : 'Published'}</span></span>
            </label></li>
          ))}
        </ul>
      )}
      {!!events?.length && <div className="mt-4 rounded-xl bg-indigo-50 p-3"><p className="text-xs font-semibold text-indigo-900">What changes when you add an event</p>{WHAT_CHANGES}</div>}
      {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
      {!!events?.length && <button onClick={move} disabled={busy || !pick.length} className="mt-4 w-full rounded-xl bg-[#0F1B3D] py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Adding…' : `Add ${pick.length || ''} event${pick.length === 1 ? '' : 's'} to ${orgName}`}</button>}
    </Sheet>
  );
}

// Event menu: move one of your events into an organization you lead.
export function MoveEventToOrgSheet({ eventId, eventTitle, onClose, onDone }: { eventId: string; eventTitle: string; onClose: () => void; onDone: (orgName: string) => void }) {
  const [orgs, setOrgs] = useState<{ id: string; name: string }[] | null>(null);
  const [orgId, setOrgId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { loadMyOrgs().then((list) => { const leads = list.filter((o) => o.role === 'owner' || o.role === 'admin').map((o) => ({ id: o.id, name: o.name })); setOrgs(leads); if (leads[0]) setOrgId(leads[0].id); }); }, []);
  async function move() {
    if (!orgId) return;
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc('move_events_to_org', { p_org_id: orgId, p_event_ids: [eventId] });
    setBusy(false);
    if (error) return setErr(nice(error.message));
    onDone(orgs?.find((o) => o.id === orgId)?.name ?? 'the organization');
  }
  return (
    <Sheet title="Move to an organization" onClose={onClose}>
      <p className="-mt-2 text-sm text-gray-600">Host <strong>{eventTitle}</strong> as one of your organizations.</p>
      {orgs === null ? <p className="mt-4 text-sm text-gray-500">Loading…</p> : orgs.length === 0 ? (
        <p className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">You need to be an Owner or Admin of an organization to move events into it.</p>
      ) : (
        <>
          <label className="mt-3 block text-xs font-medium text-gray-500">Organization
            <select value={orgId} onChange={(e) => setOrgId(e.target.value)} className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 sm:text-sm">
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
          <div className="mt-4 rounded-xl bg-indigo-50 p-3"><p className="text-xs font-semibold text-indigo-900">What changes</p>{WHAT_CHANGES}</div>
          {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
          <button onClick={move} disabled={busy || !orgId} className="mt-4 w-full rounded-xl bg-[#0F1B3D] py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Moving…' : 'Move event'}</button>
        </>
      )}
    </Sheet>
  );
}
