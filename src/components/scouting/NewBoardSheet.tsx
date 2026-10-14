import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import Sheet from './Sheet';

// Create a scouting board from Planning: a name, and optionally share it with one of your organizations.
export default function NewBoardSheet({ orgs, defaultOrgId = '', onClose }: { orgs: { id: string; name: string; role: string }[]; defaultOrgId?: string; onClose: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const shareable = orgs.filter((o) => ['owner', 'admin', 'editor'].includes(o.role));
  const [name, setName] = useState('');
  const [orgId, setOrgId] = useState(shareable.some((o) => o.id === defaultOrgId) ? defaultOrgId : '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function create() {
    if (!user?.email) return;
    if (!name.trim()) return setErr('Give the board a name, like "Spring showcase talent".');
    setBusy(true); setErr(null);
    const { data, error } = await supabase.from('scout_boards').insert({ owner_email: user.email, name: name.trim().slice(0, 100) }).select('id').single();
    if (error || !data) { setBusy(false); return setErr("Couldn't create the board."); }
    if (orgId) await supabase.rpc('set_board_organization', { p_board_id: data.id, p_org_id: orgId });
    navigate(`/organizer/scouting/${data.id}`);
  }
  return (
    <Sheet title="New scouting board" onClose={onClose}>
      <label className="block text-xs font-medium text-gray-500">Board name
        <input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder="Spring showcase talent" autoFocus
          className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900" />
      </label>
      {shareable.length > 0 && (
        <label className="mt-3 block text-xs font-medium text-gray-500">Share with
          <select value={orgId} onChange={(e) => setOrgId(e.target.value)} className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900">
            <option value="">Just me (invite people later)</option>
            {shareable.map((o) => <option key={o.id} value={o.id}>{o.name} team</option>)}
          </select>
          {orgId && <span className="mt-1 block font-normal text-gray-500">The organization's Owners, Admins and Editors can see it and add artists.</span>}
        </label>
      )}
      {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
      <button onClick={create} disabled={busy} className="mt-4 w-full rounded-xl bg-marigold py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Creating…' : 'Create board'}</button>
    </Sheet>
  );
}
