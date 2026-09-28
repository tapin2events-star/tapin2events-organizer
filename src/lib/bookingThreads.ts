import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export interface ThreadSummary {
  booking_id: string;
  message_count: number;
  unread_count: number;
  last_body: string | null;
  last_sender_email: string | null;
  last_at: string | null;
}

export interface ThreadMessage {
  id: string;
  sender_email: string;
  body: string;
  created_at: string;
}

// Message count, unread count, and latest message for each of the caller's
// bookings. Refreshes every 30s while the tab is visible, so new replies
// show up without reloading.
export function useThreadSummaries(bookingIds: string[]) {
  const key = [...bookingIds].sort().join(',');
  const [summaries, setSummaries] = useState<Map<string, ThreadSummary>>(new Map());

  const refresh = useCallback(async () => {
    const ids = key ? key.split(',') : [];
    if (ids.length === 0) {
      setSummaries(new Map());
      return;
    }
    const { data, error } = await supabase.rpc('booking_thread_summaries', { p_booking_ids: ids });
    if (error) {
      console.error('Failed to load message summaries:', error);
      return;
    }
    setSummaries(new Map(((data ?? []) as ThreadSummary[]).map((s) => [s.booking_id, s])));
  }, [key]);

  useEffect(() => {
    refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, 30000);
    return () => clearInterval(timer);
  }, [refresh]);

  // Called by an open conversation: keeps the preview and badge in sync
  // with what's on screen, without waiting for the next refresh.
  const applyLocal = useCallback((bookingId: string, info: { count: number; last: ThreadMessage | null; read: boolean }) => {
    setSummaries((prev) => {
      const next = new Map(prev);
      const current = prev.get(bookingId);
      next.set(bookingId, {
        booking_id: bookingId,
        message_count: info.count,
        unread_count: info.read ? 0 : current?.unread_count ?? 0,
        last_body: info.last?.body ?? current?.last_body ?? null,
        last_sender_email: info.last?.sender_email ?? current?.last_sender_email ?? null,
        last_at: info.last?.created_at ?? current?.last_at ?? null,
      });
      return next;
    });
  }, []);

  return { summaries, refresh, applyLocal };
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return 'now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
