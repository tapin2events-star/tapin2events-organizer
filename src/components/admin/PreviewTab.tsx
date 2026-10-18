import { useEffect, useState } from 'react';
import UpgradePreview from './UpgradePreview';
import TestViewers from './TestViewers';
import { ListSkeleton } from '../ui/Skeleton';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { FEATURES, usePreviewMode } from '../../lib/preview';

// Where each preview feature lives (Open › links). eventTab: a tab on one of your events (test events first,
// preferring one whose title includes "match"); business: only business/nonprofit events; orgTab: organization settings.
const OPEN: Record<string, { path?: string; eventTab?: string; business?: boolean; org?: boolean; match?: string; orgTab?: string }> = {
  white_label: { eventTab: 'Overview', org: true, match: 'workshop' },
  video_headers: { eventTab: 'Overview' },
  promoter_payouts: { eventTab: 'Promote' },
  featured_perk: { path: '/' },
  splits: { eventTab: 'Sales' },
  billing: { path: '/business/plan#get-plan' },
  gala: { eventTab: 'Gala', match: 'gala' },
  program_v2: { eventTab: 'Business page', business: true, match: 'workshop' },
  workshops: { eventTab: 'Business page', business: true, match: 'workshop' },
  volunteers: { eventTab: 'Volunteers', match: 'volunteer' },
  newsletters: { orgTab: 'Audience' },
  promote: { eventTab: 'Promote' },
  networking: { path: '/network' },
  templates: { path: '/organizer/events/new' },
  invoices: { eventTab: 'Sales' },
  org_insights: { orgTab: 'Audience' },
  profile_qr: { path: '/profile' },
  business_plan_page: { path: '/business/plan' },
};

// Admin > Preview: try new features before anyone else, and manage private test events.
export default function PreviewTab() {
  const { enabled, setEnabled } = usePreviewMode();
  const [tests, setTests] = useState<{ id: string; title: string; start_date: string | null; status: string }[] | null>(null);
  useEffect(() => {
    supabase.from('events').select('id, title, start_date, status').eq('is_test', true).order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => setTests((data ?? []) as { id: string; title: string; start_date: string | null; status: string }[]));
  }, []);
  const previewList = Object.entries(FEATURES).filter(([, f]) => f.status === 'preview');
  // Where to try each feature: a page, a tab on one of your events, or a tab in your organization's settings.
  const [mine, setMine] = useState<{ events: { id: string; title: string; event_kind: string | null; is_test: boolean; organization_id: string | null }[]; org: { slug: string; name: string } | null } | null>(null);
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const email = u.user?.email ?? '';
      const [{ data: ev }, { data: orgs }] = await Promise.all([
        supabase.from('events').select('id, title, event_kind, is_test, organization_id').ilike('organizer_email', email).neq('status', 'cancelled').order('created_at', { ascending: false }).limit(40),
        supabase.rpc('my_organizations'),
      ]);
      const lead = ((orgs ?? []) as { slug: string; name: string; role: string; status?: string }[]).find((o) => (o.role === 'owner' || o.role === 'admin') && o.status !== 'deleted');
      setMine({ events: (ev ?? []) as { id: string; title: string; event_kind: string | null; is_test: boolean; organization_id: string | null }[], org: lead ? { slug: lead.slug, name: lead.name } : null });
    })();
  }, []);
  function openFor(key: string): { to: string; note: string } | null {
    const o = OPEN[key];
    if (!o || !mine) return null;
    if (o.path) return { to: o.path, note: '' };
    if (o.orgTab) return mine.org ? { to: `/business/${mine.org.slug}/manage?tab=${encodeURIComponent(o.orgTab)}`, note: mine.org.name } : null;
    const pool = mine.events.filter((e) => (!o.business || e.event_kind === 'business' || e.event_kind === 'nonprofit') && (!o.org || !!e.organization_id));
    const pick = pool.find((e) => e.is_test && o.match && e.title.toLowerCase().includes(o.match)) ?? pool.find((e) => e.is_test) ?? pool[0];
    return pick ? { to: `/organizer/events/${pick.id}?tab=${encodeURIComponent(o.eventTab ?? 'Overview')}`, note: pick.title } : null;
  }

  return (
    <div className="mt-6 flex max-w-3xl flex-col gap-6">
      <TestViewers />
      <UpgradePreview />
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
              {previewList.map(([k, f]) => {
                const open = openFor(k);
                return (
                  <li key={k} className="rounded-xl border border-gray-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0"><p className="text-sm font-medium text-gray-900">{f.name}</p><p className="text-xs text-gray-500">{f.description}</p></div>
                      {open && <Link to={open.to} onClick={() => { if (!enabled) setEnabled(true); }} className="shrink-0 rounded-lg bg-marigold px-3 py-1.5 text-xs font-semibold text-white">Open ›</Link>}
                    </div>
                    {open?.note && <p className="mt-1 text-[11px] text-gray-400">Opens in: {open.note}</p>}
                    {!open && mine && OPEN[k] && !OPEN[k].path && <p className="mt-1 text-[11px] text-gray-400">{OPEN[k].orgTab ? 'Create an organization to try this.' : OPEN[k].org ? 'Create an event hosted by your organization (or a test one) to try this.' : OPEN[k].business ? 'Create a business or nonprofit event (or a test one) to try this.' : 'Create an event (or a test one) to try this.'}</p>}
                  </li>
                );
              })}
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
