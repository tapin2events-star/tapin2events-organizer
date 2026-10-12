import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

// The phone's "+" menu: post a video, create an event, or (for people who aren't
// bookable yet) offer your services. Order never changes, so it can be tapped from memory.
export default function CreateSheet({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [hasResource, setHasResource] = useState<boolean | null>(null);
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    if (!user?.email) return;
    supabase.from('resources').select('id', { count: 'exact', head: true }).eq('email', user.email).eq('kind', 'individual')
      .then(({ count }) => setHasResource((count ?? 0) > 0));
  }, [user?.email]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  const go = (to: string) => { onClose(); navigate(to); };

  const Option = ({ icon, color, title, desc, onClick, children }: { icon: ReactNode; color: string; title: string; desc: string; onClick: () => void; children?: ReactNode }) => (
    <div className="rounded-2xl border border-gray-200 bg-white">
      <button type="button" onClick={onClick} className="flex w-full items-center gap-4 p-4 text-left active:bg-gray-50">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white" style={{ background: color }}>{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-base font-bold text-gray-900">{title}</span>
          <span className="block text-sm leading-snug text-gray-500">{desc}</span>
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
      </button>
      {children}
    </div>
  );
  const svg = (d: string) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;

  return createPortal(
    <div className="fixed inset-0 z-[999] md:hidden" role="dialog" aria-label="Create">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div
        className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-gray-50 px-4 pt-2 shadow-2xl transition-transform"
        style={{ transform: `translateY(${dragY}px)`, paddingBottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}
        onTouchStart={(e) => { startY.current = e.touches[0].clientY; }}
        onTouchMove={(e) => { if (startY.current !== null) setDragY(Math.max(0, e.touches[0].clientY - startY.current)); }}
        onTouchEnd={() => { if (dragY > 90) onClose(); setDragY(0); startY.current = null; }}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-300" aria-hidden="true" />
        <h2 className="mb-3 px-1 font-display text-xl font-extrabold text-gray-900">Create</h2>
        <div className="flex flex-col gap-3">
          <Option icon={svg('M15 10l4.55-2.28A1 1 0 0 1 21 8.62v6.76a1 1 0 0 1-1.45.9L15 14M5 18h8a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2Z')}
            color="linear-gradient(135deg,#EC4899,#F59E0B)" title="Post a video" desc="Share a clip to the Feed" onClick={() => go('/feed?create=1')} />
          <Option icon={svg('M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z')}
            color="linear-gradient(135deg,#4F46E5,#14B8A6)" title="Create an event" desc="Snap your flyer and we'll fill in the details" onClick={() => go('/organizer/new')}>
            <div className="flex gap-4 border-t border-gray-100 px-4 py-2.5 text-sm">
              <button type="button" onClick={() => go('/organizer/new?start=scratch')} className="font-medium text-marigold">Start from scratch</button>
              <button type="button" onClick={() => go('/organizer/import')} className="font-medium text-marigold">Import from a link</button>
            </div>
          </Option>
          {hasResource === false && (
            <Option icon={svg('M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3ZM19 10v2a7 7 0 0 1-14 0v-2M12 19v3')}
              color="linear-gradient(135deg,#7C3AED,#C026D3)" title="Offer my services" desc="Get booked as an artist, vendor, or service" onClick={() => go('/resources/new')} />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
