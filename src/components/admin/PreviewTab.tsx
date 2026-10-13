import { useEffect, useState } from 'react';
import { ListSkeleton } from '../ui/Skeleton';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { FEATURES, usePreviewMode } from '../../lib/preview';

// Admin > Preview: try new features before anyone else, and manage private test events.
export default function PreviewTab() {
  const { enabled, setEnabled } = usePreviewMode();
  const [tests, setTests] = useState<{ id: string; title: string; start_date: string | null; status: string }[] | null>(null);
  useEffect(() => {
    supabase.from('events').select('id, title, start_date, status').eq('is_test', true).order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => setTests((data ?? []) as { id: string; title: string; start_date: string | null; status: string }[]));
  }, []);
  const previewList = Object.entries(FEATURES).filter(([, f]) => f.status === 'preview');

  return (
    <div className="mt-6 flex max-w-3xl flex-col gap-6">
      <section className="rounded-2xl border border-gray-200 bg-surface p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-bone">Preview mode</h2>
            <p className="mt-1 text-sm text-muted">See new features before they're turned on for everyone. Only admin accounts can do this, and it only affects this device.</p>
          </div>
          <button type="button" role="switch" aria-checked={enabled} aria-label="Preview mode" onClick={() => setEnabled(!enabled)}
            className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition ${enabled ? 'bg-marigold' : 'bg-gray-300'}`}>
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${enabled ? 'left-6' : 'left-1'}`} />
          </button>
        </div>
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Features in preview</p>
          {previewList.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Nothing in preview right now. When a new feature is ready for you to try first, it'll be listed here.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {previewList.map(([k, f]) => <li key={k} className="rounded-xl border border-gray-200 bg-white p-3"><p className="text-sm font-medium text-gray-900">{f.name}</p><p className="text-xs text-gray-500">{f.description}</p></li>)}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-bone">Test events</h2>
            <p className="mt-1 text-sm text-muted">Only you and an event's team can see test events. They never appear on Discover, search, profiles, or maps, and never trigger follower or lineup emails.</p>
          </div>
          <Link to="/organizer/new?test=1" className="rounded-xl bg-marigold px-4 py-2.5 text-sm font-semibold text-white">+ New test event</Link>
        </div>
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">Heads up: payments on test events are real (Stripe is live). For checkout tests, use a free event, or refund right after (Stripe's fees aren't returned).</p>
        {tests === null ? <ListSkeleton rows={4} className="mt-4" /> : tests.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No test events yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {tests.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-gray-900">{t.title}</span>
                  <span className="block text-xs text-gray-500">{t.start_date ? new Date(t.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No date'} · {t.status}</span>
                </span>
                <span className="flex shrink-0 gap-3 text-sm">
                  <Link to={`/events/${t.id}`} className="font-medium text-marigold">View</Link>
                  <Link to={`/organizer/events/${t.id}`} className="font-medium text-marigold">Manage</Link>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
