import { EVENT_TEMPLATES, type EventTemplate } from '../../lib/eventTemplates';
import PremiumBadge, { PremiumNotice } from './PremiumBadge';

// "Start from a template" (Preview): a row of templates; picking one fills in the form.
export default function TemplatePicker({ selected, onPick }: { selected: string | null; onPick: (t: EventTemplate) => void }) {
  const chosen = EVENT_TEMPLATES.find((t) => t.id === selected) ?? null;
  return (
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold text-bone">✨ Start from a template</p>
        <PremiumBadge feature="templates" />
      </div>
      <PremiumNotice feature="Starting from a template" featureKey="templates" />
      <p className="mt-1 text-sm text-muted">Pick one to fill in the description, tickets, registration questions and agenda. You can change everything.</p>
      <div className="-mx-3 mt-3 flex snap-x gap-2 overflow-x-auto px-3 pb-1 sm:-mx-4 sm:px-4">
        {EVENT_TEMPLATES.map((t) => (
          <button key={t.id} type="button" onClick={() => onPick(t)} aria-pressed={selected === t.id}
            className={`flex w-40 shrink-0 snap-start flex-col items-start rounded-2xl border p-3 text-left transition ${selected === t.id ? 'border-marigold bg-white ring-2 ring-marigold/30' : 'border-gray-200 bg-white hover:border-gray-400'}`}>
            <span className="text-2xl leading-none" aria-hidden="true">{t.icon}</span>
            <span className="mt-1.5 text-sm font-semibold text-gray-900">{t.name}</span>
            <span className="mt-0.5 text-xs leading-snug text-gray-500">{t.blurb}</span>
            <span className="mt-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{t.kind === 'nonprofit' ? 'Nonprofit' : t.kind === 'business' ? 'Business' : 'Community'}</span>
          </button>
        ))}
      </div>
      {chosen && (
        <p className="mt-2 rounded-xl bg-white px-3 py-2 text-xs text-gray-600">
          Using the <strong>{chosen.name}</strong> template: {[
            chosen.sell.mode === 'tiers' ? `${chosen.sell.tiers.length} ticket types` : chosen.sell.mode === 'seating' ? 'reserved seating' : Number(chosen.sell.price) > 0 ? `$${chosen.sell.price} tickets` : 'free registration',
            chosen.questions?.length ? `${chosen.questions.length} registration question${chosen.questions.length === 1 ? '' : 's'}` : '',
            chosen.agenda?.length && chosen.kind !== 'community' ? `a ${chosen.agenda.length}-part agenda` : '',
            chosen.donations ? 'a donation goal' : '',
          ].filter(Boolean).join(', ')}. Questions and the agenda are added when you save; edit them anytime from the event's dashboard.
        </p>
      )}
    </div>
  );
}
