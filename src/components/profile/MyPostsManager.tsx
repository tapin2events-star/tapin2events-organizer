import { useState, type Dispatch, type SetStateAction } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import EditPostModal from '../feed/EditPostModal';
import { useEscapeKey } from '../../lib/useEscapeKey';

export interface ProfilePost {
  id: string;
  thumbnail_url: string | null;
  caption: string | null;
}

const plural = (n: number) => `${n} video${n === 1 ? '' : 's'}`;

function Thumb({ post, className }: { post: ProfilePost; className: string }) {
  return post.thumbnail_url ? (
    <img src={post.thumbnail_url} alt="" className={`${className} object-cover`} />
  ) : (
    <div className={`${className} flex items-center justify-center bg-gray-100 text-lg`}>🎥</div>
  );
}

const rowBtn = 'flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left text-base font-medium hover:bg-gray-50';

// Your own videos on your profile. Tap ⋯ on one for Edit / View / Delete, or
// use Select to tick several and delete them together.
export default function MyPostsManager({ posts, onPostsChange }: { posts: ProfilePost[]; onPostsChange: Dispatch<SetStateAction<ProfilePost[]>> }) {
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Snapshot of what's being deleted, so the confirmation doesn't shrink as each one is removed.
  const [confirmItems, setConfirmItems] = useState<ProfilePost[] | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sheetPost = posts.find((p) => p.id === sheetId) ?? null;
  const busy = progress !== null;

  useEscapeKey(() => setSheetId(null), !!sheetId);
  useEscapeKey(() => { if (!busy) setConfirmItems(null); }, !!confirmItems);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function exitSelect() {
    setSelectMode(false);
    setSelected(new Set());
  }

  async function refreshCaption(id: string) {
    const { data } = await supabase.from('posts').select('caption').eq('id', id).maybeSingle();
    if (data) onPostsChange((prev) => prev.map((p) => (p.id === id ? { ...p, caption: data.caption as string | null } : p)));
  }

  // Same server-side delete the feed uses (video, thumbnail, likes and
  // comments together). One at a time; each disappears from the grid as it goes.
  async function runDelete(items: ProfilePost[]) {
    setError(null);
    setProgress({ done: 0, total: items.length });
    const failed: string[] = [];
    for (let i = 0; i < items.length; i++) {
      const id = items[i].id;
      const { data, error: err } = await supabase.functions.invoke('delete-post', { body: { post_id: id } });
      if (err || !data?.success) failed.push(id);
      else onPostsChange((prev) => prev.filter((p) => p.id !== id));
      setProgress({ done: i + 1, total: items.length });
    }
    setProgress(null);
    setConfirmItems(null);
    if (failed.length > 0) {
      setError(`${plural(failed.length)} couldn't be deleted. Please try again.`);
      if (selectMode) setSelected(new Set(failed));
    } else if (selectMode) {
      exitSelect();
    }
  }

  const allSelected = selected.size === posts.length;

  return (
    <div className="mt-3">
      <div className="mb-2 flex min-h-[2.75rem] items-center justify-between gap-2">
        {selectMode ? (
          <>
            <p className="text-sm font-medium text-gray-700">{selected.size === 0 ? 'Tap videos to select them' : `${selected.size} selected`}</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setSelected(allSelected ? new Set() : new Set(posts.map((p) => p.id)))} className="rounded-lg px-3 py-2.5 text-sm font-medium text-marigold hover:bg-indigo-50">
                {allSelected ? 'Clear' : 'Select all'}
              </button>
              <button type="button" onClick={exitSelect} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-800 hover:border-marigold">Done</button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-gray-500">Tap <span className="font-bold">⋯</span> on a video to edit or delete it.</p>
            <button type="button" onClick={() => { setSelectMode(true); setError(null); }} className="shrink-0 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-800 hover:border-marigold hover:text-marigold">
              Select
            </button>
          </>
        )}
      </div>

      {error && <p role="alert" className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className={`grid grid-cols-3 gap-1 ${selectMode && selected.size > 0 ? 'pb-20' : ''}`}>
        {posts.map((post) => {
          const label = post.caption?.trim() ? `: ${post.caption.trim().slice(0, 60)}` : '';
          if (selectMode) {
            const on = selected.has(post.id);
            return (
              <button key={post.id} type="button" onClick={() => toggle(post.id)} aria-pressed={on} aria-label={`${on ? 'Deselect' : 'Select'} video${label}`} className="relative block aspect-[9/16] w-full overflow-hidden rounded-lg bg-gray-100">
                <Thumb post={post} className="h-full w-full" />
                <span className={`absolute inset-0 rounded-lg ${on ? 'bg-marigold/20 ring-4 ring-inset ring-marigold' : ''}`} />
                <span className={`absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-bold ${on ? 'border-marigold bg-marigold text-white' : 'border-white bg-black/30 text-transparent'}`}>✓</span>
              </button>
            );
          }
          return (
            <div key={post.id} className="relative">
              <Link to={`/feed?post=${post.id}`} aria-label={`Open video${label}`} className="block aspect-[9/16] overflow-hidden rounded-lg bg-gray-100">
                <Thumb post={post} className="h-full w-full" />
              </Link>
              <button type="button" onClick={() => setSheetId(post.id)} aria-label={`Edit or delete this video${label}`} className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {selectMode && selected.size > 0 && (
        <div className="sticky bottom-24 z-20 mt-3 md:bottom-4">
          <button type="button" onClick={() => setConfirmItems(posts.filter((p) => selected.has(p.id)))} className="w-full rounded-xl bg-magenta px-4 py-3.5 text-base font-semibold text-white shadow-lg hover:bg-red-700">
            Delete {plural(selected.size)}
          </button>
        </div>
      )}

      {sheetPost && (
        <div className="fixed inset-0 z-[1150] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={() => setSheetId(null)}>
          <div role="dialog" aria-modal="true" aria-label="Video options" className="w-full max-w-sm rounded-t-2xl bg-white p-4 pb-6 shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
              <Thumb post={sheetPost} className="h-[4.5rem] w-10 shrink-0 rounded-md" />
              <p className="line-clamp-2 min-w-0 text-sm text-gray-700">{sheetPost.caption?.trim() || 'No caption'}</p>
            </div>
            <div className="mt-2 flex flex-col">
              <button type="button" onClick={() => { setEditingId(sheetPost.id); setSheetId(null); }} className={`${rowBtn} text-gray-900`}>
                <span aria-hidden>✏️</span> Edit caption, tags &amp; more
              </button>
              <Link to={`/feed?post=${sheetPost.id}`} className={`${rowBtn} text-gray-900`}>
                <span aria-hidden>▶️</span> View in feed
              </Link>
              <button type="button" onClick={() => { setConfirmItems([sheetPost]); setSheetId(null); }} className={`${rowBtn} text-red-600 hover:bg-red-50`}>
                <span aria-hidden>🗑️</span> Delete video
              </button>
            </div>
            <button type="button" onClick={() => setSheetId(null)} className="mt-2 w-full rounded-xl bg-gray-100 py-3.5 text-base font-semibold text-gray-800 hover:bg-gray-200">Cancel</button>
          </div>
        </div>
      )}

      {confirmItems && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/60 p-4" onClick={() => { if (!busy) setConfirmItems(null); }}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="delete-videos-title" className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p id="delete-videos-title" className="font-display text-lg font-bold text-gray-900">{confirmItems.length === 1 ? 'Delete this video?' : `Delete ${confirmItems.length} videos?`}</p>
            <div className="mt-3 flex items-center gap-1.5">
              {confirmItems.slice(0, 5).map((p) => <Thumb key={p.id} post={p} className="h-16 w-9 shrink-0 rounded" />)}
              {confirmItems.length > 5 && <span className="px-1 text-sm text-gray-500">+{confirmItems.length - 5} more</span>}
            </div>
            <p className="mt-3 text-sm text-gray-600">
              This permanently removes {confirmItems.length === 1 ? 'the video' : 'these videos'} along with {confirmItems.length === 1 ? 'its' : 'their'} likes and comments. This can't be undone.
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setConfirmItems(null)} disabled={busy} className="rounded-xl bg-gray-100 px-5 py-3 text-base font-semibold text-gray-800 hover:bg-gray-200 disabled:opacity-50">Cancel</button>
              <button type="button" onClick={() => runDelete(confirmItems)} disabled={busy} className="rounded-xl bg-magenta px-5 py-3 text-base font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                {progress ? (progress.total === 1 ? 'Deleting…' : `Deleting ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…`) : confirmItems.length === 1 ? 'Delete video' : `Delete ${confirmItems.length} videos`}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingId && <EditPostModal postId={editingId} onClose={() => setEditingId(null)} onSaved={() => refreshCaption(editingId)} />}
    </div>
  );
}
