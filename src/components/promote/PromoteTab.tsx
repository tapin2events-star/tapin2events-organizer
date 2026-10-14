import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import ShareQR from '../ShareQR';
import Sheet from '../scouting/Sheet';
import { ListSkeleton } from '../ui/Skeleton';

interface LinkRow { id: string; code: string; label: string; promoter_email: string | null; promoter_name: string | null; commission_pct: number | null; active: boolean; visits: number; visitors: number; tickets: number; revenue: number }
interface Stats { links: LinkRow[]; other_tickets: number; other_revenue: number }
const money = (n: number) => `$${(Number(n) || 0).toFixed(2).replace(/\.00$/, '')}`;
const field = 'mt-1 block w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900';
export const shortUrl = (code: string) => `${window.location.origin}${import.meta.env.BASE_URL}p/${code}`;
const IDEAS = ['Instagram bio', 'Facebook post', 'Flyer', 'Email newsletter', 'TikTok', 'Group chat'];

// Event > Promote (Preview): tracking links for each place you share the event, optionally for a promoter
// with a commission; visits, tickets and revenue per link.
export default function PromoteTab({ eventId }: { eventId: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => {
    const { data } = await supabase.rpc('event_link_stats', { p_event_id: eventId });
    const d = (data ?? { links: [], other_tickets: 0, other_revenue: 0 }) as Stats;
    setStats({ ...d, links: (d.links ?? []).map((l) => ({ ...l, visits: Number(l.visits), visitors: Number(l.visitors), tickets: Number(l.tickets), revenue: Number(l.revenue), commission_pct: l.commission_pct === null ? null : Number(l.commission_pct) })) });
  }, [eventId]);
  useEffect(() => { load(); }, [load]);
  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(null), 2500); };
  const copy = (code: string) => { navigator.clipboard?.writeText(shortUrl(code)); flash('Link copied.'); };
  async function toggle(l: LinkRow) {
    await supabase.rpc('update_event_link', { p_link_id: l.id, p_label: l.label, p_active: !l.active });
    load();
  }

  const links = stats?.links ?? [];
  const linkTickets = links.reduce((n, l) => n + l.tickets, 0);
  const linkRevenue = links.reduce((n, l) => n + l.revenue, 0);
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-display text-lg font-bold text-bone">📣 Promotion links <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700">Preview</span></p>
          <p className="text-sm text-muted">Make a link for each place you share this event (or each promoter) and see which ones sell tickets.</p>
        </div>
        <button onClick={() => setCreating(true)} className="rounded-xl bg-marigold px-4 py-2 text-sm font-semibold text-white">+ New link</button>
      </div>
      {msg && <p role="status" className="mt-2 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">{msg}</p>}

      {stats === null ? <ListSkeleton rows={3} className="mt-4" /> : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-gray-200 bg-surface p-3"><p className="text-xl font-extrabold text-bone">{links.reduce((n, l) => n + l.visits, 0)}</p><p className="text-xs text-muted">link visits</p></div>
            <div className="rounded-xl border border-gray-200 bg-surface p-3"><p className="text-xl font-extrabold text-bone">{linkTickets}</p><p className="text-xs text-muted">tickets from links</p></div>
            <div className="rounded-xl border border-gray-200 bg-surface p-3"><p className="text-xl font-extrabold text-bone">{money(linkRevenue)}</p><p className="text-xs text-muted">from links</p></div>
          </div>

          {links.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-muted">
              No links yet. Make one for your Instagram bio, a flyer, or a promoter.
              <div className="mt-3"><button onClick={() => setCreating(true)} className="rounded-xl bg-marigold px-4 py-2 text-sm font-semibold text-white">Create your first link</button></div>
            </div>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {links.map((l) => {
                const conv = l.visitors > 0 ? Math.round((l.tickets / l.visitors) * 100) : 0;
                const owed = l.commission_pct ? (l.revenue * l.commission_pct) / 100 : 0;
                return (
                  <li key={l.id} className={`rounded-2xl border bg-surface p-3 ${l.active ? 'border-gray-200' : 'border-gray-200 opacity-60'}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-bone">{l.label}{!l.active && <span className="ml-1.5 rounded bg-gray-200 px-1.5 text-[10px] font-bold text-gray-600">PAUSED</span>}</p>
                        {l.promoter_email && <p className="truncate text-xs text-muted">Promoter: {l.promoter_name || l.promoter_email}{l.commission_pct ? ` · ${l.commission_pct}% commission` : ''}</p>}
                        <p className="truncate text-xs text-gray-400">{shortUrl(l.code).replace(/^https?:\/\//, '')}</p>
                      </div>
                      <p className="shrink-0 text-right text-sm"><span className="font-bold text-bone">{money(l.revenue)}</span><span className="block text-xs text-muted">{l.tickets} ticket{l.tickets === 1 ? '' : 's'}</span></p>
                    </div>
                    <p className="mt-1 text-xs text-muted">{l.visits} visit{l.visits === 1 ? '' : 's'} · {l.visitors} people · {conv}% bought{owed > 0 ? ` · ${money(owed)} commission owed` : ''}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      <button onClick={() => copy(l.code)} className="font-medium text-marigold">Copy link</button>
                      <ShareQR path={`/p/${l.code}`} title={l.label} subtitle="Scan for tickets" label="QR" className="font-medium text-marigold" />
                      <button onClick={() => toggle(l)} className="text-gray-500">{l.active ? 'Pause' : 'Resume'}</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-sm text-muted">Not from a link: {stats.other_tickets} ticket{stats.other_tickets === 1 ? '' : 's'} · {money(stats.other_revenue)}</p>
          <p className="mt-1 text-xs text-muted">A ticket counts for a link when the buyer came through it within the last 7 days. Commissions are tracked here; pay promoters directly for now.</p>
        </>
      )}
      {creating && <NewLinkSheet eventId={eventId} onClose={() => setCreating(false)} onDone={(code) => { setCreating(false); navigator.clipboard?.writeText(shortUrl(code)); flash('Link created and copied.'); load(); }} />}
    </div>
  );
}

function NewLinkSheet({ eventId, onClose, onDone }: { eventId: string; onClose: () => void; onDone: (code: string) => void }) {
  const [label, setLabel] = useState('');
  const [promoter, setPromoter] = useState(false);
  const [email, setEmail] = useState('');
  const [pct, setPct] = useState('10');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function create() {
    if (!label.trim()) return setErr('Name the link so you know where it was shared.');
    setBusy(true); setErr(null);
    const { data, error } = await supabase.rpc('create_event_link', { p_event_id: eventId, p_label: label.trim(), p_promoter_email: promoter ? email.trim() : null, p_commission: promoter && pct ? Number(pct) : null });
    setBusy(false);
    if (error || !data) return setErr(error?.message && !/function|permission/i.test(error.message) ? error.message : "Couldn't create the link.");
    onDone((data as { code: string }).code);
  }
  return (
    <Sheet title="New promotion link" onClose={onClose}>
      <label className="block text-xs font-medium text-gray-500">Where will you share it?<input value={label} maxLength={80} onChange={(e) => setLabel(e.target.value)} placeholder="Instagram bio" className={field} autoFocus /></label>
      <div className="mt-2 flex flex-wrap gap-1.5">{IDEAS.map((i) => <button key={i} type="button" onClick={() => setLabel(i)} className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-gray-700">{i}</button>)}</div>
      <label className="mt-4 flex items-start gap-3 text-sm text-gray-800">
        <input type="checkbox" checked={promoter} onChange={(e) => setPromoter(e.target.checked)} className="mt-0.5 h-5 w-5 accent-marigold" />
        <span><strong>This link is for a promoter</strong><span className="block text-xs text-gray-500">They'll see their own visits, sales and commission on TapIN.</span></span>
      </label>
      {promoter && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <label className="col-span-2 block min-w-0 text-xs font-medium text-gray-500">Promoter's email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="promoter@email.com" className={field} /></label>
          <label className="block min-w-0 text-xs font-medium text-gray-500">Commission %<input value={pct} inputMode="decimal" onChange={(e) => setPct(e.target.value.replace(/[^0-9.]/g, ''))} className={field} /></label>
        </div>
      )}
      {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
      <button onClick={create} disabled={busy} className="mt-4 w-full rounded-xl bg-marigold py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Creating…' : 'Create link'}</button>
    </Sheet>
  );
}
