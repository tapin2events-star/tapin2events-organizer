import type { PackId } from './plans';

// Plan messages from the server ("Volunteer shifts are part of the Community pack. Add it from TapIN Plans ...")
// open the one-tap upgrade pop-up, wherever they happen.
export interface PlanNeeded { feature: string; packLabel: string; pack: PackId | 'essentials' | 'business' }
const PACK_NAMES: Record<string, PackId> = { 'Performers & Promotion': 'performers', Conference: 'conference', 'Fundraising & Gala': 'fundraising', Community: 'community' };
export function detectPlanMessage(text: string): PlanNeeded | null {
  const m = text.match(/([A-Z][^."{}]{2,60}?) (?:is|are) part of (Essentials|the ([A-Za-z& ]+?) pack|the Business plan)\. Add it from TapIN Plans/);
  if (!m) return null;
  if (m[2] === 'Essentials') return { feature: m[1], packLabel: 'Essentials', pack: 'essentials' };
  if (m[2] === 'the Business plan') return { feature: m[1], packLabel: 'the Business plan', pack: 'business' };
  const id = PACK_NAMES[m[3]];
  return id ? { feature: m[1], packLabel: `the ${m[3]} pack`, pack: id } : null;
}
let last = 0;
export async function planAwareFetch(input: RequestInfo | URL, init?: RequestInit) {
  const res = await fetch(input, init);
  if (!res.ok && res.status >= 400) {
    try {
      const hit = detectPlanMessage(await res.clone().text());
      if (hit && Date.now() - last > 3000) { last = Date.now(); window.dispatchEvent(new CustomEvent<PlanNeeded>('tapin-plan-needed', { detail: hit })); }
    } catch { /* not readable */ }
  }
  return res;
}
