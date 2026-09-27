import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useEscapeKey } from '../../lib/useEscapeKey';

type Audience = 'ticket_holders' | 'checked_in' | 'not_checked_in' | 'vendors' | 'everyone';
const AUDIENCES: { key: Audience; label: string; hint: string }[] = [
  { key: 'ticket_holders', label: 'Ticket holders', hint: 'Everyone with a ticket' },
  { key: 'not_checked_in', label: "Haven't arrived", hint: 'Ticket holders not checked in yet' },
  { key: 'checked_in', label: 'Checked in', hint: 'People who came' },
  { key: 'vendors', label: 'Vendors', hint: 'Approved and paid vendors' },
  { key: 'everyone', label: 'Everyone', hint: 'Ticket holders and vendors' },
];
const PURPOSES: { key: string; label: string; vendor?: boolean }[] = [
  { key: 'reminder', label: 'Reminder' },
  { key: 'day_of', label: 'Day-of info' },
  { key: 'parking', label: 'Parking & directions' },
  { key: 'schedule', label: 'Schedule change' },
  { key: 'thank_you', label: 'Thank you' },
  { key: 'vendor_info', label: 'Vendor logistics', vendor: true },
  { key: 'custom', label: 'Something else' },
];
interface HistoryItem { id: string; audience: Audience; subject: string; body: string; sender_email: string; recipient_count: number; delivered: number; failed: number; created_at: string }

async function call(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('event-messages', { body });
  if (error) {
    let payload: { error?: string; message?: string } = {};
    try { payload = await (error as { context?: Response }).context?.json() ?? {}; } catch { /* keep generic */ }
    return { error: payload.error ?? 'Something went wrong. Please try again.', message: payload.message, status: (error as { context?: Response }).context?.status };
  }
  return data;
}

