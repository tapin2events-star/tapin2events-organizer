import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import type { ThreadMessage } from '../../lib/bookingThreads';

const POLL_MS = 8000;

function timeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === new Date().toDateString()) return time;
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time}`;
}

// Phones: Enter adds a new line (there's a Send button right there).
// Keyboards: Enter sends, Shift+Enter adds a new line.
function isTouchDevice(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;
}

// The conversation on one booking. Works the same for the organizer and the
// resource: your messages on the right, theirs on the left with their name.
// New replies appear on their own while it's open, and opening it marks
// the conversation (and its bell alerts) as read.
export default function BookingThread({
  bookingId,
  otherPartyName,
  starters = [],
  onChange,
}: {
  bookingId: string;
  otherPartyName: string;
  starters?: string[];
  onChange?: (info: { count: number; last: ThreadMessage | null; read: boolean }) => void;
}) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const latestIdRef = useRef<string | null>(null);
  const onChangeRef = useRef(onChange);
  const touch = isTouchDevice();

  useEffect(() => { onChangeRef.current = onChange; });

  useEffect(() => {
    let cancelled = false;
    latestIdRef.current = null;

    async function fetchMessages(initial: boolean) {
      const { data, error } = await supabase
        .from('booking_messages')
        .select('id, sender_email, body, created_at')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error('Failed to load booking messages:', error);
        if (initial) { setLoadError(true); setLoading(false); }
        return;
      }
      const list = (data ?? []) as ThreadMessage[];
      // Keep any message still on its way to the server.
      setMessages((prev) => [...list, ...prev.filter((m) => m.id.startsWith('temp-'))]);
      if (initial) setLoading(false);
      const latest = list[list.length - 1] ?? null;
      const isNew = (latest?.id ?? null) !== latestIdRef.current;
      latestIdRef.current = latest?.id ?? null;
      if (initial || isNew) {
        // Opening the conversation, or a reply arriving while it's open, means it's been seen.
        supabase.rpc('mark_booking_thread_read', { p_booking_id: bookingId }).then(() => {});
        onChangeRef.current?.({ count: list.length, last: latest, read: true });
      }
    }

    fetchMessages(true);
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') fetchMessages(false);
    }, POLL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [bookingId]);

  // Keep the newest message in view (inside the box, not the whole page).
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  function resize(el: HTMLTextAreaElement | null) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  function applyStarter(text: string) {
    setDraft(text);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      resize(inputRef.current);
    });
  }

  async function send() {
    const body = draft.trim();
    if (!body || !user?.email || sending) return;
    setSending(true);
    setSendError(null);
    const optimistic: ThreadMessage = { id: `temp-${Date.now()}`, sender_email: user.email, body, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, optimistic]);
    setDraft('');
    requestAnimationFrame(() => resize(inputRef.current));
    // The server always records the sender as you, whatever is sent here.
    const { data, error } = await supabase
      .from('booking_messages')
      .insert({ booking_id: bookingId, body, sender_email: user.email })
      .select('id, sender_email, body, created_at')
      .single();
    setSending(false);
    if (error || !data) {
      console.error('Failed to send booking message:', error);
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(body);
      setSendError(error?.message?.includes('Too many') ? "You're sending messages too fast. Please wait a moment." : "Couldn't send. Please try again.");
      return;
    }
    const saved = { ...(data as ThreadMessage), created_at: (data as ThreadMessage).created_at ?? optimistic.created_at };
    latestIdRef.current = saved.id;
    const count = messages.filter((m) => !m.id.startsWith('temp-')).length + 1;
    setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? saved : m)));
    onChangeRef.current?.({ count, last: saved, read: true });
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !touch) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-3 py-2">
        <p className="truncate text-xs font-semibold text-gray-700">Conversation with {otherPartyName}</p>
        <p className="hidden shrink-0 text-[11px] text-gray-400 sm:block">Updates automatically</p>
      </div>

      <div ref={listRef} className="max-h-80 min-h-[7rem] overflow-y-auto px-3 py-3">
        {loading ? (
          <p className="py-6 text-center text-sm text-muted">Loading conversation…</p>
        ) : loadError ? (
          <p className="py-6 text-center text-sm text-red-600">Couldn't load this conversation. Please refresh.</p>
        ) : messages.length === 0 ? (
          <div className="py-2 text-center">
            <p className="text-sm font-medium text-gray-700">Start the conversation</p>
            <p className="mt-0.5 text-xs text-gray-500">{otherPartyName} gets a notification for every message.</p>
            {starters.length > 0 && (
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {starters.map((s) => (
                  <button key={s} type="button" onClick={() => applyStarter(s)} className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 hover:border-marigold hover:text-marigold">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {messages.map((m, i) => {
              const mine = m.sender_email === user?.email;
              const firstOfRun = i === 0 || messages[i - 1].sender_email !== m.sender_email;
              const pending = m.id.startsWith('temp-');
              return (
                <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'} ${firstOfRun && i > 0 ? 'mt-2' : ''}`}>
                  {firstOfRun && <p className="mb-0.5 px-1 text-[11px] font-medium text-gray-400">{mine ? 'You' : otherPartyName}</p>}
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${mine ? 'rounded-br-md bg-marigold text-white' : 'rounded-bl-md bg-gray-100 text-gray-900'} ${pending ? 'opacity-60' : ''}`}>
                    <p className="whitespace-pre-line break-words">{m.body}</p>
                  </div>
                  <p className="mt-0.5 px-1 text-[10px] text-gray-400">{pending ? 'Sending…' : timeLabel(m.created_at)}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 p-2">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => { setDraft(e.target.value); resize(e.target); }}
            onKeyDown={onKeyDown}
            rows={1}
            maxLength={2000}
            aria-label={`Message ${otherPartyName}`}
            placeholder="Message…"
            className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-base text-gray-900 outline-none focus:border-marigold sm:text-sm"
          />
          <button
            type="button"
            onClick={send}
            disabled={sending || !draft.trim()}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-marigold px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            Send
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden className="hidden sm:block"><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
        {sendError ? (
          <p className="px-1 pt-1.5 text-xs text-red-600">{sendError}</p>
        ) : !touch ? (
          <p className="px-1 pt-1.5 text-[11px] text-gray-400">Enter to send · Shift+Enter for a new line</p>
        ) : null}
      </div>
    </div>
  );
}
