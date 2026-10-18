import type { PlanNeeded } from '../../lib/planPrompt';

// Admin > Preview: see the upgrade pop-up people get when a feature isn't in their plan (nothing is changed).
const SAMPLES: (PlanNeeded & { label: string })[] = [
  { label: 'Essentials', feature: 'Promotion links', packLabel: 'Essentials', pack: 'essentials' },
  { label: 'Performers & Promotion', feature: 'Automatic promoter payouts', packLabel: 'the Performers & Promotion pack', pack: 'performers' },
  { label: 'Conference', feature: 'Workshop sign-ups', packLabel: 'the Conference pack', pack: 'conference' },
  { label: 'Fundraising & Gala', feature: 'Gala tools', packLabel: 'the Fundraising & Gala pack', pack: 'fundraising' },
  { label: 'Community', feature: 'Volunteer shifts', packLabel: 'the Community pack', pack: 'community' },
];
export default function UpgradePreview() {
  return (
    <section className="rounded-2xl border border-gray-200 bg-surface p-5">
      <h2 className="font-display text-lg font-semibold text-bone">⭐ Preview the upgrade pop-up</h2>
      <p className="mt-1 text-sm text-muted">What people see when they try a feature their plan doesn't include (after billing is on). This only opens the pop-up for you; nothing changes.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {SAMPLES.map((s) => (
          <button key={s.pack} onClick={() => window.dispatchEvent(new CustomEvent<PlanNeeded>('tapin-plan-needed', { detail: s }))}
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800">{s.label}</button>
        ))}
      </div>
    </section>
  );
}
