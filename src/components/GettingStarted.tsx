import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { effectiveRoles, reloadSetup, useSetup } from '../lib/setup';

// A short checklist on Discover, built from what someone told us in the welcome flow. Disappears when done or dismissed.
export default function GettingStarted() {
  const s = useSetup();
  if (!s || !s.onboarded || s.checklist_dismissed) return null;
  const roles = effectiveRoles(s);
  const items: { done: boolean; label: string; to: string }[] = [
    { done: !!s.photo, label: 'Add a profile photo', to: '/profile' },
  ];
  if (roles.has('attendee') || roles.size === 0) {
    items.push({ done: s.follows_orgs > 0, label: 'Follow an organization you like', to: '/organizations' });
    items.push({ done: s.saved_events > 0 || s.has_ticket, label: 'Save or get tickets to an event', to: '/' });
  }
  if (roles.has('artist') || roles.has('services')) {
    items.push({ done: s.has_resource, label: roles.has('artist') ? 'Create your artist profile' : 'Create your services listing', to: s.has_resource ? '/resources/dashboard' : '/resources/new' });
  }
  if (roles.has('organization')) items.push({ done: s.has_org, label: 'Create your organization page', to: '/business' });
  if (roles.has('organizer') || roles.has('organization')) {
    items.push({ done: s.has_published_event, label: s.has_events ? 'Publish your event' : 'Create your first event', to: s.has_events ? '/organizer' : '/organizer/new' });
  }
  if (roles.has('organizer') || roles.has('organization') || roles.has('artist') || roles.has('services')) {
    items.push({ done: s.payouts_ready, label: 'Connect payouts so you can get paid', to: '/profile' });
  }
  const done = items.filter((i) => i.done).length;
  if (done === items.length) return null;
  async function dismiss() { await supabase.rpc('set_setup_pref', { p_dismiss_checklist: true }); reloadSetup(); }
  return (
    <section className="mb-6 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-4" aria-label="Getting started">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-lg font-bold text-gray-900">Getting started</p>
          <p className="text-sm text-gray-600">{done} of {items.length} done</p>
        </div>
        <button onClick={dismiss} className="text-xs text-gray-400 hover:text-gray-700">Hide</button>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200"><div className="h-full rounded-full bg-marigold transition-all" style={{ width: `${(done / items.length) * 100}%` }} /></div>
      <ul className="mt-3 flex flex-col gap-1.5">
        {items.map((i) => (
          <li key={i.label}>
            <Link to={i.to} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${i.done ? 'text-gray-400' : 'bg-white font-medium text-gray-900 shadow-sm'}`}>
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold ${i.done ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300 text-transparent'}`}>✓</span>
              <span className={i.done ? 'line-through' : ''}>{i.label}</span>
              {!i.done && <span className="ml-auto text-gray-400" aria-hidden="true">›</span>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
