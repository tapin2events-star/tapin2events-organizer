import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

// Features that are built but not yet switched on for everyone.
// While a feature is listed here as 'preview', only admins with Preview mode on see it.
// To launch it for everyone, change its status to 'live' (or remove the check).
export const FEATURES: Record<string, { name: string; description: string; status: 'preview' | 'live' }> = {
  promote: { name: 'Promotion links', description: 'Tracking links per event (Instagram bio, flyers, promoters with commission) with visits, tickets and revenue per link; promoters see their own links and earnings.', status: 'preview' },
  profile_qr: { name: 'Personal TapIN QR', description: 'A QR code on your profile that opens your public TapIN profile, to share anywhere.', status: 'preview' },
  networking: { name: 'Attendee networking', description: 'Organizers turn on networking for an event; ticket holders add a card (title, company, what they\u2019re looking for), browse who\u2019s going and send connection requests. Contact info is shared only between connections.', status: 'preview' },
  invoices: { name: 'Invoices & receipts', description: 'Pay-by-invoice for group and company ticket purchases (Tickets tab), and printable receipts where buyers can add company, address, tax ID and PO number.', status: 'preview' },
  templates: { name: 'Event templates', description: 'Start a new event from a template (Conference, Summit, Gala, Workshop series, Networking night, Fundraiser, Concert / showcase, Open mic) that fills in the description, tickets, registration questions and agenda.', status: 'preview' },
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
