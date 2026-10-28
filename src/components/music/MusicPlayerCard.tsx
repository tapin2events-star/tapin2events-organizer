import { Link } from 'react-router-dom';
import CdDisc from './CdDisc';
import { useState } from 'react';
import { fmtTime, usePlayer, type PlayerTrack } from '../../lib/player';
import { buyMusic, money, musicPrice } from '../../lib/musicBuy';
import { shareMusic } from '../../lib/musicShare';
import DonateSheet from './DonateSheet';

// The spinning CD player for an album (or a single): disc, play/pause, previous/next, a progress bar you can drag, and
// the track list. Everything plays through the app-wide player, so it keeps going in the mini player while browsing.
export interface Sale { kind: 'album' | 'track'; id: string; price: number; owned: boolean; mode?: 'paid' | 'donation'; amounts?: number[] }
export default function MusicPlayerCard({ title, subtitle, cover, tracks, link, compact = false, sale, trackSales, canSell: canSellIn = true, pagePath, mine: ownMusic = false, share, artist, autoDonate }: { title: string; subtitle?: string; cover?: string | null; tracks: PlayerTrack[]; link?: string; compact?: boolean; sale?: Sale | null; trackSales?: Record<string, Sale>; canSell?: boolean; pagePath?: string; mine?: boolean; share?: { kind: 'album' | 'track'; id: string } | null; artist?: string; autoDonate?: string | null }) {
  const canSell = canSellIn && !ownMusic;
  const p = usePlayer();
  const [err, setErr] = useState<string | null>(null);
  // Donate sheet: opens from a Donate button, or right away when handed off with ?donate=<kind>:<id>.
  const [donating, setDonating] = useState<Sale | null>(() => { if (!autoDonate) return null; const all = [sale, ...Object.values(trackSales ?? {})].filter(Boolean) as Sale[]; return all.find((x) => x.mode === 'donation' && `${x.kind}:${x.id}` === autoDonate) ?? null; });
  async function buy(sl: Sale) {
    if (sl.mode === 'donation') { setDonating(sl); return; }
    // Signed out on the web: guest checkout. In the phone app: the purchase continues on the web, signed in.
    setErr(null);
    const e = await buyMusic(sl.kind, sl.id, pagePath ?? window.location.pathname);
    if (e) setErr(e);
  }
  const buyLabel = (sl: Sale) => sl.mode === 'donation' ? (sl.owned ? '💛 Thanks for donating · donate again' : '💛 Donate') : sl.owned ? '✓ Yours' : `Buy ${sl.kind === 'album' ? 'album' : ''} ${money(sl.price)}`.replace(/\s+/g, ' ');
  const isBuyable = (sl: Sale) => sl.mode === 'donation' || sl.price > 0;
  const mine = p.current ? tracks.findIndex((t) => t.id === p.current!.id) : -1;
  const active = mine >= 0;
  const spinning = active && p.playing;
  const start = (i: number) => p.play(tracks, i);
  if (tracks.length === 0) return null;
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-4">
        <CdDisc cover={cover} spinning={spinning} size={compact ? 96 : 132} />
        <div className="min-w-0 flex-1">
          {link ? <Link to={link} className="block truncate font-display text-lg font-bold text-gray-900 hover:underline">{title}</Link> : <p className="truncate font-display text-lg font-bold text-gray-900">{title}</p>}
          {subtitle && <p className="truncate text-sm text-gray-500">{subtitle}</p>}
          {active && p.current && <p className="mt-1 truncate text-xs font-medium text-marigold">▶ {p.current.title}</p>}
          {ownMusic && sale && isBuyable(sale) && <p className="mt-2 inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">Your music · {sale.mode === 'donation' ? 'donation-based' : money(sale.price)}</p>}
          {sale && isBuyable(sale) && canSell && (
            <button onClick={() => (sale.mode === 'donation' || !sale.owned) && buy(sale)} disabled={sale.mode !== 'donation' && sale.owned} className={`mt-2 inline-flex min-h-[36px] items-center rounded-full px-4 text-xs font-semibold ${sale.owned && sale.mode !== 'donation' ? 'bg-green-100 text-green-800' : 'bg-marigold text-white hover:bg-marigold/90'}`}>{buyLabel(sale)}</button>
          )}
          {sale && sale.mode !== 'donation' && sale.price > 0 && !sale.owned && canSell && <p className="mt-1 text-[11px] text-gray-500">+ {money(musicPrice(sale.price).total - sale.price)} fees · artist gets 100% of the price · downloads included</p>}
          {sale && sale.mode === 'donation' && canSell && !sale.owned && <p className="mt-1 text-[11px] text-gray-500">Free to listen · any amount · 100% to the artist · donors get downloads</p>}
          <div className="mt-3 flex items-center gap-2">
            <button onClick={() => (active ? p.prev() : start(0))} aria-label="Previous" className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-800 hover:bg-gray-200">⏮</button>
            <button onClick={() => (active ? p.toggle() : start(0))} aria-label={spinning ? 'Pause' : 'Play'} className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0F1B3D] text-lg text-white hover:bg-[#1a2a5a]">{spinning ? '❚❚' : '▶'}</button>
            <button onClick={() => (active ? p.next() : start(Math.min(1, tracks.length - 1)))} aria-label="Next" className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-800 hover:bg-gray-200">⏭</button>
            {share && <button onClick={() => shareMusic(share.kind, share.id, title, artist ?? tracks[0]?.artist ?? '')} aria-label={`Share ${title}`} className="ml-auto flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-800 hover:bg-gray-200">↗</button>}
          </div>
        </div>
      </div>
      {active && p.current?.preview && (
        <p className="mt-2 text-xs font-medium text-amber-800">{p.previewEnded ? 'That was a 30-second preview. Buy it to hear the full song.' : '30-second preview'}</p>
      )}
      {err && <p role="alert" className="mt-2 text-sm text-red-600">{err}</p>}
      {active && (
        <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
          <span className="w-9 text-right">{fmtTime(p.progress)}</span>
          <input type="range" min={0} max={1000} value={p.duration ? Math.round((p.progress / p.duration) * 1000) : 0} onChange={(e) => p.seek(Number(e.target.value) / 1000)} aria-label="Position" className="h-1.5 flex-1 accent-marigold" />
          <span className="w-9">{fmtTime(p.duration)}</span>
        </div>
      )}
      <ol className="mt-3 divide-y divide-gray-100">
        {tracks.map((t, i) => {
          const on = p.current?.id === t.id;
          return (
            <li key={t.id}>
              <button onClick={() => (on ? p.toggle() : start(i))} className={`flex w-full items-center gap-3 py-2 text-left ${on ? 'text-marigold' : 'text-gray-800'}`} aria-label={`${on && p.playing ? 'Pause' : 'Play'} ${t.title}`}>
                <span className="w-5 text-center text-xs text-gray-400">{on && p.playing ? '▶' : i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.title}{t.preview ? <span className="ml-1 text-[10px] font-normal text-amber-700">preview</span> : null}</span>
                {t.duration_sec ? <span className="text-xs text-gray-400">{fmtTime(t.duration_sec)}</span> : null}
              </button>
              {trackSales?.[t.id] && isBuyable(trackSales[t.id]) && canSell && (() => { const ts = trackSales[t.id]; const don = ts.mode === 'donation'; return (
                <button onClick={() => (don || !ts.owned) && buy(ts)} disabled={!don && ts.owned} className={`mb-1 ml-8 inline-flex min-h-[28px] items-center rounded-full px-3 text-[11px] font-semibold ${!don && ts.owned ? 'bg-green-100 text-green-800' : 'border border-marigold text-marigold hover:bg-orange-50'}`}>{don ? '💛 Donate' : ts.owned ? '✓ Yours' : `Buy ${money(ts.price)}`}</button>
              ); })()}
            </li>
          );
        })}
      </ol>
      {donating && <DonateSheet kind={donating.kind} id={donating.id} title={donating.kind === 'album' ? title : (tracks.find((x) => x.id === donating.id)?.title ?? title)} artist={artist ?? tracks[0]?.artist ?? 'the artist'} amounts={donating.amounts ?? [5, 10, 20]} pagePath={pagePath ?? window.location.pathname} onClose={() => setDonating(null)} />}
    </div>
  );
}
