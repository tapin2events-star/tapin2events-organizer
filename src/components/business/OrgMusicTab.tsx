import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import MusicManager from '../music/MusicManager';
import GroupSongRequests from '../groups/GroupSongRequests';
import { toast, toastError } from '../../lib/toast';

// Organization → Music (preview): the organization's songs and albums (managed by its owner and admins), team members'
// songs waiting for approval, and splits (specific people get a share of music sales and donations; the rest goes to
// the organization's payout account, held until it's connected).
interface Split { email: string; percent: number; label: string | null; name?: string | null; connected?: boolean }
export default function OrgMusicTab({ orgId, orgName }: { orgId: string; orgName: string }) {
  const [rid, setRid] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [splits, setSplits] = useState<Split[] | null>(null);
  const [draft, setDraft] = useState<{ email: string; percent: string; label: string }>({ email: '', percent: '', label: '' });
  useEffect(() => {
    supabase.rpc('org_music_resource', { p_org_id: orgId }).then(({ data, error }) => { if (error) setErr(error.message); else setRid(data as string); });
    supabase.rpc('org_music_splits_get', { p_org_id: orgId }).then(({ data }) => setSplits((data ?? []) as Split[]));
  }, [orgId]);
  async function saveSplits(next: Split[]) {
    const { error } = await supabase.rpc('org_music_splits_set', { p_org_id: orgId, p_splits: next.map((s) => ({ email: s.email, percent: s.percent, label: s.label })) });
    if (error) return toastError(error.message);
    const { data } = await supabase.rpc('org_music_splits_get', { p_org_id: orgId });
    setSplits((data ?? []) as Split[]); toast('Splits saved');
  }
  const total = (splits ?? []).reduce((n, s) => n + Number(s.percent), 0);
  if (err) return <p role="alert" className="text-sm text-red-600">{err}</p>;
  if (!rid) return <p className="text-sm text-gray-500">Loading…</p>;
  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
        <h2 className="font-display text-lg font-semibold text-gray-900">🎵 {orgName}&apos;s music</h2>
        <p className="mt-1 text-xs text-gray-500">Albums and songs play on your organization&apos;s page, and can be free, paid or donation-based. Money goes to the organization&apos;s payout account (held until it&apos;s connected), minus any splits below.</p>
        <MusicManager resourceId={rid} v2 />
      </section>
      <GroupSongRequests groupId={rid} />
      <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
        <h2 className="font-display text-lg font-semibold text-gray-900">💸 Split music earnings</h2>
        <p className="mt-1 text-xs text-gray-500">Give specific people a share of every music sale and donation (for example, the poets on an album). The rest goes to the organization. Each person is paid to their own payout account, or their share is held until they connect.</p>
        {splits && splits.length > 0 && (
          <ul className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-200">
            {splits.map((s) => (
              <li key={s.email} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate"><span className="font-medium text-gray-900">{s.name || s.label || s.email}</span>{s.name || s.label ? <span className="text-gray-500"> · {s.email}</span> : null}
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.connected ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>{s.connected ? 'Payouts connected' : 'Share held until connected'}</span></span>
                <span className="font-semibold text-gray-900">{Number(s.percent)}%</span>
                <button onClick={() => saveSplits(splits.filter((x) => x.email !== s.email))} aria-label={`Remove ${s.email}`} className="text-xs font-medium text-red-600">Remove</button>
              </li>
            ))}
            <li className="px-3 py-2 text-xs text-gray-600">{total}% to people · {Math.max(0, 100 - total)}% to {orgName}</li>
          </ul>
        )}
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_80px_1fr_auto]">
          <input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="Their email" inputMode="email" aria-label="Email" className="min-h-[44px] rounded-xl border border-gray-300 px-3 text-base text-gray-900 sm:text-sm" />
          <input value={draft.percent} onChange={(e) => setDraft({ ...draft, percent: e.target.value.replace(/[^0-9.]/g, '') })} placeholder="%" inputMode="decimal" aria-label="Percent" className="min-h-[44px] rounded-xl border border-gray-300 px-3 text-base text-gray-900 sm:text-sm" />
          <input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="Name (optional)" aria-label="Name" className="min-h-[44px] rounded-xl border border-gray-300 px-3 text-base text-gray-900 sm:text-sm" />
          <button onClick={() => { const pct = Number(draft.percent); if (!draft.email.trim() || !(pct > 0)) return toastError('Enter an email and a percent.'); if (total + pct > 100) return toastError('Shares add up to more than 100%.');
            saveSplits([...(splits ?? []).filter((s) => s.email !== draft.email.trim().toLowerCase()), { email: draft.email.trim().toLowerCase(), percent: pct, label: draft.label.trim() || null }]); setDraft({ email: '', percent: '', label: '' }); }}
            className="min-h-[44px] rounded-xl bg-[#0F1B3D] px-4 text-sm font-semibold text-white">Add</button>
        </div>
      </section>
    </div>
  );
}
