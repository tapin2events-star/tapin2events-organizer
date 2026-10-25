import { donationFee } from '../../lib/donations';

// "Add a gift" for single-price ticket checkouts (dark ticket panel). 100% goes to the recipient; only 2.9% card
// processing on the gift is added on top (the ticket fees already cover Stripe's $0.30).
const money = (n: number) => `$${n.toFixed(2).replace(/\.00$/, '')}`;
export default function GiftAddOn({ presets, min, recipient, nonprofit, gift, custom, onGift, onCustom }: {
  presets: number[]; min: number; recipient: string; nonprofit: boolean;
  gift: number; custom: string; onGift: (n: number) => void; onCustom: (s: string) => void;
}) {
  const value = custom ? Number(custom) : gift;
  const ok = value >= min;
  return (
    <div className="rounded-xl bg-white/10 p-3">
      <p className="text-sm font-semibold text-white">💛 {nonprofit ? `Add a donation to ${recipient}?` : `Add a contribution to support ${recipient}?`}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {[0, ...presets.slice(0, 3)].map((p) => (
          <button key={p} type="button" onClick={() => { onGift(p); onCustom(''); }} aria-pressed={!custom && gift === p}
            className={`min-h-[40px] rounded-full px-4 text-sm font-medium ${!custom && gift === p ? 'bg-white text-gray-900' : 'bg-white/15 text-white'}`}>{p === 0 ? 'No thanks' : money(p)}</button>
        ))}
        <input value={custom} inputMode="decimal" onChange={(e) => onCustom(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Other $" aria-label="Other gift amount"
          className="min-h-[40px] w-24 rounded-full bg-white/15 px-3 text-base text-white placeholder:text-white/60 sm:text-sm" />
      </div>
      {value > 0 && !ok && <p className="mt-1.5 text-xs text-rose-200">The minimum is {money(min)}.</p>}
      {ok && <p className="mt-1.5 text-xs text-white/80">💚 100% goes to {recipient}. Only card processing ({money(donationFee(value, true))}) is added on top.{nonprofit ? '' : ' Not tax-deductible.'}</p>}
    </div>
  );
}
