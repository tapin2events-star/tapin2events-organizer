import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { toast, toastError } from '../../lib/toast';

// Admin: who skips the first-event payout protection. Verified organizations always do; mark others as trusted
// (organizations, or people for their personal events).
interface List { orgs: { id: string; name: string; slug: string; verified: boolean; trusted: boolean }[]; people: { email: string; name: string | null }[] }
export default function PayoutTrust() {
  const [list, setList] = useState<List | null>(null);
  const [email, setEmail] = useState('');
  const [q, setQ] = useState('');
  const load = useCallback(() => { supabase.rpc('admin_payout_trust_list').then(({ data }) => setList((data ?? null) as List | null)); }, []);
  useEffect(() => { load(); }, [load]);
  async function set(args: { p_org_id?: string; p_email?: string; p_trusted: boolean }, msg: string) {
    const { error } = await supabase.rpc('admin_set_payout_trust', { p_org_id: args.p_org_id ?? null, p_email: args.p_email ?? null, p_trusted: args.p_trusted });
    if (error) return toastError(error.message);
    toast(msg); load();
  }
  if (!list) return null;
  const orgs = list.orgs.filter((o) => !q || o.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <section className="rounded-2xl border border-gray-200 bg-surface p-4">
      <h3 className="font-display text-lg font-semibold text-bone">🛡️ Trusted for payouts</h3>
      <p className="mt-1 text-sm text-muted">New organizers get 75% of their first event's earnings right away and 25% two days after the event. Verified organizations, anyone with a completed paid event, TapIN admins, and anyone trusted here get normal payouts.</p>
      <p className="mt-4 text-sm font-semibold text-bone">People (their personal events)</p>
      <div className="mt-2 flex gap-2">
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" type="email" className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 text-base text-gray-900 sm:text-sm" />
        <button onClick={() => { if (email.trim()) { set({ p_email: email.trim(), p_trusted: true }, '✓ Trusted for payouts'); setEmail(''); } }} className="min-h-[44px] shrink-0 rounded-xl bg-[#0F1B3D] px-4 text-sm font-semibold text-white">Trust</button>
      </div>
      {list.people.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1.5">
          {list.people.map((p) => (
            <li key={p.email} className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
              <span className="min-w-0 truncate text-gray-900">{p.name ? `${p.name} · ` : ''}{p.email}</span>
              <button onClick={() => set({ p_email: p.email, p_trusted: false }, 'Removed')} className="shrink-0 text-xs font-medium text-red-600">Remove</button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-5 text-sm font-semibold text-bone">Organizations</p>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search organizations" className="mt-2 min-h-[44px] w-full rounded-xl border border-gray-300 bg-white px-3 text-base text-gray-900 sm:text-sm" />
      <ul className="mt-2 flex max-h-80 flex-col gap-1.5 overflow-y-auto">
        {orgs.map((o) => (
          <li key={o.id} className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
            <span className="min-w-0 truncate text-gray-900">{o.name}{o.verified ? <span className="ml-1 text-xs text-green-700">✓ Verified</span> : null}</span>
            {o.verified ? <span className="shrink-0 text-xs text-gray-500">Trusted (verified)</span> : (
              <button role="switch" aria-checked={o.trusted} aria-label={`Trust ${o.name} for payouts`} onClick={() => set({ p_org_id: o.id, p_trusted: !o.trusted }, o.trusted ? `${o.name} is no longer trusted` : `✓ ${o.name} trusted for payouts`)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${o.trusted ? 'bg-marigold' : 'bg-gray-300'}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${o.trusted ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
