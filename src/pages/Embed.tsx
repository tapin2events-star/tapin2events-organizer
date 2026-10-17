import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

// Website embed (shown inside a frame on an organizer's own website): upcoming events list or one event's card.
interface EEvent { id: string; title: string; start_date: string | null; end_date: string | null; date_tbd: boolean | null; location: string | null; poster: string | null; free: boolean; price_from: number | null; sold_out: boolean; link: string | null }
interface Brand { primary?: string; accent?: string; font?: string }
const SITE = 'https://app.tapin2events.com';
const when = (e: EEvent) => (e.date_tbd || !e.start_date ? 'Date to be announced' : new Date(e.start_date).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).replace(':00 ', ' '));
const price = (e: EEvent) => (e.sold_out ? 'Sold out' : e.free ? 'Free' : e.price_from != null ? `From $${Number(e.price_from).toFixed(2).replace(/\.00$/, '')}` : '');
const href = (e: EEvent) => (e.link ? `${SITE}/p/${e.link}` : `${SITE}/events/${e.id}`);

export default function Embed() {
  const { slug, id } = useParams();
  const kind: 'org' | 'event' = slug ? 'org' : 'event';
  const q = new URLSearchParams(window.location.search);
  const frame = q.get('frame') ?? '';
  const layout = q.get('layout') === 'grid' ? 'grid' : q.get('layout') === 'calendar' ? 'calendar' : 'list';
  const dark = q.get('theme') === 'dark';
  const [data, setData] = useState<{ events: EEvent[]; brand: Brand; name: string; polish: boolean } | null | undefined>(undefined);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    document.documentElement.style.background = 'transparent'; document.body.style.background = 'transparent';
    (async () => {
      if (kind === 'org' && slug) {
        const { data: d } = await supabase.rpc('embed_org', { p_slug: slug });
        const r = d as { org: { name: string; brand: Brand }; polish: boolean; events: EEvent[] } | null;
        setData(r ? { events: r.events ?? [], brand: r.org.brand ?? {}, name: r.org.name, polish: !!r.polish } : null);
      } else if (kind === 'event' && id) {
        const { data: d } = await supabase.rpc('embed_event', { p_event_id: id });
        const r = d as { event: EEvent; org: { name: string; brand: Brand } | null; polish: boolean } | null;
        setData(r ? { events: [r.event], brand: r.org?.brand ?? {}, name: r.org?.name ?? '', polish: !!r.polish } : null);
      }
    })();
  }, [kind, slug, id]);
  // Tell the page around us how tall we are.
  useEffect(() => {
    if (!root.current) return;
    const send = () => window.parent?.postMessage({ tapinEmbed: true, frame, height: root.current?.scrollHeight ?? 0 }, '*');
    const ro = new ResizeObserver(send); ro.observe(root.current); send();
    return () => ro.disconnect();
  }, [data, frame]);
  const useBrand = !!data?.polish && q.get('brand') === '1';
  const showBadge = !(data?.polish && q.get('badge') === '0');
  const btn = useBrand ? (data?.brand.primary || '#4F46E5') : '#4F46E5';
  const font = useBrand && data?.brand.font ? `'${data.brand.font}', system-ui, sans-serif` : 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  const text = dark ? '#F9FAFB' : '#111827';
  const sub = dark ? '#9CA3AF' : '#6B7280';
  const card = dark ? 'rgba(255,255,255,0.06)' : '#FFFFFF';
  const line = dark ? 'rgba(255,255,255,0.12)' : '#E5E7EB';
  const Btn = ({ e, full }: { e: EEvent; full?: boolean }) => (
    <a href={href(e)} target="_blank" rel="noopener" style={{ display: 'inline-block', width: full ? '100%' : undefined, textAlign: 'center', background: e.sold_out ? '#9CA3AF' : btn, color: '#fff', borderRadius: 12, padding: '10px 16px', fontWeight: 700, fontSize: 14, textDecoration: 'none', pointerEvents: e.sold_out ? 'none' : 'auto' }}>{e.sold_out ? 'Sold out' : e.free ? 'Get free tickets' : 'Get tickets'}</a>
  );
  const Row = ({ e }: { e: EEvent }) => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: card, border: `1px solid ${line}`, borderRadius: 16, padding: 10 }}>
      {e.poster ? <img src={e.poster} alt="" style={{ width: 72, height: 72, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} /> : <div style={{ width: 72, height: 72, borderRadius: 12, background: line, flexShrink: 0 }} />}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 700, color: text, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</div>
        <div style={{ color: sub, fontSize: 13 }}>{when(e)}{e.location ? ` · ${e.location}` : ''}</div>
        <div style={{ color: sub, fontSize: 13, fontWeight: 600 }}>{price(e)}</div>
      </div>
      <div style={{ flexShrink: 0 }}><Btn e={e} /></div>
    </div>
  );
  const Tile = ({ e }: { e: EEvent }) => (
    <div style={{ background: card, border: `1px solid ${line}`, borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {e.poster ? <img src={e.poster} alt="" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }} /> : <div style={{ width: '100%', aspectRatio: '16/9', background: line }} />}
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        <div style={{ fontWeight: 700, color: text, fontSize: 15 }}>{e.title}</div>
        <div style={{ color: sub, fontSize: 13 }}>{when(e)}</div>
        {e.location && <div style={{ color: sub, fontSize: 13 }}>{e.location}</div>}
        <div style={{ color: sub, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{price(e)}</div>
        <div style={{ marginTop: 'auto' }}><Btn e={e} full /></div>
      </div>
    </div>
  );
  const months = new Map<string, EEvent[]>();
  for (const e of data?.events ?? []) { const k = e.start_date && !e.date_tbd ? new Date(e.start_date).toLocaleString('en-US', { month: 'long', year: 'numeric' }) : 'Date to be announced'; months.set(k, [...(months.get(k) ?? []), e]); }
  return (
    <div ref={root} style={{ fontFamily: font, padding: 4 }}>
      {data === undefined ? <div style={{ color: sub, fontSize: 14, padding: 16 }}>Loading events…</div>
        : data === null ? <div style={{ color: sub, fontSize: 14, padding: 16 }}>This calendar isn't available.</div>
        : kind === 'event' ? (data.events[0] ? <Tile e={data.events[0]} /> : null)
        : data.events.length === 0 ? <div style={{ color: sub, fontSize: 14, padding: 16, border: `1px dashed ${line}`, borderRadius: 16, textAlign: 'center' }}>No upcoming events right now. Check back soon!</div>
        : layout === 'grid' ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>{data.events.map((e) => <Tile key={e.id} e={e} />)}</div>
        : layout === 'calendar' ? <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{[...months.entries()].map(([m, list]) => (
            <div key={m}><div style={{ color: text, fontWeight: 800, fontSize: 16, marginBottom: 8 }}>{m}</div><div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{list.map((e) => <Row key={e.id} e={e} />)}</div></div>
          ))}</div>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{data.events.map((e) => <Row key={e.id} e={e} />)}</div>}
      {data && showBadge && <div style={{ textAlign: 'right', marginTop: 8 }}><a href={SITE} target="_blank" rel="noopener" style={{ color: sub, fontSize: 11, textDecoration: 'none' }}>Tickets by <strong>TapIN</strong></a></div>}
    </div>
  );
}
