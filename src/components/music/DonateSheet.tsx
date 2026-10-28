import { useState } from 'react';
import Sheet from '../scouting/Sheet';
import { donateMusic, donationTotals, money } from '../../lib/musicBuy';

// Donate to an album or a song (TapIN's standard donation rules): suggested amounts or your own, an optional tip to
// TapIN (No tip by default), and the total. Donors get downloads.
export default function DonateSheet({ kind, id, title, artist, amounts, pagePath, onClose }: { kind: 'album' | 'track'; id: string; title: string; artist: string; amounts: number[]; pagePath: string; onClose: () => void }) {
  const [amount, setAmount] = useState(amounts[1] ?? amounts[0] ?? 10);
  const [custom, setCustom] = useState('');
  const [tip, setTip] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const gift = custom ? Number(custom) : amount;
  const valid = Number.isFinite(gift) && gift >= 1 && gift <= 1000;
  const t = valid ? donationTotals(gift, tip) : null;
  async function go() {
    if (!valid) return;
    setBusy(true); setErr(null);
    const e = await donateMusic(kind, id, gift, tip, pagePath);
    setBusy(false);
    if (e) setErr(e);
  }
  return (
    <Sheet title={`Support ${artist}`} onClose={onClose}>
      <p className="text-sm text-gray-600">Donate for <strong>{title}</strong>. 100% goes to {artist}, and you&apos;ll get downloads as a thank-you.</p>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {amounts.slice(0, 3).map((a) => (
          <button key={a} type="button" onClick={() => { setAmount(a); setCustom(''); }} aria-pressed={!custom && amount === a}
            className={`min-h-[44px] rounded-xl border text-sm font-semibold ${!custom && amount === a ? 'border-marigold bg-marigold text-white' : 'border-gray-300 bg-white text-gray-800'}`}>${a}</button>
        ))}
        <input value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="$ Other" aria-label="Other amount" className="min-h-[44px] rounded-xl border border-gray-300 px-2 text-center text-base text-gray-900 sm:text-sm" />
      </div>
      <label className="mt-3 block text-sm text-gray-700">Optional tip to TapIN
        <select value={tip} onChange={(e) => setTip(Number(e.target.value))} className="mt-1 block min-h-[44px] w-full rounded-xl border border-gray-300 bg-white px-3 text-base text-gray-900 sm:text-sm">
          <option value={0}>No tip</option><option value={5}>5%</option><option value={10}>10%</option><option value={15}>15%</option>
        </select>
      </label>
      {t && <p className="mt-3 text-xs text-gray-500">{money(t.gift)} to {artist}{t.tip ? ` + ${money(t.tip)} tip to TapIN` : ''} + {money(t.processing)} card processing = <strong>{money(t.total)}</strong></p>}
      {!valid && (custom || amount) ? <p className="mt-2 text-xs text-red-600">Donations can be from $1 to $1,000.</p> : null}
      {err && <p role="alert" className="mt-2 text-sm text-red-600">{err}</p>}
      <button onClick={go} disabled={!valid || busy} className="mt-4 min-h-[48px] w-full rounded-full bg-marigold text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Opening checkout…' : t ? `Donate ${money(t.total)}` : 'Donate'}</button>
    </Sheet>
  );
}
