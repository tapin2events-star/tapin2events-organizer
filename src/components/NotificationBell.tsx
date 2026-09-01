import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

interface Notification {
  id: string;
  type: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  async function loadNotifications() {
    if (!user?.email) return;
    const { data, error } = await supabase
      .from('notifications')
      .select('id, type, message, link, is_read, created_at')
      .eq('user_email', user.email)
      .order('created_at', { ascending: false })
      .limit(20);
    if (!error) setNotifications((data ?? []) as Notification[]);
  }

  useEffect(() => {
    loadNotifications();
    // Light polling rather than a full realtime subscription for now —
    // good enough to surface new notifications without a page reload.
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [user?.email]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleClick(n: Notification) {
    if (!n.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    }
    setOpen(false);
    if (n.link) navigate(n.link);
  }

  if (!user) return null;

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-magenta px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Mobile: full backdrop + near-full-width panel below the header,
              matching the same drawer pattern used for the sidebar nav.
              Desktop: reverts to a small dropdown anchored to the bell. */}
          <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={() => setOpen(false)} />
          <div className="fixed inset-x-3 top-16 z-50 max-h-[75vh] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg md:absolute md:inset-x-auto md:right-0 md:top-auto md:mt-2 md:w-80 md:max-h-none">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <span className="text-sm font-semibold text-gray-900">Notifications</span>
              <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 md:hidden">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4l12 12M16 4L4 16" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-400">Nothing yet</p>
            ) : (
              <ul className="max-h-[calc(75vh-48px)] overflow-y-auto md:max-h-96">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => handleClick(n)}
                      className={`block w-full px-4 py-3.5 text-left text-sm hover:bg-gray-50 ${n.is_read ? 'text-gray-500' : 'font-medium text-gray-900'}`}
                    >
                      <p>{n.message}</p>
                      <p className="mt-0.5 text-xs text-gray-400">{timeAgo(n.created_at)}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
