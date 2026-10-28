import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import Sheet from '../scouting/Sheet';
import type { Place } from './PlacementPicker';

// Shop page (preview): "Sell something". Pick where it's sold (your artist/vendor profile or one of your events);
// the product form opens there, where you can add more places (shared stock). No profile or events yet: an
// invitation to set up a free artist/vendor profile.
export default function SellSomething() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [places, setPlaces] = useState<Place[] | null>(null);
  useEffect(() => { if (open && user) supabase.rpc('my_sell_places').then(({ data }) => setPlaces((data ?? []) as Place[])); }, [open, user]);
  const go = (p: Place) => { setOpen(false); navigate(`/products?tab=products&sell=${p.kind}:${p.id}`); };
  return (
    <>
      <button onClick={() => (user ? setOpen(true) : navigate('/login', { state: { from: '/products' } }))}
        className="min-h-[44px] shrink-0 rounded-full bg-marigold px-5 text-sm font-semibold text-white hover:bg-marigold/90">+ Sell something</button>
      {open && (
        <Sheet title={places && places.length === 0 ? 'Start selling on TapIN' : 'Where will you sell it?'} onClose={() => setOpen(false)}>
          {places === null ? <p className="py-6 text-center text-sm text-gray-500">Loading…</p> : places.length === 0 ? (
            <div className="text-center">
              <p className="text-4xl" aria-hidden="true">🛍️</p>
              <p className="mt-2 text-sm text-gray-700">Set up your free <strong>artist or vendor profile</strong> to sell merch, art, music, and more. It only takes a minute, and you can list your first product right after.</p>
              <Link to="/resources/new" onClick={() => setOpen(false)} className="mt-4 inline-block rounded-full bg-[#0F1B3D] px-5 py-3 text-sm font-semibold text-white">Set up my profile</Link>
              <p className="mt-3 text-xs text-gray-500">Hosting an event? Products can also be sold on your events.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-gray-600">Pick where it&apos;s sold. You can show it in more places on the next step, with one shared stock count.</p>
              {places.map((p) => (
                <button key={`${p.kind}:${p.id}`} onClick={() => go(p)} className="flex min-h-[56px] items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 text-left hover:border-marigold">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-lg" aria-hidden="true">{p.kind === 'event' ? '🎟️' : '🎤'}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-gray-900">{p.title}</span><span className="block truncate text-xs text-gray-500">{p.subtitle}</span></span>
                  <span className="text-gray-400" aria-hidden="true">›</span>
                </button>
              ))}
            </div>
          )}
        </Sheet>
      )}
    </>
  );
}
