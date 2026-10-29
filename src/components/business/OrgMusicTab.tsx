import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import MusicManager from '../music/MusicManager';
import GroupSongRequests from '../groups/GroupSongRequests';
import { toast, toastError } from '../../lib/toast';

// Organization → Music (preview): the organization's songs and albums (managed by its owner and admins), team members'
// songs waiting for approval, and splits (specific people get a share of music sales and donations; the rest goes to
// the organization's payout account, held until it's connected).
interface Split { key: string; percent: number; label: string | null; name?: string | null; photo?: string | null; on_tapin?: boolean; email_hint?: string; connected?: boolean }
interface Person { id: string; full_name: string; profile_photo: string | null }
export default function OrgMusicTab({ orgId, orgName }: { orgId: string; orgName: string }) {
  const [rid, setRid] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [splits, setSplits] = useState<Split[] | null>(null);
  const [draft, setDraft] = useState<{ q: string; percent: string; label: string }>({ q: '', percent: '', label: '' });
  // Pick a TapIN user by name (their email stays private), or type an email.
  const [results, setResults] = useState<Person[]>([]);
  const [picked, setPicked] = useState<Person | null>(null);
  useEffect(() => {
    const q = draft.q.trim();
    if (picked || q.length < 2 || q.includes('@')) { setResults([]); return; }
    const t = setTimeout(() => { supabase.rpc('search_people_for_splits', { p_query: q }).then(({ data }) => setResults(((data ?? []) as Person[]).slice(0, 6))); }, 250);
    return () => clearTimeout(t);
  }, [draft.q, picked]);
  useEffect(() => {
    supabase.rpc('org_music_resource', { p_org_id: orgId }).then(({ data, error }) => { if (error) setErr(error.message); else setRid(data as string); });
    supabase.rpc('org_music_splits_get', { p_org_id: orgId }).then(({ data }) => setSplits((data ?? []) as Split[]));
  }, [orgId]);
  async function saveSplits(next: Split[]) {
    const { error } = await supabase.rpc('org_music_splits_set', { p_org_id: orgId, p_splits: next });
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
              <li key={s.key} className="flex items-center gap-3 px-3 py-2 text-sm">
                {s.photo ? <img src={s.photo} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" /> : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">{(s.name || s.email_hint || '?').charAt(0).toUpperCase()}</span>}
                <span className="min-w-0 flex-1 truncate"><span className="font-medium text-gray-900">{s.name || s.email_hint}</span>{s.name ? <span className="text-gray-500"> · {s.on_tapin ? 'TapIN member' : s.email_hint}</span> : null}
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.connected ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>{s.connected ? 'Payouts connected' : 'Share held until connected'}</span></span>
                <span className="font-semibold text-gray-900">{Number(s.percent)}%</span>
                <button onClick={() => saveSplits(splits.filter((x) => x.key !== s.key))} aria-label={`Remove ${s.name || s.email_hint}`} className="text-xs font-medium text-red-600">Remove</button>
              </li>
            ))}
            <li className="px-3 py-2 text-xs text-gray-600">{total}% to people · {Math.max(0, 100 - total)}% to {orgName}</li>
          </ul>
        )}
        <div className="relative mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_80px_auto]">
          <div className="relative">
            {picked ? (
              <div className="flex min-h-[44px] items-center gap-2 rounded-xl border border-indigo-300 bg-indigo-50 px-3 text-sm">
                {picked.profile_photo ? <img src={picked.profile_photo} alt="" className="h-6 w-6 rounded-full object-cover" /> : null}
                <span className="min-w-0 flex-1 truncate font-medium text-indigo-950">{picked.full_name}</span>
                <button onClick={() => { setPicked(null); setDraft({ ...draft, q: '' }); }} aria-label="Clear" className="text-indigo-700">✕</button>
              </div>
            ) : (
              <input value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} placeholder="Search TapIN by name, or enter an email" aria-label="Person" className="min-h-[44px] w-full rounded-xl border border-gray-300 px-3 text-base text-gray-900 sm:text-sm" />
            )}
            {results.length > 0 && (
              <ul className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
                {results.map((p) => (
                  <li key={p.id}><button onClick={() => { setPicked(p); setResults([]); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50">
                    {p.profile_photo ? <img src={p.profile_photo} alt="" className="h-7 w-7 rounded-full object-cover" /> : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">{p.full_name.charAt(0)}</span>}
                    <span className="truncate text-gray-900">{p.full_name}</span>
                  </button></li>
                ))}
              </ul>
            )}
          </div>
          <input value={draft.percent} onChange={(e) => setDraft({ ...draft, percent: e.target.value.replace(/[^0-9.]/g, '') })} placeholder="%" inputMode="decimal" aria-label="Percent" className="min-h-[44px] rounded-xl border border-gray-300 px-3 text-base text-gray-900 sm:text-sm" />
          <button onClick={() => {
            const pct = Number(draft.percent);
            const email = draft.q.trim().toLowerCase();
            if (!picked && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toastError('Pick someone on TapIN, or enter an email.');
            if (!(pct > 0)) return toastError('Enter a percent.');
            if (total + pct > 100) return toastError('Shares add up to more than 100%.');
            const entry = picked ? { key: `u:${picked.id}`, percent: pct, label: null } : { key: email, percent: pct, label: null };
            saveSplits([...(splits ?? []).filter((x) => x.key !== entry.key), entry as Split]);
            setDraft({ q: '', percent: '', label: '' }); setPicked(null);
          }} className="min-h-[44px] rounded-xl bg-[#0F1B3D] px-4 text-sm font-semibold text-white">Add</button>
        </div>
        <p className="mt-1 text-[11px] text-gray-500">People on TapIN are found by name; their email stays private. Anyone else can be added by email.</p>
      </section>
    </div>
  );
}
