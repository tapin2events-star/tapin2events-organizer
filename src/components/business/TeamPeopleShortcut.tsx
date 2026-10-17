import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

interface Row { email: string; name: string; photo: string | null; role: string; featured: boolean }

// Organization settings > Team: feature team members on the public page in one tap (adds them to Featured people
// on the Page tab, as their artist profile if they have one).
export default function TeamPeopleShortcut({ orgId, onManage }: { orgId: string; onManage: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(async () => { const { data } = await supabase.rpc('team_people_status', { p_org_id: orgId }); setRows((data ?? []) as Row[]); }, [orgId]);
  useEffect(() => { load(); }, [load]);
  if (!rows || rows.length === 0) return null;
  const featured = rows.filter((r) => r.featured).length;
  async function add() {
    if (!pick.length) return;
    setMsg(null);
    const { data, error } = await supabase.rpc('add_team_to_people', { p_org_id: orgId, p_emails: pick });
    if (error) return setMsg({ ok: false, text: error.message && !/function|permission/i.test(error.message) ? error.message : "Couldn't add them." });
    const n = Number(data);
    setMsg({ ok: true, text: n ? `Added ${n} to Featured people on your page.` : 'They were already featured.' });
    setPick([]); load();
  }
  return (
    <section className="mb-4 rounded-2xl border border-gray-200 bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-bone">🌟 Show team members on your page</p>
          <p className="text-sm text-muted">Feature your team in the Featured people section of your public page.{featured ? ` ${featured} of ${rows.length} already featured.` : ''} Featuring someone doesn't change what they can manage.</p>
        </div>
        <button onClick={() => setOpen(!open)} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700">{open ? 'Close' : 'Choose people'}</button>
      </div>
      {open && (
        <>
          <ul className="mt-3 flex flex-col gap-1.5">
            {rows.map((r) => (
              <li key={r.email}>
                <label className={`flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm ${r.featured ? 'opacity-60' : 'cursor-pointer'}`}>
                  <input type="checkbox" disabled={r.featured} checked={r.featured || pick.includes(r.email)} onChange={(e) => setPick((x) => (e.target.checked ? [...x, r.email] : x.filter((y) => y !== r.email)))} className="h-4 w-4 accent-marigold" />
                  {r.photo ? <img src={r.photo} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600">{r.name.charAt(0)}</span>}
                  <span className="min-w-0 flex-1 truncate font-medium text-gray-900">{r.name}</span>
                  <span className="shrink-0 text-xs text-gray-500">{r.featured ? '✓ Featured' : r.role}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button onClick={add} disabled={!pick.length} className="rounded-xl bg-[#0F1B3D] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Add {pick.length || ''} to Featured people</button>
            <button onClick={onManage} className="text-sm font-medium text-marigold">Manage Featured people ›</button>
          </div>
        </>
      )}
      {msg && <p role="status" className={`mt-3 rounded-xl px-3 py-2 text-sm ${msg.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{msg.text}</p>}
    </section>
  );
}
