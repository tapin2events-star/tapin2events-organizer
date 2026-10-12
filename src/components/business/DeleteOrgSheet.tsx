import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import Sheet from '../scouting/Sheet';

interface Blocker { event_id: string; title: string; start_date: string | null; tickets: number }
interface Summary { upcoming_events: number; past_events: number; followers: number; team: number; blockers: number }

// Owner: delete the organization (restorable for 30 days).
export default function DeleteOrgSheet({ orgId, orgName, onClose }: { orgId: string; orgName: string; onClose: () => void }) {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [blockers, setBlockers] = useState<Blocker[]>([]);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    Promise.all([supabase.rpc('org_delete_summary', { p_org_id: orgId }), supabase.rpc('org_delete_blockers', { p_org_id: orgId })]).then(([s, b]) => {
      setSummary((s.data as Summary) ?? null);
      setBlockers(((b.data ?? []) as Blocker[]).map((x) => ({ ...x, tickets: Number(x.tickets) })));
    });
  }, [orgId]);
  const matches = typed.trim().toLowerCase() === orgName.trim().toLowerCase();

  async function del() {
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc('delete_organization', { p_org_id: orgId, p_confirm_name: typed });
    setBusy(false);
    if (error) return setErr(error.message && !/function|permission denied/i.test(error.message) ? error.message : "Couldn't delete the organization.");
    navigate('/business', { replace: true });
  }

  return (
    <Sheet title={`Delete ${orgName}?`} onClose={onClose}>
      {summary === null ? <p className="text-sm text-gray-500">Checking…</p> : blockers.length > 0 ? (
        <>
          <p className="-mt-2 text-sm text-gray-700">These upcoming events have tickets or registrations. Cancel them (attendees are refunded) before deleting the organization, so nobody loses track of who's running their event.</p>
          <ul className="mt-3 flex flex-col gap-2">
            {blockers.map((b) => (
              <li key={b.event_id}><Link to={`/organizer/events/${b.event_id}`} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3 hover:border-gray-400">
                <span className="min-w-0"><span className="block truncate text-sm font-semibold text-gray-900">{b.title}</span><span className="text-xs text-gray-500">{b.start_date ? new Date(b.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''} · {b.tickets} sold</span></span>
                <span className="shrink-0 text-sm font-medium text-marigold">Open ›</span>
              </Link></li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <p className="-mt-2 text-sm text-gray-700">You'll have <strong>30 days to restore it</strong>. After that it's removed for good.</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-600">
            <li>The organization's page is hidden right away{summary.followers ? `, and its ${summary.followers} follower${summary.followers === 1 ? '' : 's'} won't be notified of events` : ''}.</li>
            {summary.upcoming_events > 0 && <li>{summary.upcoming_events} upcoming event{summary.upcoming_events === 1 ? '' : 's'} with no sales go back to drafts (restoring republishes them).</li>}
            {summary.past_events > 0 && <li>{summary.past_events} past event{summary.past_events === 1 ? '' : 's'} stay, so attendees keep their history.</li>}
            <li>Donation records and receipts are kept.</li>
            {summary.team > 1 && <li>Your {summary.team - 1} teammate{summary.team - 1 === 1 ? '' : 's'} will be notified.</li>}
          </ul>
          <label className="mt-4 block text-xs font-medium text-gray-500">Type <strong className="text-gray-800">{orgName}</strong> to confirm
            <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" className="mt-1 block w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900" />
          </label>
          {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
          <button onClick={del} disabled={!matches || busy} className="mt-4 w-full rounded-xl bg-red-600 py-3 text-sm font-bold text-white disabled:opacity-40">{busy ? 'Deleting…' : 'Delete organization'}</button>
        </>
      )}
    </Sheet>
  );
}
