import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

interface Status { on: boolean; has_org: boolean; org_name: string | null; pending: boolean; is_admin: boolean; price: number }

// Event dashboard > Overview (Preview): white-label this event for $299 (or, for TapIN admins, turn it on to test).
export default function WhiteLabelCard({ eventId }: { eventId: string }) {
  const [st, setSt] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(async () => {
    const { data } = await supabase.rpc('white_label_status', { p_event_id: eventId });
    setSt((data ?? null) as Status | null);
  }, [eventId]);
  useEffect(() => {
    (async () => {
      if (new URLSearchParams(window.location.search).get('white_label') === 'done') {
        await supabase.functions.invoke('business-plan', { body: { action: 'sync_event', event_id: eventId } }).catch(() => {});
        setMsg({ ok: true, text: '🎉 This event is white-labeled. Attendees now see only your brand.' });
      }
      load();
    })();
  }, [eventId, load]);
  if (!st) return null;
  async function buy() {
    setBusy(true); setMsg(null);
    const { data, error } = await supabase.functions.invoke('business-plan', { body: { action: 'white_label_checkout', event_id: eventId, returnBase: `${window.location.origin}${import.meta.env.BASE_URL}` } });
    if (data?.url) { window.location.href = data.url; return; }
    let m = "Couldn't start checkout. Please try again.";
    try { const j = await (error as { context?: Response })?.context?.json(); if (j?.error) m = j.error; } catch { /* default */ }
    setBusy(false); setMsg({ ok: false, text: m });
  }
  async function adminToggle(on: boolean) {
    setBusy(true);
    const { error } = await supabase.rpc('set_event_white_label', { p_event_id: eventId, p_on: on });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    setMsg({ ok: true, text: on ? 'White-label is on (admin test, no charge).' : 'White-label is off.' });
    load();
  }
  return (
    <section className="mb-4 rounded-2xl border border-gray-200 bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-bone">🏷️ White-label <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700">Preview</span></p>
          <p className="text-sm text-muted">{st.on
            ? `On: attendees see only ${st.org_name ?? 'your organization'}'s brand on this event's page and tickets. No TapIN menu or branding.`
            : `Show only ${st.org_name ?? 'your organization'}'s brand on this event's page and tickets: your logo and colors, with no TapIN menu or branding. One-time $${st.price} for this event.`}</p>
        </div>
        {st.on ? <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">✓ White-labeled</span> : null}
      </div>
      {msg && <p role="status" className={`mt-3 rounded-xl px-3 py-2 text-sm ${msg.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{msg.text}</p>}
      {!st.has_org ? (
        <p className="mt-3 text-sm text-amber-800">White-label uses an organization's brand kit, so the event needs to be hosted by an organization first (Edit event → hosting organization).</p>
      ) : !st.on && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={buy} disabled={busy || st.pending} className="rounded-xl bg-[#0F1B3D] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{st.pending ? 'Payment processing…' : busy ? 'Opening checkout…' : `White-label this event · $${st.price}`}</button>
          {st.is_admin && <button onClick={() => adminToggle(true)} disabled={busy} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700">Turn on (admin test, no charge)</button>}
        </div>
      )}
      {st.on && st.is_admin && <button onClick={() => adminToggle(false)} disabled={busy} className="mt-3 text-xs text-gray-500 underline">Turn off (admin)</button>}
    </section>
  );
}
