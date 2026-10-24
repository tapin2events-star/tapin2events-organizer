import { useEffect, useState } from 'react';
import { loadMyOrgs, type MyOrg } from '../../lib/business';

// "Who's hosting?" at the top of a new event, for people who own or manage an organization: You, or one of your
// organizations. Remembers your last choice. Hosting as yourself on purpose means TapIN won't ask later whether
// to move the event into an organization.
const KEY = 'tapin-host-as';
export default function HostAsPicker({ orgId, onOrg, onExplicit, presetFromUrl }: {
  orgId: string | null; onOrg: (id: string | null) => void; onExplicit: () => void; presetFromUrl: boolean;
}) {
  const [orgs, setOrgs] = useState<MyOrg[] | null>(null);
  useEffect(() => {
    loadMyOrgs().then((all) => {
      const mine = all.filter((o) => o.role === 'owner' || o.role === 'admin');
      setOrgs(mine);
      // Start from your last choice (unless the page was opened for a specific organization).
      if (!presetFromUrl && mine.length) {
        let last: string | null = null;
        try { last = localStorage.getItem(KEY); } catch { /* private mode */ }
        if (last && last !== 'me' && mine.some((o) => o.id === last)) onOrg(last);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!orgs || orgs.length === 0) return null;
  const choose = (id: string | null) => {
    onOrg(id); onExplicit();
    try { localStorage.setItem(KEY, id ?? 'me'); } catch { /* private mode */ }
  };
  const opt = (id: string | null, label: string, logo: string | null, icon: string) => {
    const on = (orgId ?? null) === id;
    return (
      <button key={id ?? 'me'} type="button" role="radio" aria-checked={on} onClick={() => choose(id)}
        className={`flex min-h-[48px] min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-semibold ${on ? 'border-marigold bg-marigold/10 text-gray-900' : 'border-gray-300 bg-white text-gray-700'}`}>
        {logo ? <img src={logo} alt="" className="h-7 w-7 shrink-0 rounded-lg object-cover" /> : <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-base" aria-hidden="true">{icon}</span>}
        <span className="truncate">{label}</span>
      </button>
    );
  };
  return (
    <div className="mb-5">
      <p className="text-sm font-semibold text-gray-900">Who&apos;s hosting?</p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Who's hosting?">
        {opt(null, 'You', null, '👤')}
        {orgs.map((o) => opt(o.id, o.name, o.logo_url, '🏢'))}
      </div>
      <p className="mt-1.5 text-xs text-gray-500">{orgId ? 'It appears on the organization\u2019s page, its followers are notified, and its team can help manage it.' : 'Hosted under your own name.'}</p>
    </div>
  );
}
