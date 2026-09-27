import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

interface TipRow { id: string; post_id: string | null; creator_email: string; amount: number; message: string | null; payment_status: string; created_at: string }

// Tips the signed-in user has sent to creators.
export default function MyTipsSent() {
  const { user } = useAuth();
  const [tips, setTips] = useState<TipRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.email) return;
    (async () => {
      const { data } = await supabase
        .from('tips')
        .select('id, post_id, creator_email, amount, message, payment_status, created_at')
        .eq('tipper_email', user.email)
        .in('payment_status', ['paid', 'refunded'])
        .order('created_at', { ascending: false });
      const rows = (data ?? []) as TipRow[];
      setTips(rows);
      const emails = [...new Set(rows.map((t) => t.creator_email))];
      if (emails.length) {
        const { data: profiles } = await supabase.from('public_profiles').select('email, full_name').in('email', emails);
        setNames(Object.fromEntries(((profiles ?? []) as { email: string; full_name: string | null }[]).map((p) => [p.email, p.full_name || 'A creator'])));
      }
      setLoading(false);
    })();
  }, [user?.email]);

  if (loading || tips.length === 0) return null;
  const total = tips.filter((t) => t.payment_status === 'paid').reduce((n, t) => n + Number(t.amount), 0);

  return (
    <div id="tips" className="mt-10 scroll-mt-20">
      <h2 className="font-display text-xl font-bold text-gray-900">Tips You've Sent</h2>
      <p className="mt-1 text-sm text-gray-500">${total.toFixed(2)} sent to creators. Thank you for supporting them!</p>
      <div className="mt-4 flex flex-col gap-3">
        {tips.map((t) => (
          <div key={t.id} className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="min-w-0">
              <p className="font-medium text-gray-900">
                ${Number(t.amount).toFixed(2)} to {names[t.creator_email] ?? 'a creator'}
              </p>
              <p className="text-sm text-gray-500">{new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
              {t.message && <p className="mt-1 text-sm italic text-gray-600">"{t.message}"</p>}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              {t.payment_status === 'refunded' && <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">Refunded</span>}
              {t.post_id && <Link to={`/feed?post=${t.post_id}`} className="text-sm font-medium text-marigold hover:underline">View post</Link>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
