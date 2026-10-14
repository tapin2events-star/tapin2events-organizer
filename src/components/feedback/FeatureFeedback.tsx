import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';

// One-question check-in after someone uses a feature: 👎 / 👌 / 🔥, then (for 🔥 and 👌) "worth paying for?"
// and an optional comment. Shown once per person per feature; "Not now" hides it for this device.
export default function FeatureFeedback({ feature, label, className = '' }: { feature: string; label: string; className?: string }) {
  const { user } = useAuth();
  const [state, setState] = useState<'hidden' | 'ask' | 'more' | 'done'>('hidden');
  const [rating, setRating] = useState<'meh' | 'ok' | 'love' | null>(null);
  const [comment, setComment] = useState('');
  const dismissKey = `tapin_fb_${feature}`;
  useEffect(() => {
    if (!user) return;
    try { if (localStorage.getItem(dismissKey)) return; } catch { /* storage unavailable */ }
    supabase.rpc('feedback_answered', { p_feature: feature }).then(({ data }) => { if (data === false) setState('ask'); });
  }, [user, feature]); // eslint-disable-line react-hooks/exhaustive-deps

  async function rate(r: 'meh' | 'ok' | 'love') {
    setRating(r);
    await supabase.rpc('give_feedback', { p_feature: feature, p_rating: r });
    setState('more');
  }
  async function finish(worth: 'yes' | 'maybe' | 'no' | null) {
    await supabase.rpc('give_feedback', { p_feature: feature, p_rating: rating, p_worth: worth, p_comment: comment.trim() || null });
    setState('done');
  }
  if (state === 'hidden') return null;
  if (state === 'done') return <p className={`rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800 ${className}`}>Thanks! Your feedback helps shape TapIN. 💛</p>;
  return (
    <div className={`rounded-2xl border border-gray-200 bg-white p-3 ${className}`}>
      {state === 'ask' ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-gray-900">How useful is {label}?</p>
          <div className="flex items-center gap-1.5">
            {([['meh', '👎', 'Not useful'], ['ok', '👌', 'Useful'], ['love', '🔥', 'Love it']] as const).map(([v, icon, name]) => (
              <button key={v} onClick={() => rate(v)} aria-label={name} title={name} className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-lg hover:border-marigold">{icon}</button>
            ))}
            <button onClick={() => { try { localStorage.setItem(dismissKey, '1'); } catch { /* storage unavailable */ } setState('hidden'); }} className="px-2 text-xs text-gray-400">Not now</button>
          </div>
        </div>
      ) : (
        <div>
          <textarea rows={2} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={rating === 'meh' ? 'What would make it better? (optional)' : 'Anything you\u2019d change? (optional)'}
            className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 sm:text-sm" />
          {rating === 'meh' ? (
            <button onClick={() => finish(null)} className="mt-2 rounded-xl bg-[#0F1B3D] px-4 py-2 text-sm font-semibold text-white">Send</button>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-700">Would this be worth paying for?</span>
              {([['yes', 'Yes'], ['maybe', 'Maybe'], ['no', 'No']] as const).map(([v, t]) => (
                <button key={v} onClick={() => finish(v)} className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:border-marigold">{t}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
