import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import Sheet from './scouting/Sheet';

const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

// "Transfer ticket": send this ticket to someone else. They get a new ticket with
// their own QR code; this one stops working.
export default function TransferTicket({ ticketId, eventTitle, isSeriesPass = false, className = '' }: { ticketId: string; eventTitle: string; isSeriesPass?: boolean; className?: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [note, setNote] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const clean = email.trim().toLowerCase();
  const matches = clean && clean === confirmEmail.trim().toLowerCase();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(clean)) return setError('Enter a valid email address.');
    if (!matches) return setError("The two email addresses don't match.");
    setBusy(true); setError(null);
    const { error: err } = await supabase.rpc('transfer_ticket', { p_ticket_id: ticketId, p_to_email: clean, p_note: note.trim() || null });
    setBusy(false);
    if (err) return setError(err.message && !/function|permission denied/i.test(err.message) ? err.message : "Couldn't transfer this ticket. Please try again.");
    setDone(clean);
  }

  const field = 'mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-base text-gray-900';
  return (
    <>
      <button type="button" data-tour="ticket-transfer" onClick={() => setOpen(true)} className={className || 'text-sm font-medium text-marigold hover:underline'}>
        {isSeriesPass ? 'Transfer pass' : 'Transfer ticket'}
      </button>
      {open && (
        <Sheet title={done ? 'Ticket sent' : isSeriesPass ? 'Transfer your series pass' : 'Transfer your ticket'} onClose={() => { if (done) navigate('/activity#tickets'); setOpen(false); }}>
          {done ? (
            <div className="text-center">
              <div className="text-4xl">🎟️</div>
              <p className="mt-2 text-sm text-gray-700">Your {isSeriesPass ? 'pass' : 'ticket'} for <strong>{eventTitle}</strong> is on its way to <strong>{done}</strong>. They'll get an email with their own ticket and QR code.</p>
              <p className="mt-2 text-xs text-gray-500">This {isSeriesPass ? 'pass' : 'ticket'} no longer works for you.</p>
              <button type="button" onClick={() => navigate('/activity#tickets')} className="mt-4 w-full rounded-xl bg-marigold py-3 text-sm font-semibold text-white">Done</button>
            </div>
          ) : (
            <form onSubmit={submit}>
              <p className="-mt-2 text-sm text-gray-600">Send it to a friend who's going in your place. They get their own ticket with a new QR code. They don't need a TapIN account.</p>
              <label className="mt-4 block text-xs font-medium text-gray-500">Their email
                <input type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} className={field} placeholder="friend@example.com" autoFocus />
              </label>
              <label className="mt-3 block text-xs font-medium text-gray-500">Type it again
                <input type="email" autoComplete="off" value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} className={field} />
              </label>
              <label className="mt-3 block text-xs font-medium text-gray-500">Message <span className="font-normal text-gray-400">(optional)</span>
                <input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} className={field} placeholder="Enjoy the show!" />
              </label>
              <label className="mt-4 flex items-start gap-2.5 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-marigold" />
                <span>I understand this {isSeriesPass ? 'pass (all its upcoming dates)' : 'ticket'} will belong to them and my QR code will stop working. Refunds, if any, still go to the original buyer.</span>
              </label>
              {error && <p role="alert" className="mt-3 text-sm text-magenta">{error}</p>}
              <button type="submit" disabled={busy || !understood || !matches} className="mt-4 w-full rounded-xl bg-marigold py-3 text-sm font-semibold text-white disabled:opacity-50">
                {busy ? 'Sending…' : `Send ${isSeriesPass ? 'pass' : 'ticket'}`}
              </button>
            </form>
          )}
        </Sheet>
      )}
    </>
  );
}

// Can this ticket be transferred right now (before the checks the server makes)?
export function canTransfer(t: { status: string }, startDate: string | null, isSeriesPass = false) {
  if (t.status !== 'confirmed') return false;
  return isSeriesPass || !startDate || new Date(startDate).getTime() > Date.now();
}
