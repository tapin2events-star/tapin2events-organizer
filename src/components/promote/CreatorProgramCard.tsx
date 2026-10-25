import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { toast, toastError } from '../../lib/toast';
import PremiumBadge from '../business/PremiumBadge';


// Event Promote tab: the creator program. Creators who tag this event in their Feed videos earn a commission on
// tickets their videos sell (paid automatically from each sale). Free; requiring approval and custom rates per
// creator are in the Performers & Promotion pack.
interface Creator { link_id: string; name: string; photo: string | null; approval: 'approved' | 'pending' | 'declined'; pct: number; tickets: number; earned_cents: number }
export default function CreatorProgramCard({ eventId }: { eventId: string }) {
  const [pct, setPct] = useState<number | null | undefined>(undefined);
  const [approval, setApproval] = useState(false);
  const [draft, setDraft] = useState('10');
  const [creators, setCreators] = useState<Creator[]>([]);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const [{ data: ev }, { data: list }] = await Promise.all([
      supabase.from('events').select('creator_commission_pct, creator_approval').eq('id', eventId).maybeSingle(),
      supabase.rpc('event_creators', { p_event_id: eventId }),
    ]);
    const p = ev?.creator_commission_pct == null ? null : Number(ev.creator_commission_pct);
    setPct(p); setApproval(!!ev?.creator_approval); if (p) setDraft(String(p));
    setCreators((list ?? []) as Creator[]);
  }, [eventId]);
  useEffect(() => { load(); }, [load]);
  async function save(nextPct: number | null, nextApproval = approval) {
    setBusy(true);
    const { error } = await supabase.rpc('set_creator_program', { p_event_id: eventId, p_pct: nextPct, p_approval: nextApproval });
    setBusy(false);
    if (error) return toastError(error.message);
    toast(nextPct ? `✓ Creators earn ${nextPct}% on tickets their videos sell` : 'Creator program turned off');
    load();
  }
  async function review(c: Creator, approve: boolean) {
    const { error } = await supabase.rpc('review_creator_link', { p_link_id: c.link_id, p_approve: approve });
    if (error) return toastError(error.message);
    toast(approve ? `✓ ${c.name} approved` : `${c.name} declined`); load();
  }
  if (pct === undefined) return null;
  const on = pct !== null;
  return (
    <section className="mb-6 rounded-2xl border border-gray-200 bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-lg font-bold text-bone">🎬 Creator program</p>
          <p className="mt-0.5 text-sm text-muted">Pay creators a commission when their Feed videos sell tickets. They tag your event, and a Get tickets button on their video carries their code. Commissions come out of each sale automatically.</p>
        </div>
        <button role="switch" aria-checked={on} aria-label="Creator program" disabled={busy} onClick={() => save(on ? null : Math.min(50, Math.max(1, Number(draft) || 10)))}
          className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition ${on ? 'bg-marigold' : 'bg-gray-300'}`}>
          <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${on ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      </div>
      {on && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-gray-700">
            <span>Creators earn</span>
            <input type="number" min={1} max={50} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Commission percent"
              className="w-20 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-base text-gray-900 sm:text-sm" />
            <span>% of each ticket their videos sell</span>
            {Number(draft) !== pct && <button onClick={() => save(Math.min(50, Math.max(1, Number(draft) || 10)))} disabled={busy} className="rounded-lg bg-[#0F1B3D] px-3 py-1.5 text-xs font-semibold text-white">Save</button>}
          </div>
          <label className="mt-3 flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={approval} onChange={(e) => save(pct, e.target.checked)} className="mt-0.5 h-4 w-4 accent-marigold" />
            <span>Approve each creator first <PremiumBadge feature="creator_controls" /><span className="block text-xs text-gray-500">Otherwise anyone can promote it and start earning right away.</span></span>
          </label>
          <div className="mt-4">
            <p className="text-sm font-semibold text-bone">Creators {creators.length > 0 && <span className="font-normal text-muted">· {creators.filter((c) => c.approval === 'approved').length} promoting</span>}</p>
            {creators.length === 0 ? <p className="mt-1 text-sm text-muted">No creators yet. They&apos;ll see your event under &quot;Events paying creators&quot; when they post a video.</p> : (
              <ul className="mt-2 flex flex-col gap-2">
                {creators.map((c) => (
                  <li key={c.link_id} className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-2.5">
                    {c.photo ? <img src={c.photo} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-200 text-sm font-bold text-gray-600">{c.name.charAt(0)}</span>}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-gray-900">{c.name}</span>
                      <span className="block text-xs text-gray-500">{c.tickets} ticket{c.tickets === 1 ? '' : 's'} · ${(c.earned_cents / 100).toFixed(2)} earned · {c.pct}%</span>
                    </span>
                    {c.approval === 'pending' ? (
                      <span className="flex gap-2">
                        <button onClick={() => review(c, true)} className="min-h-[36px] rounded-lg bg-marigold px-3 text-xs font-semibold text-white">Approve</button>
                        <button onClick={() => review(c, false)} className="min-h-[36px] rounded-lg border border-gray-300 px-3 text-xs text-gray-700">Decline</button>
                      </span>
                    ) : <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${c.approval === 'approved' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{c.approval === 'approved' ? 'Promoting' : 'Declined'}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
