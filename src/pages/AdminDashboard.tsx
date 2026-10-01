import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import OverviewTab from '../components/admin/OverviewTab';
import EventsTab from '../components/admin/EventsTab';
import ResourcesTab from '../components/admin/ResourcesTab';
import ProductsTab from '../components/admin/ProductsTab';
import UsersTab from '../components/admin/UsersTab';
import PaymentsTab from '../components/admin/PaymentsTab';
import ReportsTab from '../components/admin/ReportsTab';
import ActivityTab from '../components/admin/ActivityTab';

const TABS = ['Overview', 'Events', 'Resources', 'Products', 'Users', 'Payments', 'Reports', 'Activity'] as const;
type Tab = (typeof TABS)[number];

export default function AdminDashboard() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const tab: Tab = (TABS as readonly string[]).includes(requested ?? '') ? (requested as Tab) : 'Overview';
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [openReports, setOpenReports] = useState(0);
  const timer = useRef<number>(0);

  // Stable so the tabs' data effects don't re-run on every render.
  const notify = useCallback((kind: 'ok' | 'err', text: string) => {
    setNotice({ kind, text });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setNotice(null), kind === 'err' ? 8000 : 4000);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    supabase.from('post_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending').then(({ count }) => setOpenReports(count ?? 0));
  }, [tab]);

  function openTab(next: string, q?: string) {
    const p = new URLSearchParams();
    p.set('tab', next);
    if (q) p.set('q', q);
    setParams(p);
    window.scrollTo({ top: 0 });
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold text-bone">Admin</h1>
      <p className="text-sm text-muted">Everything on TapIN in one place. Changes you make to other people's things are logged in Activity.</p>

      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-gray-300" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => openTab(t)}
            className={`shrink-0 whitespace-nowrap px-4 py-3 text-sm font-medium transition ${tab === t ? 'border-b-2 border-marigold text-marigold' : 'text-muted hover:text-bone'}`}
          >
            {t}
            {t === 'Reports' && openReports > 0 && (
              <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-800">{openReports}</span>
            )}
          </button>
        ))}
      </div>

      {notice && (
        <div
          role={notice.kind === 'err' ? 'alert' : 'status'}
          className={`fixed inset-x-4 bottom-[calc(6rem+env(safe-area-inset-bottom,0px))] z-[1200] mx-auto max-w-md rounded-xl px-4 py-3 text-sm font-medium shadow-lg md:bottom-6 ${notice.kind === 'err' ? 'bg-red-600 text-white' : 'bg-gray-900 text-white'}`}
        >
          {notice.text}
        </div>
      )}

      {tab === 'Overview' && <OverviewTab onOpenTab={openTab} />}
      {tab === 'Events' && <EventsTab notify={notify} />}
      {tab === 'Resources' && <ResourcesTab notify={notify} />}
      {tab === 'Products' && <ProductsTab notify={notify} />}
      {tab === 'Users' && <UsersTab notify={notify} initialSearch={params.get('q') ?? ''} />}
      {tab === 'Payments' && <PaymentsTab notify={notify} />}
      {tab === 'Reports' && <div className="mt-6"><ReportsTab /></div>}
      {tab === 'Activity' && <ActivityTab notify={notify} />}
    </div>
  );
}
