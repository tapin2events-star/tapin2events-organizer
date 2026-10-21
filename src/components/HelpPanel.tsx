import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { GUIDES, GUIDE_TOURS, areasFor, type Guide, type HelpArea } from '../lib/helpGuides';
import { useTour } from './TourGuide';
import { useEscapeKey } from '../lib/useEscapeKey';

const AREA_LABEL: Record<HelpArea, string> = { start: 'Getting started', attendee: 'Going to events', artist: 'Artists & services', organizer: 'Organizing events', organization: 'Organizations', payments: 'Payments' };
const ORDER: HelpArea[] = ['start', 'attendee', 'artist', 'organizer', 'organization', 'payments'];

// The "?" button and the help panel: short guides, starting with the ones that fit the current screen.
export default function HelpButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Help and guides" className="rounded-lg p-2 text-muted hover:bg-gray-100">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5" /><path d="M9.5 9.2a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.3-2.5 3.9" /><circle cx="12" cy="17.2" r="0.6" fill="currentColor" /></svg>
      </button>
      {/* Drawn at the top level of the page: inside the desktop sidebar it would be clipped. */}
      {open && createPortal(<HelpPanel onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function HelpPanel({ onClose }: { onClose: () => void }) {
  const location = useLocation();
  const [q, setQ] = useState('');
  const [guide, setGuide] = useState<Guide | null>(null);
  const { start } = useTour();
  useEscapeKey(onClose, true);
  useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = ''; }; }, []);
  const here = areasFor(location.pathname);
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return null;
    return GUIDES.filter((g) => `${g.title} ${g.keywords ?? ''} ${g.steps.join(' ')}`.toLowerCase().includes(t));
  }, [q]);
  const sections = [...here, ...ORDER.filter((a) => !here.includes(a))];
  return (
    <div className="fixed inset-0 z-[1300] flex justify-end bg-black/40" onClick={onClose} role="dialog" aria-label="Help">
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-xl" onClick={(e) => e.stopPropagation()} style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-4 py-3">
          {guide ? <button onClick={() => setGuide(null)} className="text-sm font-medium text-marigold">‹ All guides</button> : <p className="font-display text-lg font-bold text-gray-900">Help & guides</p>}
          <button onClick={onClose} aria-label="Close help" className="rounded-lg px-2 py-1 text-2xl leading-none text-gray-500 hover:bg-gray-100">×</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {guide ? (
            <article>
              <p className="text-xs font-semibold uppercase tracking-wide text-marigold">{AREA_LABEL[guide.area]}</p>
              <h2 className="mt-1 font-display text-2xl font-extrabold text-gray-900">{guide.title}</h2>
              <ol className="mt-4 flex flex-col gap-3">
                {guide.steps.map((s, i) => (
                  <li key={i} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-marigold">{i + 1}</span><span className="pt-0.5 text-[15px] leading-relaxed text-gray-800">{s}</span></li>
                ))}
              </ol>
              <div className="mt-6 flex flex-wrap gap-2">
                {GUIDE_TOURS[guide.id] && <button onClick={() => { onClose(); start(GUIDE_TOURS[guide.id]); }} className="rounded-xl bg-marigold px-4 py-3 text-base font-semibold text-white">👆 Show me</button>}
                {guide.link && <Link to={guide.link.to} onClick={onClose} className="rounded-xl border border-gray-300 px-4 py-3 text-base font-semibold text-gray-800">{guide.link.label} ›</Link>}
              </div>
            </article>
          ) : (
            <>
              <Link to="/tutorials" onClick={onClose} className="mb-3 flex items-center justify-between rounded-2xl bg-indigo-50 px-4 py-3 text-base font-semibold text-marigold"><span>📚 Step-by-step tutorials</span><span aria-hidden="true">›</span></Link>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search help (tickets, payouts, splits…)" aria-label="Search help" className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900" />
              {results ? (
                results.length ? <GuideList guides={results} onPick={setGuide} /> : <p className="mt-4 text-sm text-gray-500">No guides match that. Try another word, or contact support below.</p>
              ) : sections.map((a, i) => {
                const list = GUIDES.filter((g) => g.area === a);
                if (!list.length) return null;
                return (
                  <section key={a} className="mt-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{i === 0 ? `For this screen · ${AREA_LABEL[a]}` : AREA_LABEL[a]}</p>
                    <GuideList guides={list} onPick={setGuide} />
                  </section>
                );
              })}
            </>
          )}
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-gray-200 bg-white px-4 pt-3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
          <Link to="/welcome" onClick={onClose} className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl border border-gray-300 bg-white px-2 text-center text-sm font-semibold text-gray-800 active:bg-gray-50">👋 Replay welcome setup</Link>
          <a href="mailto:support@tapin2events.com" className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl bg-marigold px-2 text-center text-sm font-semibold text-white active:opacity-90">✉️ Contact support</a>
        </div>
      </div>
    </div>
  );
}

function GuideList({ guides, onPick }: { guides: Guide[]; onPick: (g: Guide) => void }) {
  return (
    <ul className="mt-2 divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
      {guides.map((g) => (
        <li key={g.id}><button onClick={() => onPick(g)} className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left text-sm text-gray-900 hover:bg-gray-50"><span>{g.title}</span><span className="text-gray-400" aria-hidden="true">›</span></button></li>
      ))}
    </ul>
  );
}
