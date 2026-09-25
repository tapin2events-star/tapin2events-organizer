import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

const PRESETS = [5, 10, 20, 50];
const MIN_TIP = 1;
const MAX_TIP = 500;

interface TipModalProps {
  postId: string;
  creatorName: string;
  onClose: () => void;
}

// Matches the original Base44 tip dialog: preset amounts, a custom amount,
// an optional message, and a pink "Send Tip" button. Payment happens on
// Stripe's checkout page; the tip goes straight to the creator's payout
// account, with the service fee shown there as its own line.
export default function TipModal({ postId, creatorName, onClose }: TipModalProps) {
  const [preset, setPreset] = useState<number | null>(null);
  const [custom, setCustom] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amount = custom.trim() ? Number(custom) : preset;
  const amountValid = amount !== null && Number.isFinite(amount) && amount >= MIN_TIP && amount <= MAX_TIP;

  async function sendTip() {
    if (!amountValid || sending) return;
    setSending(true);
    setError(null);
    const feedUrl = `${window.location.origin}${import.meta.env.BASE_URL}feed?post=${postId}`;
    const { data, error: fnError } = await supabase.functions.invoke('create-tip-checkout', {
      body: { post_id: postId, amount, message, successUrl: `${feedUrl}&tip=success`, cancelUrl: feedUrl },
    });
    if (fnError || !data?.url) {
      let msg = 'Could not start your tip. Please try again.';
      try {
        const body = await (fnError as { context?: Response })?.context?.json();
        if (body?.error) msg = body.error;
      } catch {
        // keep the generic message
      }
      setError(data?.error || msg);
      setSending(false);
      return;
    }
    window.location.href = data.url;
  }

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <p className="flex items-center gap-2 text-lg font-semibold text-bone">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EC4899" strokeWidth="2">
              <path d="M20.8 8.6c0 4.5-8.8 10.4-8.8 10.4S3.2 13.1 3.2 8.6a4.8 4.8 0 0 1 8.8-2.7 4.8 4.8 0 0 1 8.8 2.7z" strokeLinejoin="round" />
            </svg>
            <span className="truncate">Tip {creatorName}</span>
          </p>
          <button onClick={onClose} aria-label="Close" className="text-muted hover:text-bone">✕</button>
        </div>

        <p className="mt-4 text-sm font-medium text-bone">Select Amount</p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {PRESETS.map((value) => (
            <button
              key={value}
              onClick={() => {
                setPreset(value);
                setCustom('');
              }}
              className={`rounded-xl border py-3 text-sm font-semibold ${
                preset === value && !custom.trim() ? 'border-pink-500 bg-pink-50 text-pink-600' : 'border-gray-300 text-bone hover:border-pink-300'
              }`}
            >
              ${value}
            </button>
          ))}
        </div>

        <label className="mt-4 block text-sm font-medium text-bone">
          Custom Amount
          <div className="mt-1 flex items-center rounded-lg border border-gray-300 bg-surface px-3 focus-within:border-pink-400">
            <span className="text-muted">$</span>
            <input
              type="number"
              inputMode="decimal"
              min={MIN_TIP}
              max={MAX_TIP}
              step="0.01"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Enter amount"
              className="w-full bg-transparent px-2 py-2.5 text-base text-bone outline-none"
            />
          </div>
        </label>

        <label className="mt-4 block text-sm font-medium text-bone">
          Message (Optional)
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={280}
            placeholder="Say something nice..."
            className="mt-1 w-full rounded-lg border border-gray-300 bg-surface px-3 py-2.5 text-base text-bone outline-none focus:border-pink-400"
          />
        </label>

        {custom.trim() && !amountValid && (
          <p className="mt-2 text-xs text-magenta">Tips can be between ${MIN_TIP} and ${MAX_TIP}.</p>
        )}
        {error && <p className="mt-2 text-sm text-magenta">{error}</p>}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={onClose} className="rounded-lg border border-gray-300 py-2.5 text-sm font-semibold text-bone hover:bg-surface2">
            Cancel
          </button>
          <button
            onClick={sendTip}
            disabled={!amountValid || sending}
            className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-pink-500 to-rose-500 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20.8 8.6c0 4.5-8.8 10.4-8.8 10.4S3.2 13.1 3.2 8.6a4.8 4.8 0 0 1 8.8-2.7 4.8 4.8 0 0 1 8.8 2.7z" strokeLinejoin="round" />
            </svg>
            {sending ? 'Opening checkout…' : 'Send Tip'}
          </button>
        </div>
        <p className="mt-3 text-center text-xs text-muted">A small service fee is added at checkout. {creatorName.split(' ')[0]} receives the full tip.</p>
      </div>
    </div>
  );
}
