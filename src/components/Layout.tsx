import { Suspense, useEffect, useState } from 'react';
import MiniPlayer from './music/MiniPlayer';
import { onNavigate } from '../lib/appUpdate';
import GetAppBanner from './GetAppBanner';
import UpgradePrompt from './business/UpgradePrompt';
import { useDisplayPrefs } from '../lib/display';
import HelpButton from './HelpPanel';
import { effectiveRoles, reloadSetup, useSetup } from '../lib/setup';
import { useWhiteLabel } from '../lib/whiteLabel';
import PageLoading from './PageLoading';
import { prefetchCommonPages } from '../lib/prefetch';
import { claimLinkVisits } from '../lib/linkTracking';
import { scrollPageToTop } from '../lib/scroll';
import { useFeature } from '../lib/preview';
import { NavLink, Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import NavIcon from './NavIcon';
import { useNavBadges, type NavBadges } from '../lib/useNavBadges';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import BottomTabBar from './BottomTabBar';
import ScrollToTop from './ScrollToTop';
import { useEscapeKey } from '../lib/useEscapeKey';

type Item = { to: string; label: string; icon: string; end?: boolean; badge?: keyof NavBadges; desktopOnly?: boolean };

// Discover, Feed, Activity and Profile live in the bottom tab bar on phones,
// so the phone menu only shows them on desktop (where there's no tab bar).
// Simple mode: just the essentials.
const SIMPLE_MENU = new Set(['/', '/activity', '/tutorials', '/organizations', '/products', '/resources/dashboard', '/organizer', '/business', '/admin']);
const EXPLORE: Item[] = [
  { to: '/', label: 'Discover', icon: 'discover', end: true, desktopOnly: true },
  { to: '/feed', label: 'Feed', icon: 'feed', desktopOnly: true },
  { to: '/resources', label: 'Artists & vendors', icon: 'resources', end: true },
  { to: '/organizations', label: 'Organizations', icon: 'bookings', end: true },
  { to: '/products', label: 'Shop', icon: 'shop' },
  { to: '/tutorials', label: 'Tutorials', icon: 'tutorials' },
];
const MY_STUFF: Item[] = [
  { to: '/activity', label: 'My Activity', icon: 'activity', end: true, desktopOnly: true },
  { to: '/resources/dashboard', label: 'Artist & vendor dashboard', icon: 'resourceDash', end: true, badge: 'resourceRequests' },
  { to: '/groups', label: 'Artist groups', icon: 'groups', badge: 'groupInvites' },
  { to: '/my-music', label: 'My music', icon: 'music', end: true },
];
const ORGANIZER: Item[] = [
  { to: '/organizer', label: 'Organizer Dashboard', icon: 'dashboard', end: true },
  { to: '/organizer/bookings', label: 'Bookings', icon: 'bookings', end: true, badge: 'bookings' },
  { to: '/organizer/planning', label: 'Planning', icon: 'scouting' },
  { to: '/organizer/vendor-applications', label: 'Vendor Applications', icon: 'vendors', end: true, badge: 'vendorApps' },
  { to: '/organizer/earnings', label: 'Earnings', icon: 'earnings', end: true },
  { to: '/organizer/import', label: 'Import Events', icon: 'import', end: true },
];

export default function Layout() {
  const { user, isAdmin, signOut } = useAuth();
  // Visits from promotion links made before signing in get attached to the account.
  useEffect(() => { if (user) claimLinkVisits(); }, [user]);
  // After TapIN opens, quietly load the most-used pages so tapping into them is instant.
  useEffect(() => { prefetchCommonPages(); }, []);
  const businessOn = useFeature('business');
  const networkingOn = useFeature('networking');
  const [menuOpen, setMenuOpen] = useState(false);
  useEscapeKey(() => setMenuOpen(false), menuOpen);
  const location = useLocation();
  // A newer TapIN is live: switch to it when the person moves to another page.
  useEffect(() => { onNavigate(); }, [location.pathname]);
  const badges = useNavBadges(user?.email, user?.id, `${location.pathname}|${menuOpen}`);
  const [me, setMe] = useState<{ full_name: string | null; profile_photo: string | null } | null>(null);
  useEffect(() => {
    if (!user?.id) { setMe(null); return; }
    supabase.from('profiles').select('full_name, profile_photo').eq('id', user.id).maybeSingle().then(({ data }) => setMe(data ?? null));
  }, [user?.id]);

  const close = () => setMenuOpen(false);
  const whiteLabel = useWhiteLabel();
  // First sign-in: send people who haven't set up yet to the welcome flow (only from the home screen, so links to
  // events, tickets or checkout are never interrupted).
  const setup = useSetup();
  const { simple } = useDisplayPrefs();
  const navigate = useNavigate();
  useEffect(() => {
    if (user && setup && !setup.onboarded && location.pathname === '/') navigate('/welcome', { replace: true });
  }, [user, setup, location.pathname, navigate]);
  // Role-based menu: show the tools that match what someone does; everything else behind "Show all tools".
  const roles = effectiveRoles(setup);
  const showAll = !setup || setup.show_all_tools || setup.is_admin || isAdmin;
  const isCreator = showAll || roles.has('artist') || roles.has('services');
  const isOrganizer = showAll || roles.has('organizer') || roles.has('organization');
  const toggleAll = async () => { await supabase.rpc('set_setup_pref', { p_show_all_tools: !setup?.show_all_tools }); reloadSetup(); };
  const displayName = me?.full_name?.trim() || user?.email?.split('@')[0] || 'Guest';

  const renderItems = (items: Item[]) => items.filter((item) => !simple || SIMPLE_MENU.has(item.to)).map((item) => {
    const count = item.badge ? badges[item.badge] : 0;
    return (
      <NavLink
        key={item.to}
        to={item.to}
        data-tour={`menu-${item.to.replace(/^\//, '') || 'home'}`}
        end={item.end}
        onClick={close}
        className={({ isActive }) =>
          `${item.desktopOnly ? 'hidden md:flex' : 'flex'} items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition md:py-2 md:text-sm ${
            isActive ? 'bg-marigold/10 text-marigold' : 'text-gray-600 active:bg-gray-100 md:hover:bg-gray-100 md:hover:text-gray-900'
          }`
        }
      >
        <NavIcon name={item.icon} />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {count > 0 && (
          <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[11px] font-bold text-white" aria-label={`${count} waiting`}>{count > 99 ? '99+' : count}</span>
        )}
      </NavLink>
    );
  });
  const heading = (text: string) => (
    <p className="mb-1 mt-5 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">{text}</p>
  );

  return (
    <div className="flex min-h-screen bg-ink text-bone">
      {/* Mobile top bar: only visible below md */}
      <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-surface px-4 py-3 md:hidden" style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))', ...(whiteLabel ? { display: 'none' } : {}) }}
        onClick={(e) => { if (!(e.target as HTMLElement).closest('a, button')) scrollPageToTop(); }}>
        <Link to="/" className="font-display text-xl font-extrabold tracking-tight text-gray-900">
          <span className="bg-gradient-to-r from-marigold to-teal bg-clip-text text-transparent">TapIN</span>
        </Link>
        <div className="flex items-center gap-1">
          <HelpButton />
          <NotificationBell />
          <button onClick={() => setMenuOpen(true)} aria-label="Open menu" className="relative rounded-lg p-2 text-muted hover:bg-gray-100">
            <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
            </svg>
            {Object.values(badges).some((n) => n > 0) && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-orange-500 ring-2 ring-surface" aria-label="Something needs your attention" />}
          </button>
        </div>
      </div>

      {/* Backdrop, mobile only, closes the drawer on tap */}
      {menuOpen && <div className="fixed inset-0 z-[1001] bg-black/30 md:hidden" onClick={close} />}

      {/* Sidebar: persistent column on desktop, slide-in drawer on mobile. */}
      <aside
        className={`fixed inset-y-0 left-0 z-[1002] flex w-72 shrink-0 flex-col overflow-y-auto border-r border-gray-200 bg-surface px-4 pb-4 transition-transform duration-200 md:static md:z-auto md:w-64 md:translate-x-0 ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top, 0px))', ...(whiteLabel ? { display: 'none' } : {}) }}
      >
        <div className="mb-4 flex items-center justify-between px-1">
          <Link to="/" onClick={close} className="font-display text-2xl font-extrabold tracking-tight">
            <span className="bg-gradient-to-r from-marigold to-teal bg-clip-text text-transparent">TapIN</span>
          </Link>
          <div className="hidden items-center md:flex"><HelpButton /><NotificationBell /></div>
          <button onClick={close} aria-label="Close menu" className="rounded-lg p-2 text-muted hover:bg-gray-100 md:hidden">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4l12 12M16 4L4 16" strokeLinecap="round" /></svg>
          </button>
        </div>

        {/* Profile card */}
        {user ? (
          <NavLink to="/profile" end onClick={close}
            className={({ isActive }) => `flex items-center gap-3 rounded-2xl border p-3 transition ${isActive ? 'border-marigold/40 bg-marigold/5' : 'border-gray-200 bg-white active:bg-gray-50 md:hover:border-gray-300'}`}>
            {me?.profile_photo
              ? <img src={me.profile_photo} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
              : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-marigold to-teal text-base font-bold text-white">{displayName.charAt(0).toUpperCase()}</span>}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-gray-900">{displayName}</span>
              <span className="block truncate text-xs text-marigold">View profile</span>
            </span>
          </NavLink>
        ) : (
          <Link to="/login" onClick={close} className="block rounded-xl bg-marigold px-3 py-2.5 text-center text-sm font-semibold text-white hover:bg-marigold/90">Sign in</Link>
        )}

        <nav className="mt-3 flex flex-col gap-0.5" aria-label="Explore">{renderItems(EXPLORE)}</nav>

        {user && (
          <>
            {heading('My stuff')}
            <nav className="flex flex-col gap-0.5" aria-label="My stuff">{renderItems([...MY_STUFF.filter((i) => isCreator || (i.to !== '/resources/dashboard' && i.to !== '/groups')), ...(networkingOn ? [{ to: '/network', label: 'Networking', icon: 'groups', end: true }] : [])])}</nav>
          </>
        )}

        {(isOrganizer || !user) && heading('Organizer')}
        {(isOrganizer || !user) && <Link to="/organizer/new" onClick={close}
          className="mb-1 flex items-center justify-center gap-2 rounded-xl bg-marigold px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-marigold/90">
          <NavIcon name="plus" className="h-4 w-4" /> Create event
        </Link>}
        {isOrganizer && <nav className="flex flex-col gap-0.5" aria-label="Organizer">{renderItems(businessOn ? [ORGANIZER[0], { to: '/business', label: 'TapIN for Business', icon: 'bookings' }, ...ORGANIZER.slice(1)] : ORGANIZER)}</nav>}
        {user && simple && (
          <div className="mt-4 rounded-xl border border-dashed border-gray-300 px-3 py-2.5 text-xs text-gray-500">Simple mode is on. <Link to="/profile#display" onClick={close} className="font-medium text-marigold">Change</Link></div>
        )}
        {user && !simple && setup && !setup.is_admin && !isAdmin && (
          <div className="mt-4 rounded-xl border border-dashed border-gray-300 px-3 py-2.5 text-xs text-gray-500">
            {!isOrganizer && <Link to="/welcome" onClick={close} className="block font-medium text-marigold">Organize events or sell your art? Set it up ›</Link>}
            <button onClick={toggleAll} className={`${!isOrganizer ? 'mt-1.5 ' : ''}block text-gray-500 underline`}>{setup.show_all_tools ? 'Show only my tools' : 'Show all tools'}</button>
          </div>
        )}

        {isAdmin && (
          <>
            {heading('Platform')}
            <nav className="flex flex-col gap-0.5" aria-label="Platform">{renderItems([{ to: '/admin', label: 'Admin Dashboard', icon: 'admin' }])}</nav>
          </>
        )}

        <div className="mt-auto pt-6">
          <div className="border-t border-gray-200 pt-3">
            <a href="mailto:support@tapin2events.com" onClick={close}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 active:bg-gray-100 md:hover:bg-gray-100">
              <NavIcon name="help" /> Contact support
            </a>
            {user && (
              <button onClick={() => { close(); signOut(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 active:bg-gray-100 md:hover:bg-gray-100">
                <NavIcon name="signout" /> Sign out
              </button>
            )}
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 px-3 text-[11px] text-gray-400">
              <Link to="/terms" onClick={close} className="py-1 hover:text-gray-700">Terms</Link>
              <Link to="/privacy" onClick={close} className="py-1 hover:text-gray-700">Privacy</Link>
              <Link to="/refund-policy" onClick={close} className="py-1 hover:text-gray-700">Refunds</Link>
              <Link to="/dmca" onClick={close} className="py-1 hover:text-gray-700">Copyright</Link>
            </div>
          </div>
        </div>
      </aside>

      {/* White-labeled pages keep this same frame (so the page never reloads) with TapIN's menu, top bar and tabs hidden. */}
      <main className={whiteLabel
        ? 'mx-auto min-w-0 max-w-4xl flex-1 px-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-[calc(2rem+env(safe-area-inset-bottom,0px))] md:px-8'
        : 'min-w-0 flex-1 px-4 py-6 pt-[calc(5rem+env(safe-area-inset-top,0px))] pb-[calc(7rem+env(safe-area-inset-bottom,0px))] md:px-8 md:py-8 md:pt-8 md:pb-8'}>
        {!whiteLabel && <div className="-mx-4 -mt-3 mb-4 md:hidden"><GetAppBanner /></div>}
        <Suspense fallback={<PageLoading />}><Outlet /></Suspense>
        <ScrollToTop />
      </main>

      {!whiteLabel && <BottomTabBar />}
      <MiniPlayer />
      <UpgradePrompt />
    </div>
  );
}
