// TapIN plans & packs (matches the business-plan billing function and plan_feature_pack in the database).
export type PlanId = 'essentials' | 'business' | 'agency';
export type PackId = 'performers' | 'conference' | 'fundraising' | 'community';
export const PLAN_PRICES: Record<PlanId, { month: number; year: number }> = { essentials: { month: 15, year: 150 }, business: { month: 49, year: 490 }, agency: { month: 149, year: 1490 } };
export const AGENCY_EXTRA = { month: 25, year: 250 };
export const FOUNDING_PLANS: PlanId[] = ['business', 'agency'];
export interface Feature { key: string; icon: string; name: string; desc: string }
export const ESSENTIALS: Feature[] = [
  { key: 'templates', icon: '✨', name: 'Event templates', desc: 'Conference, gala, summit and more, ready in minutes' },
  { key: 'insights', icon: '📈', name: 'Organization insights', desc: 'Sales across events, attendee list and exports' },
  { key: 'promotion_links', icon: '📣', name: 'Promotion links', desc: 'Track every link and promoter' },
  { key: 'invoices', icon: '🧾', name: 'Invoices', desc: 'Bill companies for group tickets' },
  { key: 'meetings', icon: '📝', name: 'Meeting extras', desc: 'Recurring meetings, minutes, agenda templates' },
  { key: 'embed_polish', icon: '🌐', name: 'Website embed, your way', desc: 'Your brand colors and font, list, grid or calendar layouts, and no "Tickets by TapIN" link' },
];
export const PACKS: { id: PackId; icon: string; name: string; price: { month: number; year: number }; for: string; features: Feature[] }[] = [
  { id: 'performers', icon: '🎤', name: 'Performers & Promotion', price: { month: 5, year: 50 }, for: 'Shows, concerts and open mics', features: [
    { key: 'promoter_payouts', icon: '📣', name: 'Automatic promoter payouts', desc: 'Commission sent on every ticket sold through a promo link' },
    { key: 'video_headers', icon: '🎬', name: 'Video headers & highlight reels', desc: 'Trailers on your pages and past-event highlights' },
  ] },
  { id: 'conference', icon: '🎓', name: 'Conference', price: { month: 15, year: 150 }, for: 'Conferences, summits and workshops', features: [
    { key: 'program', icon: '🗓️', name: 'Program extras', desc: 'Visual agenda, speakers, sponsors' },
    { key: 'workshops', icon: '📋', name: 'Workshop sign-ups', desc: 'Limited seats, waitlists, per-session check-in' },
    { key: 'networking', icon: '🤝', name: 'Attendee networking', desc: 'Cards, suggestions and QR connect' },
  ] },
  { id: 'fundraising', icon: '💛', name: 'Fundraising & Gala', price: { month: 15, year: 150 }, for: 'Galas and fundraisers', features: [
    { key: 'gala', icon: '🥂', name: 'Gala tools', desc: 'Table seating, paddle numbers, live paddle raise' },
    { key: 'donors', icon: '💛', name: 'Donor features', desc: 'Donors across events in your audience' },
  ] },
  { id: 'community', icon: '🙋', name: 'Community', price: { month: 5, year: 50 }, for: 'Community groups and nonprofits', features: [
    { key: 'volunteers', icon: '🙋', name: 'Volunteer shifts', desc: 'Sign-ups, waitlists, check-in and reminders' },
    { key: 'newsletters', icon: '✉️', name: 'Newsletters', desc: 'Email your audience about new events' },
  ] },
];
export const BUSINESS_EXTRAS: Feature[] = [
  { key: 'featured', icon: '⭐', name: 'Featured on Discover', desc: 'Your organization in the Featured row' },
  { key: 'boost_credit', icon: '🚀', name: '$15 monthly Boost credit', desc: 'A free 3-day boost in Discover\u2019s Promoted row every month' },
];

export function planTotal(plan: PlanId | 'artist', interval: 'month' | 'year', packs: PackId[], extraClients: number, founding: boolean) {
  let total = plan === 'artist' ? ARTIST_PLAN[interval] : PLAN_PRICES[plan][interval];
  if (plan === 'essentials' || plan === 'artist') total += packs.reduce((n, p) => n + (PACKS.find((x) => x.id === p)?.price[interval] ?? 0), 0);
  if (plan === 'agency') total += extraClients * AGENCY_EXTRA[interval];
  const discounted = founding && plan !== 'artist' && FOUNDING_PLANS.includes(plan) ? Math.round(total * 0.6 * 100) / 100 : total;
  return { full: total, due: discounted };
}
export const money = (n: number) => `$${n % 1 ? n.toFixed(2) : n.toLocaleString('en-US')}`;

// Artist plan (for individuals, not organizations).
export const ARTIST_PLAN = { month: 10, year: 100 };
export const ARTIST_FEATURES: Feature[] = [
  { key: 'artist_video', icon: '🎬', name: 'Video header on your artist profile', desc: 'A trailer at the top of your profile' },
  { key: 'featured_artist', icon: '⭐', name: 'Featured Artist', desc: 'Shown first in Artists & vendors, with a Featured badge' },
  { key: 'boost_credit', icon: '🚀', name: '$10 monthly Boost credit', desc: 'Toward boosting your shows in Discover\u2019s Promoted row' },
];

// Which plan or pack each premium feature belongs to (matches plan_feature_pack in the database), for badges and prompts.
export function packFor(feature?: string): { label: string; detail: string } {
  const pack = (id: PackId) => { const p = PACKS.find((x) => x.id === id)!; return { label: `${p.name} pack`, detail: `the ${p.name} pack (+${money(p.price.month)}/month with Essentials or the Artist plan, and included in Business)` }; };
  switch (feature) {
    case 'templates': case 'insights': case 'promotion_links': case 'invoices': case 'meetings': case 'embed_polish':
      return { label: 'Essentials', detail: `Essentials (${money(PLAN_PRICES.essentials.month)}/month, and included in Business)` };
    case 'promoter_payouts': case 'video_headers': case 'local_partners': return pack('performers');
    case 'program': case 'workshops': case 'networking': return pack('conference');
    case 'gala': case 'donors': return pack('fundraising');
    case 'volunteers': case 'newsletters': return pack('community');
    case 'artist_video': case 'featured_artist': return { label: 'Artist plan', detail: `the Artist plan (${money(ARTIST_PLAN.month)}/month)` };
    default: return { label: 'Business plan', detail: `the Business plan (${money(PLAN_PRICES.business.month)}/month)` };
  }
}
