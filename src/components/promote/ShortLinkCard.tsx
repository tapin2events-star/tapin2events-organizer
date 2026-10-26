import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useShareBase } from '../../lib/shareBase';
import { eventShortCode, forgetShortCode } from '../../lib/shortLink';
import { toast, toastError } from '../../lib/toast';

// Promote tab: the event's short link (/e/<code>), easy to paste on Instagram, flyers or texts. The organizer can
// pick a custom name (3 to 40 letters, numbers or dashes).
export default function ShortLinkCard({ eventId }: { eventId: string }) {
  const base = useShareBase(eventId);
  const [code, setCode] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { eventShortCode(eventId).then((c) => { setCode(c); setDraft(c ?? ''); }); }, [eventId]);
  if (!code) return null;
  const url = `${base}e/${code}`;
  const shown = url.replace(/^https?:\/\//, '');
  async function save() {
    setBusy(true);
    const { data, error } = await supabase.rpc('set_event_short_code', { p_event_id: eventId, p_code: draft });
    setBusy(false);
    if (error) return toastError(error.message);
    forgetShortCode(eventId);
    setCode(String(data)); setEditing(false);
    toast('✓ Short link updated');
  }
  return (
    <section className="mb-6 rounded-2xl border border-gray-200 bg-surface p-4">
      <p className="font-display text-lg font-bold text-bone">🔗 Short link</p>
      <p className="mt-0.5 text-sm text-muted">Easy to paste on Instagram, flyers, and texts. Share, QR codes, and flyers use it automatically.</p>
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-2 pl-3">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">{shown}</span>
        <button onClick={() => { navigator.clipboard?.writeText(url).then(() => toast('✓ Link copied'), () => toastError()); }} className="min-h-[40px] shrink-0 rounded-lg bg-[#0F1B3D] px-4 text-sm font-semibold text-white">Copy</button>
      </div>
      {!editing ? (
        <button onClick={() => setEditing(true)} className="mt-2 text-sm font-medium text-marigold">Customize the link</button>
      ) : (
        <div className="mt-3">
          <label className="text-xs font-semibold text-gray-600" htmlFor="short-name">Custom name</label>
          <div className="mt-1 flex items-center gap-1 rounded-xl border border-gray-300 bg-white pl-3 text-sm">
            <span className="shrink-0 text-gray-500">…/e/</span>
            <input id="short-name" value={draft} onChange={(e) => setDraft(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40))}
              placeholder="throughhervoice" className="min-h-[44px] min-w-0 flex-1 rounded-r-xl bg-transparent pr-3 text-base text-gray-900 outline-none sm:text-sm" />
          </div>
          <p className="mt-1 text-xs text-gray-500">3 to 40 letters, numbers, or dashes. The old short link stops working once you change it.</p>
          <div className="mt-2 flex gap-2">
            <button onClick={save} disabled={busy || draft.length < 3 || draft === code} className="min-h-[40px] rounded-lg bg-marigold px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
            <button onClick={() => { setEditing(false); setDraft(code); }} className="min-h-[40px] rounded-lg border border-gray-300 px-4 text-sm text-gray-700">Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}