// Email an event's ticket holders and/or vendors, with an optional AI draft.
export default function MessagesTab({ eventId }: { eventId: string }) {
  const [counts, setCounts] = useState<Record<Audience, number> | null>(null);
  const [remaining, setRemaining] = useState(10);
  const [myEmail, setMyEmail] = useState('');
  const [audience, setAudience] = useState<Audience>('ticket_holders');
  const [purpose, setPurpose] = useState('reminder');
  const [notes, setNotes] = useState('');
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  const [allowReplies, setAllowReplies] = useState(true);
  const [busy, setBusy] = useState<'' | 'draft' | 'test' | 'send'>('');
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [confirm, setConfirm] = useState<null | { placeholders?: string }>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  useEscapeKey(() => setConfirm(null), !!confirm);

  async function loadMeta() {
    const a = await call({ action: 'audience', event_id: eventId });
    if (!a?.error) { setCounts(a.counts); setRemaining(a.remaining_today); setMyEmail(a.my_email); }
    const h = await call({ action: 'history', event_id: eventId });
    if (!h?.error) setHistory(h.messages);
  }
  useEffect(() => { loadMeta(); }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function draft() {
    setBusy('draft'); setStatus(null);
    const r = await call({ action: 'draft', event_id: eventId, purpose, audience, notes });
    setBusy('');
    if (r?.error) return setStatus({ tone: 'error', text: r.error });
    setSubject(r.subject); setText(r.body);
    setStatus({ tone: 'ok', text: 'Draft ready. Read it over, fill in anything in [brackets], then send.' });
  }

  async function test() {
    setBusy('test'); setStatus(null);
    const r = await call({ action: 'test', event_id: eventId, subject, body: text, allow_replies: allowReplies });
    setBusy('');
    setStatus(r?.error ? { tone: 'error', text: r.error } : { tone: 'ok', text: `Test sent to ${r.sent_to}. Check your inbox.` });
  }

  async function send(confirmPlaceholders = false) {
    setBusy('send'); setStatus(null);
    const r = await call({ action: 'send', event_id: eventId, audience, subject, body: text, allow_replies: allowReplies, confirm_placeholders: confirmPlaceholders });
    setBusy('');
    if (r?.error === 'placeholders') return setConfirm({ placeholders: r.message });
    setConfirm(null);
    if (r?.error) return setStatus({ tone: 'error', text: r.error });
    setStatus({ tone: 'ok', text: `Sending to ${r.recipients} ${r.recipients === 1 ? 'person' : 'people'}. They'll get it within a couple of minutes.` });
    setSubject(''); setText(''); setNotes('');
    loadMeta();
  }

  const count = counts?.[audience] ?? 0;
  const ready = subject.trim() && text.trim() && count > 0 && remaining > 0;
  const label = (a: Audience) => AUDIENCES.find((x) => x.key === a)?.label ?? a;

  return (
    <div className="max-w-2xl">
      <h3 className="font-display text-lg font-semibold text-bone">Message attendees</h3>
      <p className="mt-1 text-sm text-muted">Email the people coming to this event. They'll also see it in their TapIN notifications.</p>

      <p className="mt-5 text-sm font-medium text-bone">Send to</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {AUDIENCES.map((a) => {
          const n = counts?.[a.key] ?? 0;
          return (
            <button key={a.key} type="button" title={a.hint} disabled={!counts || n === 0} onClick={() => setAudience(a.key)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${audience === a.key ? 'bg-marigold text-white' : 'border border-gray-200 bg-white text-gray-700 hover:border-marigold'}`}>
              {a.label} <span className={audience === a.key ? 'text-white/80' : 'text-gray-400'}>{counts ? n : '…'}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
        <p className="text-sm font-semibold text-gray-900">✨ Draft with AI</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PURPOSES.filter((p) => !p.vendor || audience === 'vendors' || audience === 'everyone').map((p) => (
            <button key={p.key} type="button" onClick={() => setPurpose(p.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${purpose === p.key ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:ring-indigo-300'}`}>
              {p.label}
            </button>
          ))}
        </div>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1500}
          placeholder="Optional notes, e.g. “Free parking in the deck on Blount St. Doors at 6:30.”"
          className="mt-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-marigold" />
        <button type="button" onClick={draft} disabled={busy !== ''} className="mt-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
          {busy === 'draft' ? 'Writing…' : subject || text ? 'Write a new draft' : 'Write a draft'}
        </button>
      </div>

      <label className="mt-5 block text-sm font-medium text-bone" htmlFor="msg-subject">Subject</label>
      <input id="msg-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150}
        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 outline-none focus:border-marigold" />
      <label className="mt-3 block text-sm font-medium text-bone" htmlFor="msg-body">Message</label>
      <textarea id="msg-body" value={text} onChange={(e) => setText(e.target.value)} rows={9} maxLength={5000}
        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 outline-none focus:border-marigold" />
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={allowReplies} onChange={(e) => setAllowReplies(e.target.checked)} className="h-4 w-4 accent-marigold" />
          Replies go to {myEmail || 'your email'}
        </label>
        <span>{text.length}/5000</span>
      </div>

      {status && <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${status.tone === 'ok' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{status.text}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={test} disabled={busy !== '' || !subject.trim() || !text.trim()} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-bone hover:border-marigold disabled:opacity-50">
          {busy === 'test' ? 'Sending…' : 'Send test to me'}
        </button>
        <button type="button" onClick={() => setConfirm({})} disabled={busy !== '' || !ready} className="rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-white hover:bg-marigold/90 disabled:opacity-50">
          Send to {count} {count === 1 ? 'person' : 'people'}
        </button>
        <span className="text-xs text-muted">{remaining} of 10 messages left today for this event</span>
      </div>

      {history.length > 0 && (
        <div className="mt-10">
          <h3 className="font-display text-lg font-semibold text-bone">Sent messages</h3>
          <div className="mt-3 flex flex-col gap-2">
            {history.map((m) => {
              const pending = m.recipient_count - m.delivered - m.failed;
              return (
                <div key={m.id} className="rounded-xl border border-gray-200 bg-white p-3">
                  <button type="button" onClick={() => setOpenId(openId === m.id ? null : m.id)} className="flex w-full items-start justify-between gap-3 text-left">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-900">{m.subject}</p>
                      <p className="text-xs text-gray-500">
                        {label(m.audience)} · {new Date(m.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${pending > 0 ? 'bg-amber-100 text-amber-800' : m.failed > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-800'}`}>
                      {pending > 0 ? `Sending ${m.delivered}/${m.recipient_count}` : `Delivered ${m.delivered}/${m.recipient_count}`}
                    </span>
                  </button>
                  {openId === m.id && <p className="mt-2 whitespace-pre-wrap border-t border-gray-100 pt-2 text-sm text-gray-700">{m.body}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={() => busy === '' && setConfirm(null)}>
          <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Send message">
            {confirm.placeholders ? (
              <>
                <p className="font-display text-lg font-bold text-gray-900">Placeholders still in your message</p>
                <p className="mt-1 text-sm text-gray-600">{confirm.placeholders}</p>
              </>
            ) : (
              <>
                <p className="font-display text-lg font-bold text-gray-900">Send to {count} {count === 1 ? 'person' : 'people'}?</p>
                <p className="mt-1 text-sm text-gray-600">"{subject}" goes to {label(audience).toLowerCase()} by email and TapIN notification. This can't be undone.</p>
              </>
            )}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setConfirm(null)} disabled={busy !== ''} className="rounded-lg border border-gray-300 py-2.5 text-sm font-semibold text-gray-800">
                {confirm.placeholders ? 'Go back and edit' : 'Cancel'}
              </button>
              <button type="button" onClick={() => send(!!confirm.placeholders)} disabled={busy !== ''} className="rounded-lg bg-marigold py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                {busy === 'send' ? 'Sending…' : confirm.placeholders ? 'Send anyway' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
