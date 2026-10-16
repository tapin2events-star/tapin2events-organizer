import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Sheet from '../scouting/Sheet';

interface Item { id: string; thumbnail: string | null; caption: string | null; event_title: string | null; pinned: boolean; hidden: boolean; sort_order: number; auto: boolean }

// Organization settings > Page (Preview): curate "Highlights from past events": pin favorites (in order), hide clips,
// or add any of your videos. Unpinned clips from past events still fill in automatically.
export default function OrgReelManager({ orgId }: { orgId: string }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [cands, setCands] = useState<{ id: string; thumbnail: string | null; caption: string | null }[] | null>(null);
  const load = useCallback(async () => { const { data } = await supabase.rpc('org_reel_manage', { p_org_id: orgId }); setItems((data ?? []) as Item[]); }, [orgId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!adding) return;
    supabase.rpc('video_header_candidates', { p_event_id: null, p_org_id: orgId }).then(({ data }) => setCands((data ?? []) as typeof cands));
  }, [adding, orgId]); // eslint-disable-line react-hooks/exhaustive-deps
  async function set(id: string, patch: { pinned?: boolean; hidden?: boolean; sort?: number }) {
    await supabase.rpc('set_reel_item', { p_org_id: orgId, p_post_id: id, p_pinned: patch.pinned ?? null, p_hidden: patch.hidden ?? null, p_sort: patch.sort ?? null });
    load();
  }
  async function move(i: number, dir: -1 | 1) {
    const pinned = (items ?? []).filter((x) => x.pinned && !x.hidden);
    const j = i + dir;
    if (j < 0 || j >= pinned.length) return;
    await Promise.all([set(pinned[i].id, { sort: j + 1 }), set(pinned[j].id, { sort: i + 1 })]);
  }
  if (!items) return null;
  const pinned = items.filter((x) => x.pinned && !x.hidden);
  const auto = items.filter((x) => !x.pinned && !x.hidden);
  const hidden = items.filter((x) => x.hidden);
  const thumb = (x: { thumbnail: string | null }) => (x.thumbnail ? <img src={x.thumbnail} alt="" className="h-16 w-12 shrink-0 rounded-lg object-cover" /> : <span className="flex h-16 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-200">🎬</span>);
  return (
    <section className="mt-10 border-t border-gray-200 pt-8">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex flex-wrap items-center gap-2 font-display text-lg font-bold text-bone">🎞️ Highlights reel</h3>
          <p className="text-sm text-muted">Clips from your past events fill in automatically. Pin favorites to show them first, or hide any clip.</p>
        </div>
        <button onClick={() => setAdding(true)} className="rounded-xl bg-[#0F1B3D] px-3 py-2 text-sm font-semibold text-white">+ Add a video</button>
      </div>
      {items.length === 0 && <p className="mt-3 rounded-2xl border border-dashed border-gray-300 p-5 text-center text-sm text-muted">No clips yet. After your events, attendees and your team can share clips to them, and they'll show up here.</p>}
      {pinned.length > 0 && (
        <>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">📌 Pinned (shown first)</p>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {pinned.map((x, i) => (
              <li key={x.id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-surface p-2">
                {thumb(x)}<span className="min-w-0 flex-1"><span className="block truncate text-sm text-bone">{x.caption || 'Video'}</span><span className="block truncate text-xs text-muted">{x.event_title ?? ''}</span></span>
                <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="px-1.5 text-gray-500 disabled:opacity-30">↑</button>
                <button onClick={() => move(i, 1)} disabled={i === pinned.length - 1} aria-label="Move down" className="px-1.5 text-gray-500 disabled:opacity-30">↓</button>
                <button onClick={() => set(x.id, { pinned: false })} className="text-xs text-gray-500">Unpin</button>
              </li>
            ))}
          </ul>
        </>
      )}
      {auto.length > 0 && (
        <>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">From your past events (automatic)</p>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {auto.map((x) => (
              <li key={x.id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-surface p-2">
                {thumb(x)}<span className="min-w-0 flex-1"><span className="block truncate text-sm text-bone">{x.caption || 'Video'}</span><span className="block truncate text-xs text-muted">{x.event_title ?? ''}</span></span>
                <button onClick={() => set(x.id, { pinned: true })} className="text-xs font-medium text-marigold">📌 Pin</button>
                <button onClick={() => set(x.id, { hidden: true })} className="text-xs text-gray-500">Hide</button>
              </li>
            ))}
          </ul>
        </>
      )}
      {hidden.length > 0 && (
        <details className="mt-4"><summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted">Hidden ({hidden.length})</summary>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {hidden.map((x) => (
              <li key={x.id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-surface p-2 opacity-70">
                {thumb(x)}<span className="min-w-0 flex-1 truncate text-sm text-bone">{x.caption || 'Video'}</span>
                <button onClick={() => set(x.id, { hidden: false })} className="text-xs font-medium text-marigold">Show</button>
              </li>
            ))}
          </ul>
        </details>
      )}
      {adding && (
        <Sheet title="Add a video to your reel" onClose={() => setAdding(false)}>
          <p className="-mt-2 text-sm text-gray-600">Videos by your team and artists, or posted to your events. Added videos are pinned.</p>
          {cands === null ? <p className="mt-4 text-sm text-gray-500">Loading…</p> : cands.length === 0 ? <p className="mt-4 text-sm text-gray-500">No videos yet. Post one to the Feed first.</p> : (
            <ul className="mt-3 grid grid-cols-3 gap-2">
              {cands.map((c) => (
                <li key={c.id}><button onClick={async () => { await set(c.id, { pinned: true, hidden: false }); setAdding(false); }} className="block w-full overflow-hidden rounded-xl text-left">
                  {c.thumbnail ? <img src={c.thumbnail} alt="" className="aspect-[9/12] w-full object-cover" /> : <span className="flex aspect-[9/12] w-full items-center justify-center bg-gray-200">🎬</span>}
                  <span className="block truncate px-1 py-1 text-xs text-gray-700">{c.caption || 'Video'}</span>
                </button></li>
              ))}
            </ul>
          )}
        </Sheet>
      )}
    </section>
  );
}
