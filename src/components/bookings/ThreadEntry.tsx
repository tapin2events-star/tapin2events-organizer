import { relativeTime, type ThreadSummary } from '../../lib/bookingThreads';

// The latest message on a booking, shown on the card while the conversation
// is closed. Tapping it opens the conversation. Highlighted when unread.
export function ThreadPreview({ summary, myEmail, otherName, onOpen }: { summary: ThreadSummary | undefined; myEmail: string | undefined; otherName: string; onOpen: () => void }) {
  if (!summary || summary.message_count === 0 || !summary.last_body) return null;
  const mine = summary.last_sender_email === myEmail;
  const unread = summary.unread_count > 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`mt-3 flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition ${
        unread ? 'bg-indigo-50 ring-1 ring-marigold/30 hover:bg-indigo-100' : 'bg-gray-50 hover:bg-gray-100'
      }`}
    >
      <span aria-hidden className="mt-0.5">💬</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={`min-w-0 truncate text-xs ${unread ? 'font-semibold text-gray-900' : 'font-medium text-gray-500'}`}>{mine ? 'You' : otherName}</span>
          <span className="shrink-0 text-xs text-gray-400">{relativeTime(summary.last_at)}</span>
          {unread && <span className="ml-auto shrink-0 rounded-full bg-magenta px-2 py-0.5 text-[11px] font-bold text-white">{summary.unread_count} new</span>}
        </span>
        <span className={`mt-0.5 block truncate ${unread ? 'text-gray-900' : 'text-gray-600'}`}>{summary.last_body}</span>
      </span>
    </button>
  );
}

// Opens/closes the conversation, with an unread count while it's closed.
export function MessageButton({ summary, open, onToggle, className }: { summary: ThreadSummary | undefined; open: boolean; onToggle: () => void; className: string }) {
  const unread = summary?.unread_count ?? 0;
  const label = open ? 'Hide conversation' : summary?.message_count ? 'Open conversation' : 'Message';
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} className={className}>
      💬 {label}
      {!open && unread > 0 && (
        <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-magenta px-1.5 text-[11px] font-bold leading-5 text-white">{unread}</span>
      )}
    </button>
  );
}
