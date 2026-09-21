import { NavLink, useNavigate } from 'react-router-dom';

const TABS = [
  {
    to: '/',
    label: 'Discover',
    end: true,
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 2}>
        <path d="M12 3l8 6v11a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1V9l8-6z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    to: '/resources',
    label: 'Resources',
    end: false,
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 2}>
        <circle cx="9" cy="8" r="3" /><path d="M2 20c0-3 3-5 7-5s7 2 7 5" strokeLinecap="round" />
        <circle cx="17" cy="8" r="2.5" /><path d="M15 15.5c2.7.3 5 1.9 5 4.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: '/activity',
    label: 'Activity',
    end: true,
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
        <path d="M20.8 8.6c0 4.5-8.8 10.4-8.8 10.4S3.2 13.1 3.2 8.6a4.8 4.8 0 0 1 8.8-2.7 4.8 4.8 0 0 1 8.8 2.7z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    to: '/profile',
    label: 'Profile',
    end: true,
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 2}>
        <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function BottomTabBar() {
  const navigate = useNavigate();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-gray-200 bg-surface/95 backdrop-blur-sm md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {TABS.slice(0, 2).map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${
              isActive ? 'text-marigold' : 'text-muted'
            }`
          }
        >
          {({ isActive }) => (
            <>
              {tab.icon(isActive)}
              {tab.label}
            </>
          )}
        </NavLink>
      ))}

      <button
        onClick={() => navigate('/organizer/new')}
        aria-label="Create event"
        className="mx-1 -mt-6 flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white shadow-lg"
        style={{ background: 'linear-gradient(135deg, #4F46E5, #14B8A6)' }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
      </button>

      {TABS.slice(2).map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${
              isActive ? 'text-marigold' : 'text-muted'
            }`
          }
        >
          {({ isActive }) => (
            <>
              {tab.icon(isActive)}
              {tab.label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
