import { useCallback, useEffect, useState } from 'react';
import ShortLinkCard from './ShortLinkCard';
import CreatorProgramCard from './CreatorProgramCard';
import { useShareBase } from '../../lib/shareBase';
import PeopleInput from '../PeopleInput';
import LocalPartnersCard from '../nearby/LocalPartnersCard';
import WebsiteEmbedCard from './WebsiteEmbedCard';
import { useFeature } from '../../lib/preview';
import PromoterPayoutsCard from './PromoterPayouts';
import PremiumBadge, { PremiumNotice } from '../business/PremiumBadge';
import FeatureFeedback from '../feedback/FeatureFeedback';
import BoostCard from './BoostCard';
import { supabase } from '../../lib/supabaseClient';
import ShareQR from '../ShareQR';
import Sheet from '../scouting/Sheet';
import { ListSkeleton } from '../ui/Skeleton';

interface LinkRow { id: string; code: string; label: string; promoter_email: string | null; promoter_name: string | null; commission_pct: number | null; active: boolean; visits: number; visitors: number; tickets: number; revenue: number; archived?: boolean; used?: boolean }
interface Stats { links: LinkRow[]; other_tickets: number; other_revenue: number }
const money = (n: number) => `$${(Number(n) || 0).toFixed(2).replace(/\.00$/, '')}`;
const field = 'mt-1 block w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900';
export const shortUrl = (code: string, base?: string) => `${base ?? `${window.location.origin}${import.meta.env.BASE_URL}`}p/${code}`;
const IDEAS = ['Instagram bio', 'Facebook post', 'Flyer', 'Email newsletter', 'TikTok', 'Group chat'];

