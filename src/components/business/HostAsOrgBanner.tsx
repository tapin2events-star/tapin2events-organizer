import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { loadMyOrgs, type MyOrg } from '../../lib/business';
import { toast, toastError } from '../../lib/toast';

// Event dashboard, once per event: a personal event whose organizer owns or manages organizations (and that wasn't
// deliberately kept personal, and has no sales yet) gets a friendly "Host this as <organization>?" offer.
export default function HostAsOrgBanner({ eventId, onMoved }: { eventId: string; onMoved: () => void }) {
  const [orgs, setOrgs] = useState<MyOrg[] | null>(null);
  const [pick, setPick] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [gone, setGone] = useState(false);
  useEffect(() => { loadMyOrgs().then((all) => { const mine = all.filter((o) => o.role === 'owner' || o.role === 'admin'); setOrgs(mine); if (mine[0]) setPick(mine[0].id); }); }, []);
  if (gone || !orgs || orgs.length === 0) return null;
  const chosen = orgs.find((o) => o.id === pick) ?? orgs[0];
  async function move() {
    setBusy(true);
    const { error } = await supabase.rpc('move_events_to_org', { p_org_id: chosen.id, p_event_ids: [eventId] });
    setBusy(false);
    if (error) return toastError(error.message);
    toast(`✓ Now hosted by ${chosen.name}`); setGone(true); onMoved();
  }
  async function keep() {
    setBusy(true);
    const { error } = await supabase.from('events').update({ keep_personal: true }).eq('id', eventId);
    setBusy(false);
    if (error) return toastError();
    setGone(true);
  }
  return (
    <div className="mb-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
      <div className="flex items-start gap-3">
        {chosen.logo_url ? <img src={chosen.logo_url} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-xl" aria-hidden="true">🏢</span>}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900">Host this as {orgs.length === 1 ? chosen.name : 'one of your organizations'}?</p>
          <p className="mt-0.5 text-sm text-gray-700">It&apos;ll appear on the organization&apos;s page, its followers get notified, and your team can help manage it.</p>
          {orgs.length > 1 && (
            <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Organization" className="mt-2 w-full rounded-xl border border-indigo-200 bg-white px-3 py-2 text-base text-gray-900 sm:text-sm">
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={move} disabled={busy} className="min-h-[44px] rounded-xl bg-[#0F1B3D] px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Moving…' : `Add to ${chosen.name}`}</button>
            <button onClick={keep} disabled={busy} className="min-h-[44px] rounded-xl border border-indigo-200 bg-white px-4 text-sm font-semibold text-gray-700">Keep it personal</button>
          </div>
        </div>
      </div>
    </div>
  );
}
