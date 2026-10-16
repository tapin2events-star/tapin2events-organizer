import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

// Admin > Usage: which premium features each organization (and independent organizer) actually uses,
// so packs and prices can be based on real behavior before billing is turned on.
export const FEATURE_LABELS: Record<string, string> = {
  templates: 'Event templates', invoices: 'Invoices', promotion_links: 'Promotion links', promoter_payouts: 'Automatic promoter payouts',
  revenue_splits: 'Revenue splits', boost: 'Boost', networking: 'Attendee networking', program: 'Program / agenda', workshops: 'Workshop sign-ups',
  volunteers: 'Volunteer shifts', gala: 'Gala tools', video_headers: 'Video headers & reels', meetings: 'Meetings', newsletters: 'Newsletters', white_label: 'White-label',
};
interface Report { accounts: { kind: string; name: string; slug: string | null; founding: boolean; events: number; used: Record<string, number> }[]; totals: Record<string, number>; accounts_total: number }

export default function PremiumUsagePanel() {
  const [r, setR] = useState<Report | null>(null);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => { supabase.rpc('premium_usage_report').then(({ data }) => setR((data ?? null) as Report | null)); }, []);
  if (!r) return null;
  const features = Object.keys(FEATURE_LABELS).map((k) => ({ k, n: r.totals[k] ?? 0 })).sort((a, b) => b.n - a.n);
  const users = r.accounts.filter((a) => Object.keys(a.used).length > 0);
  const list = showAll ? r.accounts : users;
  return (
    <section className="mt-6 rounded-2xl border border-gray-200 bg-surface p-4">
      <p className="font-display text-lg font-bold text-bone">📊 Premium feature usage</p>
      <p className="text-sm text-muted">Which premium features organizations and organizers actually use (from what they've set up). {users.length} of {r.accounts_total} active accounts use at least one.</p>
      <ul className="mt-3 flex flex-col gap-1.5">
        {features.map((f) => (
          <li key={f.k} className="flex items-center gap-3 text-sm">
            <span className="w-48 shrink-0 truncate text-bone">{FEATURE_LABELS[f.k]}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200"><span className="block h-full rounded-full bg-marigold" style={{ width: `${r.accounts_total ? (f.n / r.accounts_total) * 100 : 0}%` }} /></span>
            <span className="w-10 shrink-0 text-right text-xs text-muted">{f.n}</span>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">By account</p>
        <button onClick={() => setShowAll(!showAll)} className="text-xs font-medium text-marigold">{showAll ? 'Only accounts using premium features' : `Show all ${r.accounts.length}`}</button>
      </div>
      {list.length === 0 ? <p className="mt-2 text-sm text-muted">No premium features in use yet.</p> : (
        <ul className="mt-2 flex flex-col gap-2">
          {list.map((a, i) => (
            <li key={i} className="rounded-xl border border-gray-200 bg-white p-3 text-sm">
              <p className="font-semibold text-gray-900">{a.kind === 'org' ? '🏢' : '👤'} {a.name}{a.founding && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">FOUNDING</span>}<span className="ml-2 text-xs font-normal text-gray-500">{a.events} event{a.events === 1 ? '' : 's'}</span></p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {Object.keys(a.used).length ? Object.entries(a.used).map(([k, n]) => <span key={k} className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-800">{FEATURE_LABELS[k] ?? k} · {n}</span>) : <span className="text-xs text-gray-400">Free features only</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
