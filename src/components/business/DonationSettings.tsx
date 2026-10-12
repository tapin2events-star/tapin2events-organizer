import { MIN_DONATION, donationFee, money2 } from '../../lib/donations';

export interface DonationForm { enabled: boolean; pitch: string; goal: string; min: string; presets: string; show: boolean }
export const DEFAULT_DONATION_FORM: DonationForm = { enabled: false, pitch: '', goal: '', min: String(MIN_DONATION), presets: '25, 50, 100', show: true };

// Turns the form's text into the event's saved donation settings (or a problem to fix).
export function donationPatch(f: DonationForm): { patch?: Record<string, unknown>; problem?: string } {
  const presets = [...new Set(f.presets.split(/[,\s]+/).map((x) => Math.round(Number(x) * 100) / 100).filter((n) => n >= MIN_DONATION && n <= 100000))].slice(0, 4).sort((a, b) => a - b);
  const min = Math.max(MIN_DONATION, Number(f.min) || MIN_DONATION);
  const goal = f.goal ? Number(f.goal) : null;
  if (f.enabled) {
    if (goal !== null && !(goal > 0)) return { problem: 'Enter a fundraising goal above $0, or leave it blank.' };
    if (presets.length === 0) return { problem: `Add at least one suggested donation amount of $${MIN_DONATION} or more.` };
  }
  return { patch: { donations_enabled: f.enabled, donation_description: f.pitch.trim() || null, donation_goal: goal, min_donation_amount: min, donation_presets: presets.length ? presets : [25, 50, 100], show_donors: f.show } };
}

// Donation settings inside the create/edit event form (nonprofit events).
export default function DonationSettings({ value, onChange, inputClass, nonprofit = true }: { value: DonationForm; onChange: (f: DonationForm) => void; inputClass: string; nonprofit?: boolean }) {
  const f = value;
  const set = (patch: Partial<DonationForm>) => onChange({ ...f, ...patch });
  const example = Number(f.presets.split(/[,\s]+/).map(Number).find((n) => n >= MIN_DONATION)) || 25;
  return (
    <div className="-mx-1 rounded-2xl border border-rose-200 bg-rose-50/40 p-3 sm:mx-0 sm:p-4">
      <label className="flex items-start gap-3 text-sm text-bone">
        <input type="checkbox" checked={f.enabled} onChange={(e) => set({ enabled: e.target.checked })} className="mt-0.5 h-5 w-5 shrink-0 accent-marigold" />
        <span><strong>💛 {nonprofit ? 'Accept donations' : 'Accept support (contributions)'}</strong> <span className="ml-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700">Preview</span>
          <span className="block text-xs text-muted">{nonprofit ? 'Adds a donation card with a goal bar to your event page, and lets ticket buyers add a gift to their order.' : 'Adds a "Support this event" card with a goal bar, and lets ticket buyers add a contribution. Contributions go to you as the organizer and aren\u2019t tax-deductible donations.'}</span></span>
      </label>
      {f.enabled && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="min-w-0 text-xs font-medium text-gray-500 sm:col-span-2">{nonprofit ? 'Why give?' : 'What will support go toward?'} <span className="font-normal text-gray-400">(shown on the card)</span>
            <textarea rows={3} maxLength={1000} className={inputClass} value={f.pitch} onChange={(e) => set({ pitch: e.target.value })} placeholder="Every gift funds free arts programs for local youth." />
          </label>
          <label className="min-w-0 text-xs font-medium text-gray-500">Fundraising goal ($) <span className="font-normal text-gray-400">(optional)</span>
            <input className={inputClass} inputMode="decimal" value={f.goal} onChange={(e) => set({ goal: e.target.value.replace(/[^0-9.]/g, '') })} placeholder="5000" />
          </label>
          <label className="min-w-0 text-xs font-medium text-gray-500">Minimum gift ($, at least {MIN_DONATION})
            <input className={inputClass} inputMode="decimal" value={f.min} onChange={(e) => set({ min: e.target.value.replace(/[^0-9.]/g, '') })} />
          </label>
          <label className="min-w-0 text-xs font-medium text-gray-500 sm:col-span-2">Suggested amounts <span className="font-normal text-gray-400">(up to 4, separated by commas)</span>
            <input className={inputClass} value={f.presets} onChange={(e) => set({ presets: e.target.value })} placeholder="25, 50, 100, 250" />
          </label>
          <label className="flex items-start gap-2 text-sm text-gray-700 sm:col-span-2">
            <input type="checkbox" checked={f.show} onChange={(e) => set({ show: e.target.checked })} className="mt-0.5 h-4 w-4 shrink-0 accent-marigold" />
            <span>Show recent supporters on the event page <span className="block text-xs text-gray-500">First names and messages only, never amounts.</span></span>
          </label>
          <p className="text-xs text-muted sm:col-span-2">Donors see "Cover the fees" checked by default, so most gifts reach you in full. Example: on a ${example} gift the fees are {money2(donationFee(example, false))} (3.7% + 2.9% + $0.50), or {money2(donationFee(example, true))} when added to a ticket order.</p>
        </div>
      )}
    </div>
  );
}
