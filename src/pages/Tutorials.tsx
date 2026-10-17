import { Link } from 'react-router-dom';
import { useSetup, effectiveRoles, type Role } from '../lib/setup';
import { TOURS, ROLE_TITLES } from '../lib/tours';
import { useTour } from '../components/TourGuide';
import BackButton from '../components/BackButton';

// Step-by-step tutorials, grouped by what someone uses TapIN for (their roles come first), with checkmarks.
export default function Tutorials() {
  const setup = useSetup();
  const { start } = useTour();
  const mine = effectiveRoles(setup);
  if (mine.has('services')) mine.add('artist');
  let doneLocal: string[] = [];
  try { doneLocal = JSON.parse(localStorage.getItem('tapin_tours_done') || '[]'); } catch { /* ignore */ }
  const done = new Set([...(setup?.tours_done ?? []), ...doneLocal]);
  const order: Role[] = ['attendee', 'artist', 'organizer', 'organization'];
  const sorted = [...order.filter((r) => mine.has(r)), ...order.filter((r) => !mine.has(r))];
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-3"><BackButton fallback="/" fallbackLabel="Discover" /></div>
      <h1 className="font-display text-3xl font-extrabold text-bone">📚 Tutorials</h1>
      <p className="mt-1 text-base text-muted">Tap <strong>Show me</strong> and TapIN walks you through it on the real screen, one step at a time.</p>
      {sorted.map((r, i) => {
        const tours = TOURS.filter((t) => t.role === r);
        const isMine = mine.has(r);
        return (
          <section key={r} className="mt-8">
            <h2 className="font-display text-xl font-bold text-bone">{ROLE_TITLES[r]}{isMine && <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 align-middle text-xs font-semibold text-marigold">For you</span>}</h2>
            {i === order.filter((x) => mine.has(x)).length && i > 0 && <p className="text-sm text-muted">More you can do on TapIN</p>}
            <ul className="mt-3 flex flex-col gap-2.5">
              {tours.map((t) => (
                <li key={t.id} className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-surface p-4">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-bold ${done.has(t.id) ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'}`} aria-label={done.has(t.id) ? 'Done' : 'Not done yet'}>{done.has(t.id) ? '✓' : t.steps.length}</span>
                  <span className="min-w-0 flex-1"><span className="block text-base font-semibold text-bone">{t.title}</span><span className="block text-sm text-muted">{t.summary} · {t.steps.length} step{t.steps.length === 1 ? '' : 's'}</span></span>
                  <button onClick={() => start(t.id)} className="shrink-0 rounded-xl bg-marigold px-4 py-3 text-base font-semibold text-white">{done.has(t.id) ? 'Again' : 'Show me'}</button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <div className="mt-10 rounded-2xl bg-gray-50 p-4 text-sm text-gray-700">
        Need bigger text or a simpler menu? <Link to="/profile#display" className="font-semibold text-marigold">Display settings ›</Link>
      </div>
    </div>
  );
}
