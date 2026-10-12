import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import Sheet from '../scouting/Sheet';
import { loadMyAnswers, type Answers, type Question } from '../../lib/registration';

const field = 'mt-1 block w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900';

// Asks the organizer's registration questions before someone registers or pays. In "request"
// mode (approval-required events) it also takes an optional note and sends the request.
export default function RegistrationSheet({ eventId, eventTitle, questions, mode, items, onClose, onDone }: {
  eventId: string; eventTitle: string; questions: Question[]; mode: 'register' | 'request';
  items?: { tier_id: string; qty: number }[] | null; onClose: () => void; onDone: () => void;
}) {
  const { user } = useAuth();
  const [answers, setAnswers] = useState<Answers>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (user?.email) loadMyAnswers(eventId, user.email).then(setAnswers); }, [eventId, user?.email]);

  const set = (id: string, v: string | string[]) => { setAnswers((a) => ({ ...a, [id]: v })); setError(null); };

  async function submit() {
    for (const q of questions) {
      const v = answers[q.id];
      const empty = v == null || (Array.isArray(v) ? v.length === 0 : String(v).trim() === '');
      if (q.required && empty) return setError(`Please answer: ${q.label}`);
    }
    setBusy(true); setError(null);
    if (questions.length) {
      const { error: e1 } = await supabase.rpc('save_registration_answers', { p_event_id: eventId, p_answers: answers });
      if (e1) { setBusy(false); return setError(e1.message && !/function|permission/i.test(e1.message) ? e1.message : "Couldn't save your answers."); }
    }
    if (mode === 'request') {
      const { error: e2 } = await supabase.rpc('request_registration', { p_event_id: eventId, p_items: items ?? null, p_message: message.trim() || null });
      if (e2) { setBusy(false); return setError(e2.message && !/function|permission/i.test(e2.message) ? e2.message : "Couldn't send your request."); }
    }
    setBusy(false);
    onDone();
  }

  return (
    <Sheet title={mode === 'request' ? 'Request to join' : 'A few questions'} onClose={onClose} wide>
      <p className="-mt-2 text-sm text-gray-600">{mode === 'request' ? <>The organizer of <strong>{eventTitle}</strong> reviews each request. You'll get an email when they decide.</> : <>The organizer of <strong>{eventTitle}</strong> asks everyone attending.</>}</p>
      <div className="mt-4 flex flex-col gap-4">
        {questions.map((q) => {
          const v = answers[q.id];
          return (
            <div key={q.id}>
              <p className="text-sm font-medium text-gray-900">{q.label}{q.required ? <span className="text-red-600"> *</span> : <span className="text-xs font-normal text-gray-400"> (optional)</span>}</p>
              {q.help && <p className="text-xs text-gray-500">{q.help}</p>}
              {q.kind === 'long_text' ? (
                <textarea rows={3} maxLength={2000} className={field} value={(v as string) ?? ''} onChange={(e) => set(q.id, e.target.value)} />
              ) : q.kind === 'single_choice' ? (
                <div className="mt-1.5 flex flex-col gap-1.5">
                  {q.options.map((o) => (
                    <label key={o} className={`flex min-h-[44px] items-center gap-3 rounded-xl border px-3 text-sm ${v === o ? 'border-marigold bg-marigold/5' : 'border-gray-200 bg-white'}`}>
                      <input type="radio" name={q.id} checked={v === o} onChange={() => set(q.id, o)} className="h-4 w-4 accent-marigold" />{o}
                    </label>
                  ))}
                </div>
              ) : q.kind === 'multi_choice' ? (
                <div className="mt-1.5 flex flex-col gap-1.5">
                  {q.options.map((o) => {
                    const arr = Array.isArray(v) ? v : [];
                    const on = arr.includes(o);
                    return (
                      <label key={o} className={`flex min-h-[44px] items-center gap-3 rounded-xl border px-3 text-sm ${on ? 'border-marigold bg-marigold/5' : 'border-gray-200 bg-white'}`}>
                        <input type="checkbox" checked={on} onChange={() => set(q.id, on ? arr.filter((x) => x !== o) : [...arr, o])} className="h-4 w-4 accent-marigold" />{o}
                      </label>
                    );
                  })}
                </div>
              ) : q.kind === 'yes_no' ? (
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {(['yes', 'no'] as const).map((o) => (
                    <button type="button" key={o} onClick={() => set(q.id, o)} className={`min-h-[44px] rounded-xl border text-sm font-medium ${v === o ? 'border-marigold bg-marigold/10 text-gray-900' : 'border-gray-200 bg-white text-gray-600'}`}>{o === 'yes' ? 'Yes' : 'No'}</button>
                  ))}
                </div>
              ) : (
                <input className={field} maxLength={q.kind === 'short_text' ? 300 : 120} value={(v as string) ?? ''} onChange={(e) => set(q.id, e.target.value)}
                  type={q.kind === 'email' ? 'email' : q.kind === 'phone' ? 'tel' : 'text'} inputMode={q.kind === 'number' ? 'decimal' : q.kind === 'phone' ? 'tel' : q.kind === 'email' ? 'email' : undefined} />
              )}
            </div>
          );
        })}
        {mode === 'request' && (
          <label className="text-sm font-medium text-gray-900">Note to the organizer <span className="text-xs font-normal text-gray-400">(optional)</span>
            <textarea rows={2} maxLength={500} className={field} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Why you'd like to attend, who you're with…" />
          </label>
        )}
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
      <button type="button" onClick={submit} disabled={busy} className="mt-5 w-full rounded-xl bg-marigold py-3 text-sm font-semibold text-white disabled:opacity-50">
        {busy ? 'Please wait…' : mode === 'request' ? 'Send request' : 'Continue'}
      </button>
    </Sheet>
  );
}
