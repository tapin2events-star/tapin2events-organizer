import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useFeature } from '../../lib/preview';

// Stats page (preview): tips I've received at events. Private to me.
interface Tip { id: string; event_title: string; event_id: string; amount_cents: number; message: string | null; from: string | null; paid_at: string; payout_status: string }
export default function MyTips() {
  const on = useFeature('performer_tips');
  const [tips, setTips] = useState<Tip[]>([]);
  useEffect(() => { if (on) supabase.rpc('my_event_tips').then(({ data }) => setTips((data ?? []) as Tip[])); }, [on]);
  if (!on || tips.length === 0) return null;
  const total = tips.reduce((n, t) => n + t.amount_cents, 0);
  const waiting = tips.filter((t) => t.payout_status === 'waiting').reduce((n, t) => n + t.amount_cents, 0);
  return (
    <section className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4" aria-label="Your tips">
      <p className="text-sm font-semibold text-emerald-900">💸 Tips from your events <span className="font-normal">(only you see this)</span></p>
      <p className="mt-0.5 font-display text-2xl font-bold text-emerald-900">${(total / 100).toFixed(2)}</p>
      {waiting > 0 && <p className="text-xs text-emerald-800">${(waiting / 100).toFixed(2)} is waiting for you. <Link to="/profile#payouts" className="font-semibold underline">Connect payouts</Link> to receive it.</p>}
      <ul className="mt-3 flex flex-col gap-2">
        {tips.slice(0, 20).map((t) => (
          <li key={t.id} className="rounded-xl bg-white p-3 text-sm">
            <div className="flex justify-between gap-2"><span className="font-semibold text-gray-900">${(t.amount_cents / 100).toFixed(2)} from {t.from ?? 'someone (anonymous)'}</span><span className="shrink-0 text-xs text-gray-500">{new Date(t.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></div>
            <p className="text-xs text-gray-500">{t.event_title}</p>
            {t.message && <p className="mt-1 text-gray-700">&ldquo;{t.message}&rdquo;</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
