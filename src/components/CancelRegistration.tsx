import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { ConfirmDialog } from './admin/shared';

// "Can't make it?" for FREE registrations, before the event starts.
// Shows nothing for paid tickets, used/cancelled tickets, or events that have started.
export function canCancelRegistration(t: { status?: string | null; price_paid?: number | null }, eventStart?: string | null) {
  return t.status === 'confirmed' && !(Number(t.price_paid) > 0) && (!eventStart || new Date(eventStart).getTime() > Date.now());
}

export default function CancelRegistration({ ticketId, eventTitle, onCancelled, variant = 'link', className = '' }: {
  ticketId: string; eventTitle: string; onCancelled: () => void; variant?: 'link' | 'button' | 'light'; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const styles = {
    link: 'text-sm font-medium text-gray-500 underline underline-offset-2 hover:text-red-600',
    light: 'text-sm font-medium text-white/70 underline underline-offset-2 hover:text-white',
    button: 'w-32 rounded-lg border border-red-200 px-2 py-1.5 text-center text-xs font-medium text-red-600 hover:bg-red-50',
  } as const;
  return (
    <>
      <button type="button" onClick={() => { setError(null); setOpen(true); }} className={`${styles[variant]} ${className}`}>
        {variant === 'button' ? 'Cancel registration' : 'Can\u2019t make it? Cancel my registration'}
      </button>
      {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
      {open && (
        <ConfirmDialog danger title="Cancel your registration?" confirmLabel="Yes, cancel it"
          body={<>Your spot for <strong>{eventTitle}</strong> opens up for someone else, and your ticket's QR code will stop working. You can register again later if there's still room.</>}
          onClose={() => setOpen(false)}
          onConfirm={async () => {
            const { error: e } = await supabase.rpc('cancel_free_registration', { p_ticket_id: ticketId });
            if (e) { setError(e.message && !/function|permission/i.test(e.message) ? e.message : "Couldn't cancel. Please try again."); return; }
            onCancelled();
          }} />
      )}
    </>
  );
}
