import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

interface Status { on: boolean; has_org: boolean; org_name: string | null; org_slug?: string | null; pending: boolean; is_admin: boolean; price: number; included?: boolean }

// Event dashboard > Overview (Preview): white-label this event: included with the organization's White-label pack
// ($99/month), or $199 for this event ($149 on Agency). TapIN admins can turn it on to test.
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
      const q = new URLSearchParams(window.location.search);
      if (q.get('white_label') === 'cancelled') {
        // Came back from Stripe without paying: cancel that checkout so the button resets.
        await supabase.functions.invoke('business-plan', { body: { action: 'cancel_pending', event_id: eventId, kind: 'white_label' } }).catch(() => {});
        q.delete('white_label');
        const u = new URL(window.location.href); u.search = q.toString();
        window.history.replaceState(window.history.state, '', u.pathname + u.search + u.hash);
      }
      if (q.get('white_label') === 'done') {
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
    setMsg({ ok: true, text: on ? (st?.included ? 'White-label is on (included with your White-label pack).' : 'White-label is on (admin test, no charge).') : 'White-label is off.' });
    load();
  }
  return (
    <section className="mb-4 rounded-2xl border border-gray-200 bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-bone">🏷️ White-label <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700">Preview</span></p>
          <p className="text-sm text-muted">{st.on
            ? `On: attendees see only ${st.org_name ?? 'your organization'}'s brand on this event's page and tickets. No TapIN menu or branding.`
            : `Show only ${st.org_name ?? 'your organization'}'s brand on this event's page, tickets, emails and sign-in: your logo and colors, with no TapIN menu or branding.${st.included ? ' Included with your White-label pack.' : ` One-time $${st.price} for this event.`}`}</p>
        </div>
        {st.on ? <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">✓ White-labeled</span> : null}
      </div>
      {msg && <p role="status" className={`mt-3 rounded-xl px-3 py-2 text-sm ${msg.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{msg.text}</p>}
      {!st.has_org ? (
        <p className="mt-3 text-sm text-amber-800">White-label uses an organization's brand kit, so the event needs to be hosted by an organization first (Edit event → hosting organization).</p>
      ) : !st.on && (
        <div className="mt-3 flex flex-wrap gap-2">
          {st.pending && <p className="w-full text-xs text-amber-800">A checkout was started in the last 30 minutes. If you already paid, this updates in a moment.</p>}
          {st.included ? (
            <button onClick={() => adminToggle(true)} disabled={busy} className="rounded-xl bg-[#0F1B3D] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Turning on…' : 'Turn on white-label'}</button>
          ) : (<>
          <button onClick={buy} disabled={busy} className="rounded-xl bg-[#0F1B3D] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Opening checkout…' : st.pending ? "Didn't finish? Start over" : `White-label this event · $${st.price}`}</button>
          {st.is_admin && <button onClick={() => adminToggle(true)} disabled={busy} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700">Turn on (admin test, no charge)</button>}
          <p className="w-full text-xs text-muted">Hosting often? The <a href="/business/plan?pack=white_label" className="font-semibold text-marigold underline">White-label pack</a> ($99/month) covers every event, plus your own web address.</p>
          </>)}
        </div>
      )}
      {st.on && (st.is_admin || st.included) && <button onClick={() => adminToggle(false)} disabled={busy} className="mt-3 text-xs text-gray-500 underline">Turn off white-label{st.is_admin && !st.included ? ' (admin)' : ''}</button>}
    </section>
  );
}
