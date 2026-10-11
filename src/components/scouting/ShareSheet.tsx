import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import Sheet from './Sheet';

interface Person { email: string; full_name: string | null; profile_photo: string | null }
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
const LINK_BASE = `${window.location.origin}${import.meta.env.BASE_URL}scout/`;

// Planners (TapIN users or anyone by email) and a view-only link.
export default function ShareSheet({ boardId, boardName, isOwner, members, onClose, onChanged, onLeft }: {
  boardId: string; boardName: string; isOwner: boolean; members: Person[]; onClose: () => void; onChanged: () => void; onLeft: () => void;
}) {
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Person[]>([]);
  const [invites, setInvites] = useState<{ email: string; accepted_at: string | null }[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [link, setLink] = useState<{ token: string | null; notes: boolean; expires: string | null } | null>(null);
  const [copied, setCopied] = useState(false);

  const loadExtras = async () => {
    const [{ data: inv }, { data: b }] = await Promise.all([
      supabase.from('scout_board_invites').select('email, accepted_at').eq('board_id', boardId).is('accepted_at', null).order('created_at'),
      supabase.from('scout_boards').select('share_token, share_notes, share_expires_at').eq('id', boardId).maybeSingle(),
    ]);
    setInvites((inv ?? []) as { email: string; accepted_at: string | null }[]);
    setLink({ token: b?.share_token ?? null, notes: !!b?.share_notes, expires: b?.share_expires_at ?? null });
  };
  useEffect(() => { loadExtras(); }, [boardId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isOwner || q.trim().length < 2) { setResults([]); return; }
    const t = window.setTimeout(async () => {
      const { data } = await supabase.rpc('search_people', { p_query: q.trim() });
      const taken = new Set(members.map((m) => m.email.toLowerCase()));
      setResults(((data ?? []) as Person[]).filter((p) => !taken.has(p.email.toLowerCase())).slice(0, 5));
    }, 250);
    return () => window.clearTimeout(t);
  }, [q, members, isOwner]);

  async function invite(email: string) {
    setMsg(null);
    const { data, error } = await supabase.rpc('invite_to_scout_board', { p_board: boardId, p_email: email });
    if (error) return setMsg({ ok: false, text: error.message && !/function|permission/i.test(error.message) ? error.message : "Couldn't add them. Please try again." });
    setMsg({ ok: true, text: data === 'invited' ? `Invite emailed to ${email}. They'll join as soon as they sign up.` : data === 'already' ? 'They\u2019re already a planner.' : 'Added. They\u2019ll get a notification.' });
    setQ(''); setResults([]); onChanged(); loadExtras();
  }
  async function removeMember(email: string) {
    await supabase.from('scout_board_members').delete().eq('board_id', boardId).eq('user_email', email);
    if (email === user?.email) { onLeft(); return; }
    onChanged();
  }
  async function cancelInvite(email: string) {
    await supabase.from('scout_board_invites').delete().eq('board_id', boardId).eq('email', email);
    loadExtras();
  }
  async function setShare(enabled: boolean, notes = link?.notes ?? false, days: number | null = null) {
    const { error } = await supabase.rpc('set_scout_share', { p_board: boardId, p_enabled: enabled, p_include_notes: notes, p_expires_days: days });
    if (!error) loadExtras();
  }
  async function copy(url: string) {
    try { await navigator.clipboard.writeText(url); } catch { /* the link is still shown for copying by hand */ }
    setCopied(true); window.setTimeout(() => setCopied(false), 2000);
  }

  const typedEmail = EMAIL_RE.test(q.trim()) ? q.trim().toLowerCase() : null;
  const url = link?.token ? LINK_BASE + link.token : null;

  return (
    <Sheet title={`Share "${boardName}"`} onClose={onClose} wide>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Planners</p>
      <p className="mt-1 text-xs text-gray-500">Planners can add artists, move them along, and edit notes.</p>
      {isOwner && (
        <div className="mt-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or email address" className="w-full rounded-xl border border-gray-300 px-3 py-3 text-base text-gray-900" aria-label="Add a planner" />
          {(results.length > 0 || typedEmail) && (
            <ul className="mt-2 divide-y divide-gray-100 rounded-xl border border-gray-200">
              {results.map((p) => (
                <li key={p.email} className="flex items-center gap-3 p-2.5">
                  {p.profile_photo ? <img src={p.profile_photo} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600">{(p.full_name || '?').charAt(0)}</span>}
                  <span className="min-w-0 flex-1 truncate text-sm text-gray-900">{p.full_name || 'TapIN member'}</span>
                  <button onClick={() => invite(p.email)} className="rounded-lg bg-marigold px-3 py-1.5 text-xs font-semibold text-white">Add</button>
                </li>
              ))}
              {typedEmail && !results.some((r) => r.email.toLowerCase() === typedEmail) && (
                <li className="flex items-center gap-3 p-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs text-indigo-700">✉</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-gray-900">{typedEmail}</span>
                  <button onClick={() => invite(typedEmail)} className="rounded-lg bg-marigold px-3 py-1.5 text-xs font-semibold text-white">Invite</button>
                </li>
              )}
            </ul>
          )}
          <p className="mt-1.5 text-xs text-gray-400">Not on TapIN? Type their email and we'll invite them.</p>
        </div>
      )}
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`mt-2 text-sm ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</p>}
      <ul className="mt-3 flex flex-col">
        {members.map((p, i) => (
          <li key={p.email} className="flex items-center gap-3 py-2">
            {p.profile_photo ? <img src={p.profile_photo} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600">{(p.full_name || p.email).charAt(0).toUpperCase()}</span>}
            <span className="min-w-0 flex-1 truncate text-sm text-gray-900">{p.full_name || p.email}{i === 0 ? <span className="text-gray-400"> · owner</span> : null}{p.email === user?.email ? <span className="text-gray-400"> (you)</span> : null}</span>
            {i > 0 && (isOwner || p.email === user?.email) && <button onClick={() => removeMember(p.email)} className="text-xs text-gray-400 hover:text-red-600">{p.email === user?.email ? 'Leave' : 'Remove'}</button>}
          </li>
        ))}
        {invites.map((iv) => (
          <li key={iv.email} className="flex items-center gap-3 py-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-xs text-indigo-600">✉</span>
            <span className="min-w-0 flex-1 truncate text-sm text-gray-600">{iv.email} <span className="text-gray-400">· invited</span></span>
            {isOwner && <button onClick={() => cancelInvite(iv.email)} className="text-xs text-gray-400 hover:text-red-600">Cancel</button>}
          </li>
        ))}
      </ul>

      {isOwner && link && (
        <div className="mt-5 border-t border-gray-100 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">View-only link</p>
              <p className="mt-1 text-xs text-gray-500">Anyone with the link can see the board (no account needed) but can't change anything.</p>
            </div>
            <button type="button" role="switch" aria-checked={!!url} aria-label="View-only link" onClick={() => setShare(!url, false, 30)}
              className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition ${url ? 'bg-marigold' : 'bg-gray-300'}`}>
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${url ? 'left-6' : 'left-1'}`} />
            </button>
          </div>
          {url && (
            <div className="mt-3 flex flex-col gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-2">
                <span className="min-w-0 flex-1 truncate px-1 text-xs text-gray-600">{url}</span>
                <button onClick={() => copy(url)} className="shrink-0 rounded-lg bg-marigold px-3 py-1.5 text-xs font-semibold text-white">{copied ? 'Copied!' : 'Copy'}</button>
              </div>
              <label className="flex items-start gap-2.5 text-sm text-gray-700">
                <input type="checkbox" checked={link.notes} onChange={(e) => setShare(true, e.target.checked, link.expires ? Math.max(1, Math.round((new Date(link.expires).getTime() - Date.now()) / 86400000)) : null)} className="mt-0.5 h-4 w-4 accent-marigold" />
                <span>Include notes<span className="block text-xs text-gray-500">Off by default. Notes often have contact info or candid thoughts.</span></span>
              </label>
              <label className="text-xs font-medium text-gray-500">Link works for
                <select value={link.expires ? 'limited' : 'never'} onChange={(e) => setShare(true, link.notes, e.target.value === 'never' ? null : Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900">
                  {link.expires && <option value="limited">Until {new Date(link.expires).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</option>}
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                  <option value="never">No expiration</option>
                </select>
              </label>
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">Heads up: links can be forwarded, so artists could end up seeing this board. Turn the link off anytime and it stops working right away.</p>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
