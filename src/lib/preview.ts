import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

// Features that are built but not yet switched on for everyone.
// While a feature is listed here as 'preview', only admins with Preview mode on see it.
// To launch it for everyone, change its status to 'live' (or remove the check).
export const FEATURES: Record<string, { name: string; description: string; status: 'preview' | 'live' }> = {
  splits: { name: 'Revenue splits', description: 'Divide an event\'s ticket sales by percentage: each person connects payouts once and gets their share of every sale automatically (Sales tab on the event dashboard; shares shown in Earnings).', status: 'live' },
  billing: { name: 'Business plan billing', description: 'Start the Business plan for an organization (monthly/yearly, founding 40% off), buy one event ($199), Manage billing, plan status in organization settings, and the admin billing panel with the enforcement switch (off).', status: 'live' },
  gala: { name: 'Gala tools', description: 'Gala tab on the event dashboard: tables (add in bulk, seat parties by hand or auto-seat, seating chart download; shows reserved-seating tables for seated events), paddle numbers, paddle raise with running total; guests see table and paddle on their ticket; donors in the organization Audience.', status: 'live' },
  program_v2: { name: 'Program tab', description: 'The redesigned Business page tab: one Program page with a checklist, visual agenda timeline, quick add (session, workshop, break), duplicate, sample schedules, sign-up rules next to workshops, and a speaker library from the organization\'s People.', status: 'live' },
  workshops: { name: 'Workshop sign-ups', description: 'Agenda sessions people sign up for: seats, waitlist, ticket-holders-only and overlap rules, per-session lists with check-in, reminders before sessions, sessions shown in Attendees.', status: 'live' },
  volunteers: { name: 'Volunteer shifts', description: 'Volunteers tab on the event dashboard (shifts, spots, sign-ups, waitlist, check-in, export) and a Volunteer card on the event page (sign up, waitlist, cancel, day-before reminder).', status: 'live' },
  video_headers: { name: 'Video headers & highlight reel', description: 'A muted looping trailer at the top of event and organization pages (chosen from Feed videos), plus Highlights from past events on organization pages.', status: 'live' },
  promoter_payouts: { name: 'Automatic promoter payouts', description: 'Promote tab switch: promoters get their commission automatically on every ticket sold through their link (they connect payouts once; held until then; refunds reverse it). Promoters see payouts on My promoter links.', status: 'live' },
  featured_perk: { name: 'Featured on Discover (plan perk)', description: 'Organizations with an active Business plan are placed first in Discover\'s Featured organizations row (counted like verified) with a Featured label.', status: 'live' },
  white_label: { name: 'White-label events', description: 'A $299 add-on per organization event: the event page and tickets show only the organization\'s brand (no TapIN menu, top bar or bottom tabs). Event dashboard > Overview to buy it (or turn it on as admin for testing).', status: 'preview' },
  newsletters: { name: 'Newsletters', description: 'Organization newsletters: an audience of past attendees, followers and imported contacts (CSV or pasted), emails with an event card, promo code and tracked link, test sends, per-organization unsubscribe, and clicks/ticket sales per email.', status: 'live' },
  business_plan_page: { name: 'Business plan page', description: 'The "Business plan, coming soon" page (/business/plan) with planned premium features, free-forever features, and founding-price reservations, linked from TapIN for Business and Sales & payouts.', status: 'live' },
  org_insights: { name: 'Organization insights', description: 'In organization settings: a Promote tab (links, promoters and boosts across events), attendee counts and an All attendees list (CSV) on Events, and sales across events in Sales & payouts.', status: 'live' },
  promote: { name: 'Promotion links', description: 'Tracking links per event (Instagram bio, flyers, promoters with commission) with visits, tickets and revenue per link; promoters see their own links and earnings.', status: 'live' },
  profile_qr: { name: 'Personal TapIN QR', description: 'A QR code on your profile that opens your public TapIN profile, to share anywhere.', status: 'live' },
  networking: { name: 'Attendee networking', description: 'Organizers turn on networking for an event; ticket holders add a card (title, company, what they\u2019re looking for), browse who\u2019s going and send connection requests. Contact info is shared only between connections.', status: 'live' },
  invoices: { name: 'Invoices & receipts', description: 'Pay-by-invoice for group and company ticket purchases (Tickets tab), and printable receipts where buyers can add company, address, tax ID and PO number.', status: 'live' },
  templates: { name: 'Event templates', description: 'Start a new event from a template (Conference, Summit, Gala, Workshop series, Networking night, Fundraiser, Concert / showcase, Open mic) that fills in the description, tickets, registration questions and agenda.', status: 'live' },
  business: { name: 'TapIN for Business', description: 'Organizations (companies and nonprofits) with brand kits, the Community / Business / Nonprofit event type picker, and business event pages with agenda, speakers and sponsors.', status: 'live' },
};

const KEY = 'tapin_preview_mode';
const EVENT = 'tapin-preview-change';

export function usePreviewMode() {
  const { isAdmin } = useAuth();
  const [on, setOn] = useState(() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } });
  useEffect(() => {
    const sync = () => { try { setOn(localStorage.getItem(KEY) === '1'); } catch { /* storage unavailable */ } };
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);
  const set = (v: boolean) => {
    try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* storage unavailable */ }
    window.dispatchEvent(new Event(EVENT));
  };
  return { enabled: !!isAdmin && on, available: !!isAdmin, setEnabled: set };
}

// Is this feature visible to the current person?
export function useFeature(key: string): boolean {
  const { enabled } = usePreviewMode();
  const f = FEATURES[key];
  if (!f) return false;
  return f.status === 'live' || enabled;
}