// Event > Promote (Preview): tracking links for each place you share the event, optionally for a promoter
// with a commission; visits, tickets and revenue per link.
export default function PromoteTab({ eventId }: { eventId: string }) {
  // White-labeled events with a connected domain share links on that domain.
  const base = useShareBase(eventId);
  const nearbyOn = useFeature('nearby');
  const payoutsOn = useFeature('promoter_payouts');
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
  const copy = (code: string) => { navigator.clipboard?.writeText(shortUrl(code, base)); flash('Link copied.'); };
  async function toggle(l: LinkRow) {
    await supabase.rpc('update_event_link', { p_link_id: l.id, p_label: l.label, p_active: !l.active });
    load();
  }
  // Paused links: delete if never used; otherwise archive (hidden and off, history kept).
  async function remove(l: LinkRow) {
    const ok = l.used
      ? window.confirm(`Archive "${l.label}"? It has visits or sales, so it's kept in Archived links with its history (sales and commission records stay). It stops tracking right away.`)
      : window.confirm(`Delete "${l.label}"? It was never used, so nothing is lost.`);
    if (!ok) return;
    const { data, error } = await supabase.rpc('remove_event_link', { p_link_id: l.id });
    if (error) return flash(error.message && !/function|permission/i.test(error.message) ? error.message : "Couldn't remove the link.");
    flash(data === 'archived' ? 'Link archived. Find it under Archived links.' : 'Link deleted.');
    load();
  }
  async function restore(l: LinkRow) {
    await supabase.rpc('restore_event_link', { p_link_id: l.id });
    flash('Link restored (paused). Tap Resume to turn it back on.');
    load();
  }

  const allLinks = stats?.links ?? [];
  const links = allLinks.filter((l) => !l.archived);
  const archivedLinks = allLinks.filter((l) => l.archived);
  const linkTickets = allLinks.reduce((n, l) => n + l.tickets, 0);
  const linkRevenue = allLinks.reduce((n, l) => n + l.revenue, 0);
  return (
    <div>
      <ShortLinkCard eventId={eventId} />
      <BoostCard eventId={eventId} />
      <CreatorProgramCard eventId={eventId} />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-display text-lg font-bold text-bone">📣 Promotion links <PremiumBadge feature="promotion_links" /></p>
          <PremiumNotice feature="Promotion links" featureKey="promotion_links" />
          <p className="mt-1 text-sm text-muted">Make a link for each place you share this event (or each promoter) and see which ones sell tickets.</p>
        </div>
        <button onClick={() => setCreating(true)} className="rounded-xl bg-marigold px-4 py-2 text-sm font-semibold text-white">+ New link</button>
      </div>
      {payoutsOn && stats && <PromoterPayoutsCard eventId={eventId} links={links} onLinksChanged={load} />}
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
                        <p className="truncate text-xs text-gray-400">{shortUrl(l.code, base).replace(/^https?:\/\//, '')}</p>
                      </div>
                      <p className="shrink-0 text-right text-sm"><span className="font-bold text-bone">{money(l.revenue)}</span><span className="block text-xs text-muted">{l.tickets} ticket{l.tickets === 1 ? '' : 's'}</span></p>
                    </div>
                    <p className="mt-1 text-xs text-muted">{l.visits} visit{l.visits === 1 ? '' : 's'} · {l.visitors} people · {conv}% bought{owed > 0 ? ` · ${money(owed)} commission owed` : ''}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      <button onClick={() => copy(l.code)} className="font-medium text-marigold">Copy link</button>
                      <ShareQR path={`/p/${l.code}`} eventId={eventId} title={l.label} subtitle="Scan for tickets" label="QR" className="font-medium text-marigold" />
                      <button onClick={() => toggle(l)} className="text-gray-500">{l.active ? 'Pause' : 'Resume'}</button>
                      {!l.active && <button onClick={() => remove(l)} className="text-gray-500 hover:text-red-600">{l.used ? 'Archive' : 'Delete'}</button>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {archivedLinks.length > 0 && (
            <details className="mt-4 rounded-2xl border border-gray-200 bg-surface p-3">
              <summary className="cursor-pointer text-sm font-semibold text-bone">Archived links ({archivedLinks.length})</summary>
              <p className="mt-1 text-xs text-muted">Turned off and hidden, with their sales and commission history kept. Their sales still count in your totals.</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {archivedLinks.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
                    <span className="min-w-0"><span className="block truncate font-medium text-gray-800">{l.label}</span><span className="block truncate text-xs text-gray-500">{l.promoter_email ? `Promoter: ${l.promoter_name || l.promoter_email} · ` : ''}{l.tickets} ticket{l.tickets === 1 ? '' : 's'} · {money(l.revenue)}</span></span>
                    <button onClick={() => restore(l)} className="shrink-0 text-xs font-medium text-marigold">Restore</button>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {links.filter((l) => !l.label.startsWith('🚀')).length > 0 && <FeatureFeedback feature="promotion_links" label="promotion links" className="mt-4" />}
          <p className="mt-3 text-sm text-muted">Not from a link: {stats.other_tickets} ticket{stats.other_tickets === 1 ? '' : 's'} · {money(stats.other_revenue)}</p>
          <p className="mt-1 text-xs text-muted">A ticket counts for a link when the buyer came through it within the last 7 days. Commissions are tracked here; pay promoters directly for now.</p>
        </>
      )}
      {creating && <NewLinkSheet eventId={eventId} onClose={() => setCreating(false)} onDone={(code) => { setCreating(false); navigator.clipboard?.writeText(shortUrl(code, base)); flash('Link created and copied.'); load(); }} />}
      {nearbyOn && <LocalPartnersCard eventId={eventId} />}
      <div className="mt-10"><WebsiteEmbedCard eventId={eventId} /></div>
    </div>
  );
}

function NewLinkSheet({ eventId, onClose, onDone }: { eventId: string; onClose: () => void; onDone: (code: string) => void }) {
  const [label, setLabel] = useState('');
  const [promoter, setPromoter] = useState(false);
  const [person, setPerson] = useState<{ id: string; full_name: string; profile_photo: string | null; payouts_ready: boolean } | null>(null);
  const [q, setQ] = useState('');
  const [byEmail, setByEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [pct, setPct] = useState('10');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function create() {
    const name = label.trim() || (promoter && person ? person.full_name : '');
    if (!name) return setErr('Name the link so you know where it was shared.');
    if (promoter && !person && !email.trim()) return setErr('Find the promoter on TapIN, or add them by email.');
    setBusy(true); setErr(null);
    const { data, error } = promoter
      ? await supabase.rpc('create_promoter_link', { p_event_id: eventId, p_label: name, p_user_id: person?.id ?? null, p_email: person ? null : email.trim(), p_commission: pct ? Number(pct) : null, p_resource_id: null })
      : await supabase.rpc('create_event_link', { p_event_id: eventId, p_label: name, p_promoter_email: null, p_commission: null });
    setBusy(false);
    if (error || !data) return setErr(error?.message && !/function|permission/i.test(error.message) ? error.message : "Couldn't create the link.");
    onDone((data as { code: string }).code);
  }
  return (
    <Sheet title="New promotion link" onClose={onClose}>
      <label className="flex items-start gap-3 text-sm text-gray-800">
        <input type="checkbox" checked={promoter} onChange={(e) => setPromoter(e.target.checked)} className="mt-0.5 h-5 w-5 accent-marigold" />
        <span><strong>This link is for a promoter</strong><span className="block text-xs text-gray-500">They'll see their own visits, sales and commission on TapIN.</span></span>
      </label>
      {promoter && (
        <div className="mt-3">
          {person ? (
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
              {person.profile_photo ? <img src={person.profile_photo} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600">{person.full_name.charAt(0)}</span>}
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-gray-900">{person.full_name}</span><span className={`block text-[11px] ${person.payouts_ready ? 'text-green-700' : 'text-gray-500'}`}>{person.payouts_ready ? '✓ Payouts connected' : 'Payouts not connected yet'}</span></span>
              <button onClick={() => setPerson(null)} className="text-xs text-gray-400">Change</button>
            </div>
          ) : byEmail ? (
            <label className="block text-xs font-medium text-gray-500">Promoter's email (not on TapIN yet)<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="promoter@email.com" className={field} autoFocus /></label>
          ) : (
            <PeopleInput eventId={eventId} value={q} onChange={setQ} autoFocus
              placeholder="Name: your people or anyone on TapIN" ariaLabel="Find the promoter" className={field}
              onPick={(p) => {
                if (p.user_id) { setPerson({ id: p.user_id, full_name: p.name, profile_photo: p.photo, payouts_ready: false }); setQ(''); }
                else if (p.email) { setEmail(p.email); setByEmail(true); setQ(''); }
              }} />
          )}
          {!person && <button type="button" onClick={() => setByEmail(!byEmail)} className="mt-2 text-xs font-medium text-marigold">{byEmail ? 'Search people on TapIN instead' : 'Not on TapIN? Add by email'}</button>}
          <label className="mt-3 block w-32 text-xs font-medium text-gray-500">Commission %<input value={pct} inputMode="decimal" onChange={(e) => setPct(e.target.value.replace(/[^0-9.]/g, ''))} className={field} /></label>
        </div>
      )}
      <label className="mt-4 block text-xs font-medium text-gray-500">{promoter ? 'Link name (optional)' : 'Where will you share it?'}<input value={label} maxLength={80} onChange={(e) => setLabel(e.target.value)} placeholder={promoter ? (person?.full_name ?? 'Promoter name') : 'Instagram bio'} className={field} /></label>
      {!promoter && <div className="mt-2 flex flex-wrap gap-1.5">{IDEAS.map((i) => <button key={i} type="button" onClick={() => setLabel(i)} className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-gray-700">{i}</button>)}</div>}
      {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
      <button onClick={create} disabled={busy} className="mt-4 w-full rounded-xl bg-marigold py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Creating…' : 'Create link'}</button>
    </Sheet>
  );
}
