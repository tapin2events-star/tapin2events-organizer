import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Sheet from '../scouting/Sheet';
import { answerText, KIND_LABEL, loadQuestions, type Question, type QuestionKind } from '../../lib/registration';
import type { TapEvent } from '../../lib/types';

interface Registrant { email: string; full_name: string | null; tickets: number; request_id: string | null; request_status: string | null; request_message: string | null; requested_at: string | null; answers: Record<string, unknown> }
const field = 'mt-1 block w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900';
const PRESETS: { label: string; kind: QuestionKind; options?: string[] }[] = [
  { label: 'Company', kind: 'short_text' }, { label: 'Job title', kind: 'short_text' },
  { label: 'Dietary needs', kind: 'single_choice', options: ['None', 'Vegetarian', 'Vegan', 'Gluten-free', 'Other'] },
  { label: 'T-shirt size', kind: 'single_choice', options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] },
  { label: 'Phone', kind: 'phone' }, { label: 'How did you hear about us?', kind: 'short_text' },
];

// Event dashboard > Registration: approval switch, join requests, questions, and answers.
export default function RegistrationTab({ event, onEventChange }: { event: TapEvent; onEventChange: (e: TapEvent) => void }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [people, setPeople] = useState<Registrant[]>([]);
  const [editing, setEditing] = useState<Question | 'new' | null>(null);
  const [preset, setPreset] = useState<(typeof PRESETS)[number] | null>(null);
  const [deciding, setDeciding] = useState<{ r: Registrant; approve: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [qs, { data }] = await Promise.all([loadQuestions(event.id, true), supabase.rpc('event_registrants', { p_event_id: event.id })]);
    setQuestions(qs);
    setPeople(((data ?? []) as Registrant[]).map((p) => ({ ...p, tickets: Number(p.tickets) })));
  }, [event.id]);
  useEffect(() => { load(); }, [load]);

  const pending = people.filter((p) => p.request_status === 'pending');
  const activeQs = questions.filter((q) => q.active);

  async function toggleApproval(on: boolean) {
    const { error } = await supabase.from('events').update({ requires_approval: on }).eq('id', event.id);
    if (!error) onEventChange({ ...event, requires_approval: on });
  }
  async function approveAll() {
    setBusy(true);
    for (const p of pending) if (p.request_id) await supabase.rpc('decide_registration', { p_request_id: p.request_id, p_approve: true, p_note: null });
    setBusy(false); load();
  }
  function downloadCsv() {
    const cols = ['Name', 'Email', 'Tickets', 'Request', ...activeQs.map((q) => q.label)];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = people.map((p) => [p.full_name ?? '', p.email, p.tickets, p.request_status ?? '', ...activeQs.map((q) => answerText(p.answers[q.id]))].map(esc).join(','));
    const blob = new Blob([[cols.map(esc).join(','), ...rows].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${event.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-registrations.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  async function move(i: number, dir: -1 | 1) {
    const list = [...questions]; const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    setQuestions(list);
    await Promise.all(list.map((q, k) => supabase.from('event_questions').update({ sort_order: k }).eq('id', q.id)));
  }

  return (
    <div className="mt-2 flex flex-col gap-8">
      {/* Approval */}
      <section className="rounded-2xl border border-gray-200 bg-surface p-4">
        <label className="flex items-start gap-3">
          <input type="checkbox" checked={!!event.requires_approval} onChange={(e) => toggleApproval(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-marigold" />
          <span><span className="block font-semibold text-bone">Require approval to register</span>
            <span className="block text-sm text-muted">People tap <strong>Request to join</strong> and answer your questions. You approve or decline; approved people get an email to finish registering or paying. Good for invite-only and vetted events.</span></span>
        </label>
      </section>

      {/* Requests */}
      {(event.requires_approval || pending.length > 0) && (
        <section>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-lg font-bold text-bone">Requests {pending.length > 0 && <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">{pending.length} waiting</span>}</h3>
            {pending.length > 1 && <button onClick={approveAll} disabled={busy} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 disabled:opacity-50">{busy ? 'Approving…' : `Approve all ${pending.length}`}</button>}
          </div>
          {pending.length === 0 ? <p className="mt-2 text-sm text-muted">No requests waiting.</p> : (
            <ul className="mt-3 flex flex-col gap-3">
              {pending.map((p) => (
                <li key={p.email} className="rounded-2xl border border-gray-200 bg-white p-4">
                  <p className="font-semibold text-gray-900">{p.full_name || p.email}</p>
                  <p className="text-xs text-gray-500">{p.email}{p.requested_at ? ` · asked ${new Date(p.requested_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}</p>
                  {p.request_message && <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">"{p.request_message}"</p>}
                  {activeQs.some((q) => p.answers[q.id] != null) && (
                    <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                      {activeQs.filter((q) => p.answers[q.id] != null).map((q) => (
                        <div key={q.id} className="min-w-0"><dt className="text-xs text-gray-500">{q.label}</dt><dd className="break-words text-gray-900">{answerText(p.answers[q.id])}</dd></div>
                      ))}
                    </dl>
                  )}
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:flex">
                    <button onClick={() => setDeciding({ r: p, approve: true })} className="min-h-[44px] rounded-xl bg-[#0F1B3D] px-4 text-sm font-bold text-white">Approve</button>
                    <button onClick={() => setDeciding({ r: p, approve: false })} className="min-h-[44px] rounded-xl border border-gray-300 px-4 text-sm font-medium text-gray-700">Decline</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Questions */}
      <section>
        <h3 className="font-display text-lg font-bold text-bone">Registration questions</h3>
        <p className="text-sm text-muted">Asked once, before someone registers or pays (or requests to join).</p>
        {questions.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {questions.map((q, i) => (
              <li key={q.id} className={`flex items-center gap-2 rounded-xl border border-gray-200 bg-surface p-3 ${q.active ? '' : 'opacity-60'}`}>
                <button onClick={() => setEditing(q)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-semibold text-bone">{q.label}{q.required && <span className="text-red-600"> *</span>}</span>
                  <span className="block text-xs text-muted">{KIND_LABEL[q.kind]}{q.options.length ? ` · ${q.options.join(', ')}` : ''}{q.active ? '' : ' · hidden'}</span>
                </button>
                <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="flex h-10 w-9 items-center justify-center rounded-lg text-gray-500 disabled:opacity-25">↑</button>
                <button onClick={() => move(i, 1)} disabled={i === questions.length - 1} aria-label="Move down" className="flex h-10 w-9 items-center justify-center rounded-lg text-gray-500 disabled:opacity-25">↓</button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <button onClick={() => { setPreset(null); setEditing('new'); }} className="min-h-[44px] rounded-xl border border-dashed border-gray-400 bg-white px-4 text-sm font-semibold text-gray-700 sm:min-h-0 sm:py-2">+ Add question</button>
          <div className="flex flex-wrap gap-2">
            {PRESETS.filter((p) => !questions.some((q) => q.label.toLowerCase() === p.label.toLowerCase())).map((p) => (
              <button key={p.label} onClick={() => { setPreset(p); setEditing('new'); }} className="min-h-[36px] rounded-full bg-white px-3 text-sm text-gray-600 ring-1 ring-gray-200">+ {p.label}</button>
            ))}
          </div>
        </div>
      </section>

      {/* Answers */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-lg font-bold text-bone">Attendees & answers <span className="text-sm font-normal text-muted">({people.length})</span></h3>
          {people.length > 0 && <button onClick={downloadCsv} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700">Download spreadsheet (CSV)</button>}
        </div>
        {people.length === 0 ? <p className="mt-2 text-sm text-muted">No one yet.</p> : (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-gray-200">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500"><tr><th className="px-3 py-2">Name</th><th className="px-3 py-2">Status</th>{activeQs.map((q) => <th key={q.id} className="px-3 py-2">{q.label}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {people.map((p) => (
                  <tr key={p.email}>
                    <td className="px-3 py-2"><span className="block font-medium text-gray-900">{p.full_name || p.email}</span><span className="text-xs text-gray-500">{p.email}</span></td>
                    <td className="px-3 py-2 text-xs">{p.tickets > 0 ? `${p.tickets} ticket${p.tickets === 1 ? '' : 's'}` : p.request_status ?? ''}</td>
                    {activeQs.map((q) => <td key={q.id} className="px-3 py-2 text-gray-700">{answerText(p.answers[q.id])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && <QuestionSheet eventId={event.id} question={editing === 'new' ? null : editing} preset={preset} nextSort={questions.length} onClose={() => setEditing(null)} onSaved={load} />}
      {deciding && <DecideSheet r={deciding.r} approve={deciding.approve} onClose={() => setDeciding(null)} onDone={() => { setDeciding(null); load(); }} />}
    </div>
  );
}

function QuestionSheet({ eventId, question, preset, nextSort, onClose, onSaved }: { eventId: string; question: Question | null; preset: (typeof PRESETS)[number] | null; nextSort: number; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ label: question?.label ?? preset?.label ?? '', help: question?.help ?? '', kind: (question?.kind ?? preset?.kind ?? 'short_text') as QuestionKind,
    options: (question?.options ?? preset?.options ?? []).join('\n'), required: question?.required ?? false, active: question?.active ?? true });
  const [err, setErr] = useState<string | null>(null);
  const isChoice = f.kind === 'single_choice' || f.kind === 'multi_choice';
  async function save() {
    const options = isChoice ? [...new Set(f.options.split('\n').map((o) => o.trim()).filter(Boolean))].slice(0, 30) : [];
    if (!f.label.trim()) return setErr('Write the question.');
    if (isChoice && options.length < 2) return setErr('Add at least two options, one per line.');
    const row = { event_id: eventId, label: f.label.trim(), help: f.help.trim() || null, kind: f.kind, options, required: f.required, active: f.active, ...(question ? {} : { sort_order: nextSort }) };
    const { error } = question ? await supabase.from('event_questions').update(row).eq('id', question.id) : await supabase.from('event_questions').insert(row);
    if (error) return setErr("Couldn't save the question.");
    onSaved(); onClose();
  }
  return (
    <Sheet title={question ? 'Edit question' : 'Add a question'} onClose={onClose} wide>
      <label className="block text-xs font-medium text-gray-500">Question<input className={field} value={f.label} maxLength={200} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="What's your company?" autoFocus /></label>
      <label className="mt-3 block text-xs font-medium text-gray-500">Answer type
        <select className={field} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as QuestionKind })}>
          {(Object.keys(KIND_LABEL) as QuestionKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
      </label>
      {isChoice && <label className="mt-3 block text-xs font-medium text-gray-500">Options (one per line)<textarea rows={5} className={field} value={f.options} onChange={(e) => setF({ ...f, options: e.target.value })} placeholder={'Option one\nOption two'} /></label>}
      <label className="mt-3 block text-xs font-medium text-gray-500">Hint (optional)<input className={field} value={f.help} maxLength={300} onChange={(e) => setF({ ...f, help: e.target.value })} placeholder="Shown under the question" /></label>
      <label className="mt-3 flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={f.required} onChange={(e) => setF({ ...f, required: e.target.checked })} className="h-4 w-4 accent-marigold" /> Required</label>
      <label className="mt-2 flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} className="h-4 w-4 accent-marigold" /> Ask this question</label>
      {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
      <div className="mt-5 flex items-center justify-between">
        {question ? <button onClick={async () => { if (!window.confirm('Delete this question and everyone\u2019s answers to it? To keep the answers, uncheck "Ask this question" instead.')) return; await supabase.from('event_questions').delete().eq('id', question.id); onSaved(); onClose(); }} className="text-sm text-gray-400 hover:text-red-600">Delete</button> : <span />}
        <button onClick={save} className="rounded-xl bg-[#0F1B3D] px-5 py-2.5 text-sm font-bold text-white">Save</button>
      </div>
    </Sheet>
  );
}

function DecideSheet({ r, approve, onClose, onDone }: { r: Registrant; approve: boolean; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Sheet title={approve ? `Approve ${r.full_name || r.email}?` : `Decline ${r.full_name || r.email}?`} onClose={onClose}>
      <p className="-mt-2 text-sm text-gray-600">{approve ? 'They\u2019ll get an email with a link to finish registering or paying.' : 'They\u2019ll get a short, polite email letting them know.'}</p>
      <label className="mt-3 block text-xs font-medium text-gray-500">Add a note (optional)<textarea rows={2} maxLength={500} className={field} value={note} onChange={(e) => setNote(e.target.value)} placeholder={approve ? 'Looking forward to seeing you!' : 'We had more requests than seats this time.'} /></label>
      {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
      <button disabled={busy} onClick={async () => {
        setBusy(true);
        const { error } = await supabase.rpc('decide_registration', { p_request_id: r.request_id, p_approve: approve, p_note: note.trim() || null });
        setBusy(false);
        if (error) return setErr("Couldn't save that. Please try again.");
        onDone();
      }} className={`mt-4 w-full rounded-xl py-3 text-sm font-bold text-white disabled:opacity-50 ${approve ? 'bg-[#0F1B3D]' : 'bg-gray-700'}`}>{busy ? 'Saving…' : approve ? 'Approve' : 'Decline'}</button>
    </Sheet>
  );
}
