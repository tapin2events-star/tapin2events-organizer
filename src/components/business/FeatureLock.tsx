import { useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { PlanNeeded } from '../../lib/planPrompt';
import { packFor } from '../../lib/plans';

// Shows its content when the plan includes the feature (always, while premium features are free);
// otherwise a friendly locked card that opens the upgrade pop-up.
export default function FeatureLock({ orgId, eventId, feature, title, children }: { orgId?: string | null; eventId?: string | null; feature: string; title: string; children: ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.rpc('can_use_feature', { p_event_id: eventId ?? null, p_org_id: orgId ?? null, p_feature: feature }).then(({ data, error }) => setOk(error ? true : data !== false));
  }, [orgId, eventId, feature]);
  if (ok !== false) return <>{children}</>;
  const pack = packFor(feature);
  const packId = (['templates', 'insights', 'promotion_links', 'invoices', 'meetings', 'embed_polish'].includes(feature) ? 'essentials'
    : ['promoter_payouts', 'video_headers', 'local_partners', 'nearby_plus'].includes(feature) ? 'performers' : ['program', 'workshops', 'networking'].includes(feature) ? 'conference'
    : ['gala', 'donors'].includes(feature) ? 'fundraising' : ['volunteers', 'newsletters'].includes(feature) ? 'community' : 'business') as PlanNeeded['pack'];
  return (
    <section className="mt-4 rounded-2xl border border-dashed border-[#C9A227]/60 bg-[#C9A227]/5 p-5 text-center">
      <p className="text-2xl" aria-hidden="true">🔒</p>
      <p className="mt-1 font-semibold text-bone">{title}</p>
      <p className="mt-1 text-sm text-muted">Part of {pack.detail}.</p>
      <button onClick={() => window.dispatchEvent(new CustomEvent<PlanNeeded>('tapin-plan-needed', { detail: { feature: title, packLabel: pack.label === 'Essentials' ? 'Essentials' : `the ${pack.label}`, pack: packId } }))}
        className="mt-3 rounded-xl bg-[#0F1B3D] px-4 py-2.5 text-sm font-semibold text-white">Unlock {title.toLowerCase()}</button>
    </section>
  );
}
