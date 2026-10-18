import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PlanNeeded } from '../../lib/planPrompt';
import { PACKS, PLAN_PRICES, money } from '../../lib/plans';

// One-tap upgrade pop-up: opens when someone tries a feature their plan doesn't include.
export default function UpgradePrompt() {
  const [need, setNeed] = useState<PlanNeeded | null>(null);
  const navigate = useNavigate();
  useEffect(() => {
    const on = (e: Event) => setNeed((e as CustomEvent<PlanNeeded>).detail);
    window.addEventListener('tapin-plan-needed', on);
    return () => window.removeEventListener('tapin-plan-needed', on);
  }, []);
  if (!need) return null;
  const pack = PACKS.find((p) => p.id === need.pack);
  const price = pack ? `+${money(pack.price.month)}/month with Essentials` : need.pack === 'essentials' ? `${money(PLAN_PRICES.essentials.month)}/month` : `${money(PLAN_PRICES.business.month)}/month`;
  const cta = pack ? `Add the ${pack.name} pack` : need.pack === 'essentials' ? 'Get Essentials' : 'Get Business';
  const go = (to: string) => { setNeed(null); navigate(to); };
  return (
    <div className="fixed inset-0 z-[1600] flex items-end justify-center bg-black/50 sm:items-center" onClick={() => setNeed(null)} role="dialog" aria-label="Upgrade your plan">
      <div className="w-full max-w-md rounded-t-3xl bg-white p-6 sm:rounded-3xl" onClick={(e) => e.stopPropagation()} style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}>
        <p className="text-3xl" aria-hidden="true">{pack?.icon ?? '⭐'}</p>
        <p className="mt-2 text-xl font-bold text-gray-900">Unlock {need.feature.charAt(0).toLowerCase() + need.feature.slice(1)}</p>
        <p className="mt-1 text-base text-gray-600">{need.feature} {/s$/.test(need.feature) ? 'are' : 'is'} part of <strong>{need.packLabel}</strong> ({price}). Everything in it is included in Business.</p>
        {pack && <p className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-700">{pack.features.map((f) => f.name).join(' · ')}</p>}
        <button onClick={() => go(`/business/plan?pack=${need.pack}#get-plan`)} className="mt-5 w-full rounded-2xl bg-[#0F1B3D] py-3.5 text-base font-bold text-white">{cta}</button>
        <div className="mt-2 flex gap-2">
          <button onClick={() => go('/business/plan')} className="flex-1 rounded-2xl border border-gray-300 py-3 text-sm font-semibold text-gray-800">See all plans</button>
          <button onClick={() => setNeed(null)} className="flex-1 rounded-2xl py-3 text-sm font-medium text-gray-500">Not now</button>
        </div>
      </div>
    </div>
  );
}
