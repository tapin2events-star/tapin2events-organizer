import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useFeature } from '../../lib/preview';
import Sheet from '../scouting/Sheet';
import BrandedSignIn, { TAPIN_BRAND } from '../BrandedSignIn';

// Tip the performers (preview): the event's tippable lineup performers (and opted-in split people). 100% goes to
// them; card processing is added on top. Signed-out visitors use the quick email-code sign-in first.
interface Person { key: string; name: string; photo: string | null; role: string | null }
const processing = (c: number) => Math.ceil((c + 30) / (1 - 0.029)) - c;
const money = (c: number) => `$${(c / 100).toFixed(2)}`;

export default function TipPerformers({ eventId, eventTitle, compact = false }: { eventId: string; eventTitle: string; compact?: boolean }) {
  const on = useFeature('performer_tips');
  const { user } = useAuth();
  const [people, setPeople] = useState<Person[]>([]);
  const [who, setWho] = useState<Person | null>(null);
  const [signIn, setSignIn] = useState<Person | null>(null);
  const [amount, setAmount] = useState(10);
  const [custom, setCustom] = useState('');
  const [message, setMessage] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [thanks] = useState(() => new URLSearchParams(window.location.search).get('tipped') === '1');
  useEffect(() => { if (on) supabase.rpc('event_tip_recipients', { p_event_id: eventId }).then(({ data }) => setPeople((data ?? []) as Person[])); }, [on, eventId]);
  useEffect(() => { if (on && people.length && window.location.hash === '#tip') setTimeout(() => document.getElementById('tip')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 400); }, [on, people.length]);
  if (!on || people.length === 0) return null;
  const cents = custom ? Math.round(Number(custom) * 100) : amount * 100;
  const valid = cents >= 100 && cents <= 50000;
  const open = (p: Person) => { setErr(null); setMessage(''); setAnonymous(false); setCustom(''); setAmount(10); if (user) setWho(p); else setSignIn(p); };
  async function pay() {
    if (!who || !valid) return;
    setBusy(true); setErr(null);
    const back = `${window.location.origin}${window.location.pathname}`;
    const { data, error } = await supabase.functions.invoke('create-performer-tip-checkout', {
      body: { event_id: eventId, recipient: who.key, amount: cents / 100, message: message.trim() || null, anonymous, successUrl: `${back}?tipped=1#tip`, cancelUrl: `${back}#tip` },
    });
    setBusy(false);
    const url = (data as { url?: string; error?: string } | null)?.url;
    if (error || !url) { setErr((data as { error?: string } | null)?.error ?? 'Couldn\u2019t start your tip. Please try again.'); return; }
    window.location.href = url;
  }
  return (
    <section id="tip" className={`scroll-mt-20 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 ${compact ? '' : 'mt-8'}`} aria-label="Tip the performers">
      <p className="font-display text-lg font-bold text-gray-900">💸 Tip the performers</p>
      <p className="mt-0.5 text-sm text-gray-700">{thanks ? 'Thank you for tipping! 🎉 They\u2019ll be so happy.' : '100% of your tip goes to them.'}</p>
      <div className="mt-3 flex flex-col gap-2">
        {people.map((p) => (
          <div key={p.key} className="flex items-center gap-3 rounded-xl bg-white p-2.5">
            {p.photo ? <img src={p.photo} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" /> : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-800">{p.name.charAt(0)}</span>}
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-gray-900">{p.name}</span>{p.role && <span className="block truncate text-xs text-gray-500">{p.role}</span>}</span>
            <button onClick={() => open(p)} className="min-h-[40px] shrink-0 rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700">Tip</button>
          </div>
        ))}
      </div>
      {signIn && <BrandedSignIn brand={TAPIN_BRAND} branded={false} eventId={eventId} onClose={() => setSignIn(null)} onDone={() => { const p = signIn; setSignIn(null); setWho(p); }} />}
      {who && (
        <Sheet title={`Tip ${who.name}`} onClose={() => setWho(null)}>
          <p className="text-sm text-gray-600">At {eventTitle}. 100% of your tip goes to {who.name}.</p>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {[5, 10, 20].map((a) => (
              <button key={a} type="button" onClick={() => { setAmount(a); setCustom(''); }} aria-pressed={!custom && amount === a}
                className={`min-h-[44px] rounded-xl border text-sm font-semibold ${!custom && amount === a ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-gray-300 bg-white text-gray-800'}`}>${a}</button>
            ))}
            <input value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="$ Other" aria-label="Other amount"
              className="min-h-[44px] rounded-xl border border-gray-300 px-2 text-center text-base text-gray-900 sm:text-sm" />
          </div>
          <textarea value={message} onChange={(e) => setMessage(e.target.value.slice(0, 280))} rows={2} placeholder="Add a message (optional)"
            className="mt-3 block w-full rounded-xl border border-gray-300 px-3 py-2 text-base text-gray-900 sm:text-sm" />
          <label className="mt-2 flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="h-4 w-4 accent-emerald-600" />Send anonymously</label>
          {valid && <p className="mt-3 text-xs text-gray-500">Card processing ({money(processing(cents))}) is added on top, so {who.name} gets the full {money(cents)}.</p>}
          {!valid && (custom || amount) ? <p className="mt-3 text-xs text-red-600">Tips can be from $1 to $500.</p> : null}
          {err && <p role="alert" className="mt-2 text-sm text-red-600">{err}</p>}
          <button onClick={pay} disabled={!valid || busy} className="mt-4 min-h-[48px] w-full rounded-full bg-emerald-600 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? 'Opening checkout…' : valid ? `Tip ${money(cents)}` : 'Tip'}
          </button>
        </Sheet>
      )}
    </section>
  );
}
