import { useEffect, useState } from 'react';
import { ListSkeleton } from '../ui/Skeleton';
import { supabase } from '../../lib/supabaseClient';
import Sheet from './Sheet';

// Board owner: share this board with one of your organizations (its Owners, Admins and Editors
// can then see and add prospects), or keep it personal.
export default function BoardOrgSheet({ boardId, current, onClose, onSaved }: { boardId: string; current: string | null; onClose: () => void; onSaved: () => void }) {
  const [orgs, setOrgs] = useState<{ id: string; name: string; role: string; status?: string }[] | null>(null);
  const [choice, setChoice] = useState<string>(current ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    supabase.rpc('my_organizations').then(({ data }) => setOrgs(((data ?? []) as { id: string; name: string; role: string; status?: string }[]).filter((o) => o.status !== 'deleted' && ['owner', 'admin', 'editor'].includes(o.role))));
  }, []);
  async function save() {
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc('set_board_organization', { p_board_id: boardId, p_org_id: choice || null });
    setBusy(false);
    if (error) return setErr(error.message && !/function|permission denied/i.test(error.message) ? error.message : "Couldn't save.");
    onSaved();
  }
  return (
    <Sheet title="Share with an organization" onClose={onClose}>
      <p className="-mt-2 text-sm text-gray-600">Everyone on the organization's team who's an Owner, Admin or Editor can see this board and add prospects. People you invited to the board keep their access either way.</p>
      {orgs === null ? <ListSkeleton rows={3} className="mt-2" /> : (
        <div className="mt-3 flex flex-col gap-2">
          <label className={`flex min-h-[48px] items-center gap-3 rounded-xl border px-3 text-sm ${choice === '' ? 'border-marigold bg-marigold/5' : 'border-gray-200 bg-white'}`}>
            <input type="radio" checked={choice === ''} onChange={() => setChoice('')} className="h-4 w-4 accent-marigold" />
            <span><strong className="text-gray-900">Just me</strong><span className="block text-xs text-gray-500">Only you and people you invite</span></span>
          </label>
          {orgs.map((o) => (
            <label key={o.id} className={`flex min-h-[48px] items-center gap-3 rounded-xl border px-3 text-sm ${choice === o.id ? 'border-marigold bg-marigold/5' : 'border-gray-200 bg-white'}`}>
              <input type="radio" checked={choice === o.id} onChange={() => setChoice(o.id)} className="h-4 w-4 accent-marigold" />
              <span className="font-semibold text-gray-900">{o.name}</span>
            </label>
          ))}
          {orgs.length === 0 && <p className="text-sm text-gray-500">You're not an Owner, Admin or Editor of any organization yet.</p>}
        </div>
      )}
      {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
      <button onClick={save} disabled={busy || orgs === null} className="mt-4 w-full rounded-xl bg-marigold py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
    </Sheet>
  );
}
