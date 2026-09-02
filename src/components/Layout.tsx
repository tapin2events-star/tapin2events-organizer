import { useState } from 'react';
import { NavLink, Link, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';

const NAV_ITEMS = [
  { to: '/', label: 'Discover', end: true },
  { to: '/resources', label: 'Resources', end: false },
  { to: '/resources/dashboard', label: 'Resource Dashboard', end: true },
  { to: '/activity', label: 'My Activity', end: true },
];

const ORGANIZER_NAV_ITEMS = [
  { to: '/organizer', label: 'My Events', end: true },
  { to: '/organizer/new', label: 'Create Event', end: true },
];

export default function Layout() {
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-ink text-bone">
      {/* Mobile top bar: only visible below md */}
      <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-surface px-4 py-3 md:hidden">
        <Link to="/" className="font-display text-xl font-extrabold tracking-tight text-gray-900">
          TAP<span className="text-marigold">IN</span>
        </Link>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="rounded-lg p-2 text-muted hover:bg-gray-100"
          >
            <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Backdrop, mobile only, closes the drawer on tap */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={() => setMenuOpen(false)} />
      )}

      {/* Sidebar: persistent column on desktop, slide-in drawer on mobile.
          Present on every page now, not just the organizer console, so
          there's exactly one navigation system for the whole app. */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col overflow-y-auto border-r border-gray-200 bg-surface px-5 py-6 transition-transform duration-200 md:static md:z-auto md:w-60 md:translate-x-0 ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-8 flex items-center justify-between">
          <Link to="/" className="font-display text-2xl font-extrabold tracking-tight text-gray-900">
            TAP<span className="text-marigold">IN</span>
          </Link>
          <div className="hidden md:block">
            <NotificationBell />
          </div>
          <button
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
            className="rounded-lg p-2 text-muted hover:bg-gray-100 md:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4l12 12M16 4L4 16" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-marigold/10 text-marigold'
                    : 'text-muted hover:bg-gray-100 hover:text-bone'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <p className="mb-1 mt-6 px-3 text-[11px] font-semibold uppercase tracking-widest text-muted/70">
          Organizer
        </p>
        <nav className="flex flex-1 flex-col gap-1">
          {ORGANIZER_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-marigold/10 text-marigold'
                    : 'text-muted hover:bg-gray-100 hover:text-bone'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-gray-200 pt-4">
          {user ? (
            <>
              <p className="truncate text-xs text-muted">{user.email}</p>
              <button
                onClick={() => signOut()}
                className="mt-2 text-xs font-medium text-magenta hover:text-magenta/80"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              to="/login"
              onClick={() => setMenuOpen(false)}
              className="block rounded-lg bg-marigold px-3 py-2 text-center text-sm font-semibold text-ink hover:bg-marigold/90"
            >
              Sign in
            </Link>
          )}
        </div>
      </aside>

      <main className="flex-1 px-4 py-6 pt-20 md:px-8 md:py-8 md:pt-8">
        <Outlet />
      </main>
    </div>
  );
}
