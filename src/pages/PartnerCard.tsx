import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

// Printable counter card for a local partner: two per Letter page (cut in half), with their perk and the event.
interface CardData { name: string; perk: string; perk_details: string | null; event: { title: string; start_date: string | null; location: string | null } }

function Card({ d }: { d: CardData }) {
  const day = d.event.start_date ? new Date(d.event.start_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
  return (
    <section style={{ height: '5.49in', boxSizing: 'border-box', padding: '0.46in 0.55in 0', display: 'flex', flexDirection: 'column', fontFamily: "'Archivo','Helvetica Neue',Helvetica,sans-serif", color: '#0F1B3D' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.5 }}>TapIN</div>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.6, textTransform: 'uppercase', background: '#C9A227', padding: '7px 12px', borderRadius: 6 }}>Local partner</div>
      </div>
      <div style={{ marginTop: 24, fontSize: 22, fontWeight: 600, color: '#374151' }}>TapIN ticket holders get</div>
      <div style={{ marginTop: 6, fontSize: d.perk.length > 28 ? 46 : 60, lineHeight: 1.04, fontWeight: 800, letterSpacing: -1.2, overflowWrap: 'anywhere' }}>{d.perk}</div>
      {d.perk_details && <div style={{ marginTop: 8, fontSize: 18, color: '#374151' }}>{d.perk_details}</div>}
      <div style={{ marginTop: 10, fontSize: 20, color: '#374151' }}>at <strong style={{ color: '#0F1B3D' }}>{d.name}</strong> with your ticket to <strong style={{ color: '#0F1B3D' }}>{d.event.title}</strong>{day ? ` · ${day}` : ''}</div>
      <div style={{ marginTop: 'auto', margin: 'auto -0.55in 0', background: '#0F1B3D', color: '#fff', padding: '20px 0.55in', fontSize: 17, lineHeight: 1.45, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
        <div style={{ fontWeight: 700, color: '#C9A227', textTransform: 'uppercase', letterSpacing: 1.2, fontSize: 13 }}>For staff</div>
        Ask to see their TapIN ticket. When the perk shows <strong>Valid</strong>, tap <strong>Staff: tap to redeem</strong> on their screen.
      </div>
    </section>
  );
}

export default function PartnerCard() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<CardData | null | undefined>(undefined);
  useEffect(() => { supabase.rpc('partner_card', { p_partner_id: id }).then(({ data }) => setD((data ?? null) as CardData | null)); }, [id]);
  useEffect(() => { if (d) { document.title = `Counter card · ${d.name}`; const t = setTimeout(() => window.print(), 700); return () => clearTimeout(t); } }, [d]);
  if (d === undefined) return <p style={{ padding: 32, textAlign: 'center', fontFamily: 'sans-serif', color: '#6B7280' }}>Preparing your counter card…</p>;
  if (d === null) return <p style={{ padding: 32, textAlign: 'center', fontFamily: 'sans-serif', color: '#6B7280' }}>This counter card isn't available.</p>;
  return (
    <div style={{ background: '#fff' }}>
      <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&display=swap" rel="stylesheet" />
      <style>{'@page { size: letter; margin: 0 } body { margin: 0 } @media print { .no-print { display: none !important } }'}</style>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'center', gap: 12, padding: 12, background: '#F3F4F6', fontFamily: 'sans-serif' }}>
        <button onClick={() => window.print()} style={{ padding: '10px 18px', borderRadius: 10, border: 0, background: '#0F1B3D', color: '#fff', fontWeight: 700 }}>Print or save as PDF</button>
      </div>
      <div style={{ width: '8.5in', margin: '0 auto' }}>
        <Card d={d} />
        <div style={{ borderTop: '2px dashed #9CA3AF', position: 'relative' }}><span style={{ position: 'absolute', right: '0.55in', top: -11, background: '#fff', padding: '0 8px', fontSize: 12, fontWeight: 600, color: '#4B5563', fontFamily: 'sans-serif' }}>CUT ALONG THE LINE</span></div>
        <Card d={d} />
      </div>
    </div>
  );
}
