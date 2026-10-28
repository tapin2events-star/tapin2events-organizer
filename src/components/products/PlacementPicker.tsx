import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

// Sell anywhere (preview): where else a product appears, as a dropdown (with search once there are several places).
// Stock is shared: one count across every place.
export interface Place { kind: 'event' | 'resource'; id: string; title: string; subtitle: string }
export const placeKey = (p: { kind: string; id: string }) => `${p.kind}:${p.id}`;
export default function PlacementPicker({ homeKind, homeId, value, onChange }: { homeKind: 'event' | 'resource'; homeId: string; value: Set<string>; onChange: (v: Set<string>) => void }) {
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { supabase.rpc('my_sell_places').then(({ data }) => setPlaces(((data ?? []) as Place[]).filter((p) => !(p.kind === homeKind && p.id === homeId)))); }, [homeKind, homeId]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  if (!places || places.length === 0) return null;
  const picked = places.filter((p) => value.has(placeKey(p)));
  const toggle = (k: string) => { const n = new Set(value); if (n.has(k)) n.delete(k); else n.add(k); onChange(n); };
  const shown = places.filter((p) => !q || `${p.title} ${p.subtitle}`.toLowerCase().includes(q.toLowerCase()));
  const label = picked.length === 0 ? 'Choose places' : picked.length === 1 ? picked[0].title : `${picked[0].title} + ${picked.length - 1} more`;
  return (
    <div ref={box} className="relative">
      <p className="text-sm font-semibold text-gray-900">Also show this product on</p>
      <p className="text-xs text-gray-500">One stock count for every place: a sale anywhere lowers what&apos;s left everywhere.</p>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}
        className="mt-2 flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl border border-gray-300 bg-white px-3 text-left text-sm text-gray-900">
        <span className={`truncate ${picked.length ? '' : 'text-gray-500'}`}>{label}</span>
        <span className={`shrink-0 text-gray-400 transition ${open ? 'rotate-180' : ''}`} aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          {places.length > 5 && (
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your events and profile" autoFocus
              className="block w-full border-b border-gray-200 px-3 py-2.5 text-base text-gray-900 outline-none sm:text-sm" />
          )}
          <ul role="listbox" aria-multiselectable="true" className="max-h-64 overflow-y-auto py-1">
            {shown.length === 0 && <li className="px-3 py-2 text-sm text-gray-500">No matches</li>}
            {shown.map((p) => {
              const k = placeKey(p);
              const on = value.has(k);
              return (
                <li key={k}>
                  <button type="button" role="option" aria-selected={on} onClick={() => toggle(k)} className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm ${on ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${on ? 'border-marigold bg-marigold text-white' : 'border-gray-300'}`} aria-hidden="true">{on ? '✓' : ''}</span>
                    <span aria-hidden="true">{p.kind === 'event' ? '🎟️' : '🎤'}</span>
                    <span className="min-w-0"><span className="block truncate font-medium text-gray-900">{p.title}</span><span className="block truncate text-xs text-gray-500">{p.subtitle}</span></span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-gray-200 p-2 text-right">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg bg-[#0F1B3D] px-3 py-1.5 text-xs font-semibold text-white">Done</button>
          </div>
        </div>
      )}
      {picked.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {picked.map((p) => (
            <span key={placeKey(p)} className="inline-flex max-w-full items-center gap-1 rounded-full bg-indigo-50 py-1 pl-2.5 pr-1 text-xs font-medium text-indigo-800">
              <span className="truncate">{p.kind === 'event' ? '🎟️' : '🎤'} {p.title}</span>
              <button type="button" onClick={() => toggle(placeKey(p))} aria-label={`Remove ${p.title}`} className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-indigo-600 hover:bg-indigo-100">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
