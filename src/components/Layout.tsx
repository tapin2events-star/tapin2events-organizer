import { useEffect, useState } from 'react';
import { NavLink, Link, Outlet, useLocation } from 'react-router-dom';
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
const EXPLORE: Item[] = [
  { to: '/', label: 'Discover', icon: 'discover', end: true, desktopOnly: true },
  { to: '/feed', label: 'Feed', icon: 'feed', desktopOnly: true },
  { to: '/resources', label: 'Artists & Resources', icon: 'resources', end: true },
  { to: '/products', label: 'Shop', icon: 'shop' },
];
const MY_STUFF: Item[] = [
  { to: '/activity', label: 'My Activity', icon: 'activity', end: true, desktopOnly: true },
  { to: '/resources/dashboard', label: 'Resource Dashboard', icon: 'resourceDash', end: true, badge: 'resourceRequests' },
  { to: '/groups', label: 'Groups', icon: 'groups', badge: 'groupInvites' },
];
const ORGANIZER: Item[] = [
  { to: '/organizer', label: 'Organizer Dashboard', icon: 'dashboard', end: true },
  { to: '/organizer/bookings', label: 'Bookings', icon: 'bookings', end: true, badge: 'bookings' },
  { to: '/organizer/vendor-applications', label: 'Vendor Applications', icon: 'vendors', end: true, badge: 'vendorApps' },
  { to: '/organizer/earnings', label: 'Earnings', icon: 'earnings', end: true },
  { to: '/organizer/import', label: 'Import Events', icon: 'import', end: true },
];

export default function Layout() {
  const { user, isAdmin, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  useEscapeKey(() => setMenuOpen(false), menuOpen);
  const location = useLocation();
  const badges = useNavBadges(user?.email, user?.id, `${location.pathname}|${menuOpen}`);
  const [me, setMe] = useState<{ full_name: string | null; profile_photo: string | null } | null>(null);
  useEffect(() => {
    if (!user?.id) { setMe(null); return; }
    supabase.from('profiles').select('full_name, profile_photo').eq('id', user.id).maybeSingle().then(({ data }) => setMe(data ?? null));
  }, [user?.id]);

  const close = () => setMenuOpen(false);
  const displayName = me?.full_name?.trim() || user?.email?.split('@')[0] || 'Guest';

  const renderItems = (items: Item[]) => items.map((item) => {
    const count = item.badge ? badges[item.badge] : 0;
    return (
      <NavLink
        key={item.to}
        to={item.to}
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
      <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-surface px-4 py-3 md:hidden" style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}>
        <Link to="/" className="font-display text-xl font-extrabold tracking-tight text-gray-900">
          <span className="bg-gradient-to-r from-marigold to-teal bg-clip-text text-transparent">TapIN</span>
        </Link>
        <div className="flex items-center gap-1">
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
        style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top, 0px))' }}
      >
        <div className="mb-4 flex items-center justify-between px-1">
          <Link to="/" onClick={close} className="font-display text-2xl font-extrabold tracking-tight">
            <span className="bg-gradient-to-r from-marigold to-teal bg-clip-text text-transparent">TapIN</span>
          </Link>
          <div className="hidden md:block"><NotificationBell /></div>
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
            <nav className="flex flex-col gap-0.5" aria-label="My stuff">{renderItems(MY_STUFF)}</nav>
          </>
        )}

        {heading('Organizer')}
        <Link to="/organizer/new" onClick={close}
          className="mb-1 flex items-center justify-center gap-2 rounded-xl bg-marigold px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-marigold/90">
          <NavIcon name="plus" className="h-4 w-4" /> Create event
        </Link>
        <nav className="flex flex-col gap-0.5" aria-label="Organizer">{renderItems(ORGANIZER)}</nav>

        {isAdmin && (
          <>
            {heading('Platform')}
            <nav className="flex flex-col gap-0.5" aria-label="Platform">{renderItems([{ to: '/admin', label: 'Admin Dashboard', icon: 'admin' }])}</nav>
          </>
        )}

        <div className="mt-auto pt-6">
          <div className="border-t border-gray-200 pt-3">
            {user && (
              <button onClick={() => { close(); signOut(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 active:bg-gray-100 md:hover:bg-gray-100">
                <NavIcon name="signout" /> Sign out
              </button>
            )}
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 px-3 text-[11px] text-gray-400">
              <Link to="/terms" onClick={close} className="py-1 hover:text-gray-700">Terms</Link>
              <Link to="/privacy" onClick={close} className="py-1 hover:text-gray-700">Privacy</Link>
              <Link to="/refund-policy" onClick={close} className="py-1 hover:text-gray-700">Refunds</Link>
            </div>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 pt-[calc(5rem+env(safe-area-inset-top,0px))] pb-[calc(7rem+env(safe-area-inset-bottom,0px))] md:px-8 md:py-8 md:pt-8 md:pb-8">
        <Outlet />
        <ScrollToTop />
      </main>

      <BottomTabBar />
    </div>
  );
}
