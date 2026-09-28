import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';

interface Message {
  id: string;
  sender_email: string;
  body: string;
  created_at: string;
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// A simple back-and-forth thread on one booking, for negotiating rates,
// logistics, or anything else that doesn't fit the one-line request/reply
// fields. Works the same for the organizer and the resource -- each just
// sees their own messages on the right.
export default function BookingThread({ bookingId, otherPartyName }: { bookingId: string; otherPartyName: string }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  async function load() {
    const { data, error } = await supabase.from('booking_messages').select('id, sender_email, body, created_at').eq('booking_id', bookingId).order('created_at', { ascending: true });
    if (error) {
      console.error('Failed to load booking messages:', error);
      setLoadError(true);
      setLoading(false);
      return;
    }
    setMessages((data ?? []) as Message[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [bookingId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'nearest' }); }, [messages.length]);

  async function send() {
    const body = draft.trim();
    if (!body || !user?.email) return;
    setSending(true);
    setSendError(null);
    // Optimistic: show it immediately, since the sender is forced server-side
    // anyway (nothing here can misattribute a message).
    const optimistic: Message = { id: `temp-${Date.now()}`, sender_email: user.email, body, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, optimistic]);
    setDraft('');
    const { data, error } = await supabase.from('booking_messages').insert({ booking_id: bookingId, body, sender_email: user.email }).select('id, sender_email, body, created_at').single();
    setSending(false);
    if (error || !data) {
      console.error('Failed to send booking message:', error);
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(body);
      setSendError(error?.message?.includes('Too many') ? "You're sending messages too fast. Please slow down." : "Couldn't send. Please try again.");
      return;
    }
    setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? { ...(data as Message), created_at: (data as Message).created_at ?? optimistic.created_at } : m)));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="max-h-72 overflow-y-auto p-3">
        {loading ? (
          <p className="py-4 text-center text-sm text-muted">Loading messages…</p>
        ) : loadError ? (
          <p className="py-4 text-center text-sm text-red-600">Couldn't load this conversation. Please refresh.</p>
        ) : messages.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">No messages yet. Say hello to {otherPartyName}.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {messages.map((m) => {
              const mine = m.sender_email === user?.email;
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? 'bg-marigold text-white' : 'bg-gray-100 text-gray-900'}`}>
                    <p className="whitespace-pre-line break-words">{m.body}</p>
                    <p className={`mt-0.5 text-[10px] ${mine ? 'text-white/70' : 'text-gray-400'}`}>{timeLabel(m.created_at)}</p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
      <div className="flex items-end gap-2 border-t border-gray-100 p-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          maxLength={2000}
          placeholder={`Message ${otherPartyName}…`}
          className="max-h-28 flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-marigold"
        />
        <button
          type="button"
          onClick={send}
          disabled={sending || !draft.trim()}
          className="shrink-0 rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Send
        </button>
      </div>
      {sendError && <p className="px-3 pb-2 text-xs text-red-600">{sendError}</p>}
    </div>
  );
}
