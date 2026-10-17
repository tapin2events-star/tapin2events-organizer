import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { reloadSetup } from '../lib/setup';
import { tourById } from '../lib/tours';

// "Show me" walkthrough engine: dims the screen around the real element, explains it in a big, plain card at the
// bottom, and waits for a tap (or Next). Works across pages; remembers where you are if the page reloads.
const KEY = 'tapin_tour';
const Ctx = createContext<{ start: (id: string) => void; active: boolean }>({ start: () => {}, active: false });
export const useTour = () => useContext(Ctx);

export function TourProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ id: string; step: number } | null>(() => { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { return null; } });
  useEffect(() => { try { if (state) sessionStorage.setItem(KEY, JSON.stringify(state)); else sessionStorage.removeItem(KEY); } catch { /* private mode */ } }, [state]);
  const start = useCallback((id: string) => { if (tourById(id)) setState({ id, step: 0 }); }, []);
  return (
    <Ctx.Provider value={{ start, active: !!state }}>
      {children}
      {state && <TourOverlay id={state.id} step={state.step} setStep={(n) => setState({ id: state.id, step: n })} end={() => setState(null)} />}
    </Ctx.Provider>
  );
}

function visible(el: Element) { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; }

function TourOverlay({ id, step, setStep, end }: { id: string; step: number; setStep: (n: number) => void; end: () => void }) {
  const tour = tourById(id)!;
  const s = tour.steps[Math.min(step, tour.steps.length - 1)];
  const navigate = useNavigate();
  const location = useLocation();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [done, setDone] = useState(false);
  const wentFor = useRef<string>('');
  const elRef = useRef<Element | null>(null);
  const last = step >= tour.steps.length - 1;

  // Open the step's page once.
  useEffect(() => {
    const key = `${id}:${step}`;
    if (!s.go || wentFor.current === key) return;
    wentFor.current = key;
    (async () => {
      let to = s.go!;
      if (to === 'org') {
        const { data } = await supabase.rpc('my_organizations');
        const o = ((data ?? []) as { slug: string; role: string }[]).find((x) => x.role === 'owner' || x.role === 'admin') ?? ((data ?? []) as { slug: string }[])[0];
        to = o ? `/business/${o.slug}/manage` : '/business';
      }
      if (location.pathname !== to) navigate(to);
    })();
  }, [id, step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Find the target (and keep the highlight in place as things move).
  useEffect(() => {
    let scrolled = false;
    const tick = () => {
      const el = Array.from(document.querySelectorAll(s.target)).find(visible) ?? null;
      elRef.current = el;
      if (el) {
        if (!scrolled) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); scrolled = true; }
        setRect(el.getBoundingClientRect());
      } else setRect(null);
    };
    tick();
    const t = setInterval(tick, 350);
    return () => clearInterval(t);
  }, [s.target, location.pathname, step]);

  const next = useCallback(() => {
    if (last) {
      setDone(true);
      supabase.rpc('mark_tour_done', { p_tour: id }).then(() => reloadSetup(), () => {});
      try { const d = new Set(JSON.parse(localStorage.getItem('tapin_tours_done') || '[]')); d.add(id); localStorage.setItem('tapin_tours_done', JSON.stringify([...d])); } catch { /* ignore */ }
    } else setStep(step + 1);
  }, [last, id, step, setStep]);

  // "click" steps: move on when the highlighted element is tapped.
  useEffect(() => {
    if (s.advance !== 'click') return;
    const onClick = (e: Event) => { const el = elRef.current; if (el && e.target instanceof Node && el.contains(e.target)) setTimeout(next, 250); };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [s.advance, next]);

  const pad = 8;
  const box = rect ? { top: Math.max(0, rect.top - pad), left: Math.max(0, rect.left - pad), width: rect.width + pad * 2, height: rect.height + pad * 2 } : null;
  const shade = 'fixed z-[2000] bg-black/55';
  return (
    <>
      {box && !done && (
        <>
          {/* dim everything except the highlighted element (which stays tappable) */}
          <div className={shade} style={{ top: 0, left: 0, right: 0, height: box.top }} />
          <div className={shade} style={{ top: box.top + box.height, left: 0, right: 0, bottom: 0 }} />
          <div className={shade} style={{ top: box.top, left: 0, width: box.left, height: box.height }} />
          <div className={shade} style={{ top: box.top, left: box.left + box.width, right: 0, height: box.height }} />
          <div className="pointer-events-none fixed z-[2001] rounded-2xl ring-4 ring-amber-300 transition-all" style={box} />
        </>
      )}
      <div role="dialog" aria-live="polite" aria-label={`Tutorial: ${tour.title}`} className="fixed inset-x-0 z-[2002] mx-auto max-w-lg px-3"
        style={rect && rect.top + rect.height / 2 > window.innerHeight * 0.5 ? { top: 'calc(4.25rem + env(safe-area-inset-top, 0px))' } : { bottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="rounded-3xl bg-white p-5 shadow-2xl ring-1 ring-black/10">
          {done ? (
            <>
              <p className="text-2xl" aria-hidden="true">🎉</p>
              <p className="mt-1 text-lg font-bold text-gray-900">Nice work! You finished “{tour.title}.”</p>
              <p className="mt-1 text-base text-gray-600">Find more tutorials anytime from the ? button at the top.</p>
              <div className="mt-4 flex gap-2">
                <button onClick={() => { end(); navigate('/tutorials'); }} className="flex-1 rounded-2xl border border-gray-300 py-3.5 text-base font-semibold text-gray-800">More tutorials</button>
                <button onClick={end} className="flex-1 rounded-2xl bg-marigold py-3.5 text-base font-bold text-white">Done</button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-marigold">{tour.title} · Step {step + 1} of {tour.steps.length}</p>
                <button onClick={end} className="rounded-lg px-2 py-1 text-sm font-medium text-gray-500">Exit</button>
              </div>
              <p className="mt-2 text-lg leading-relaxed text-gray-900">{s.text}</p>
              {!rect && <p className="mt-2 text-sm text-gray-500">Looking for it on this screen… If you don’t see it, tap Next.</p>}
              {rect && s.advance === 'click' && <p className="mt-2 text-sm font-medium text-amber-700">👆 Tap the highlighted area</p>}
              <div className="mt-4 flex gap-2">
                {step > 0 && <button onClick={() => setStep(step - 1)} className="rounded-2xl border border-gray-300 px-5 py-3.5 text-base font-semibold text-gray-800">Back</button>}
                <button onClick={next} className="flex-1 rounded-2xl bg-marigold py-3.5 text-base font-bold text-white">{last ? 'Finish' : 'Next'}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
