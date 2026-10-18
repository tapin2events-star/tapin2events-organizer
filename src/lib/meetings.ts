export interface MeetingRow {
  id: string; title: string; starts_at: string; ends_at: string | null; location: string | null; video_url: string | null; status: 'scheduled' | 'cancelled';
  event_id: string | null; event_title: string | null; organization_id: string | null; org_name: string | null; org_color: string | null;
  can_manage: boolean; my_rsvp: 'pending' | 'going' | 'maybe' | 'no' | null; going: number; maybe: number; invited: number;
}
export interface PollRow {
  id: string; title: string; status: string; meeting_id: string | null; organization_id: string | null; org_name: string | null; event_title: string | null;
  can_manage: boolean; created_at: string; options: number; responded: number; invited: number; i_voted: boolean;
}
export interface PlanTarget { kind: 'event' | 'org'; id: string; label: string; orgId: string | null }

export const meetingWhen = (iso: string, withYear = false) =>
  new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', ...(withYear ? { year: 'numeric' } : {}) }).replace(':00 ', ' ');

const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const endOf = (m: { starts_at: string; ends_at: string | null }) => m.ends_at || new Date(new Date(m.starts_at).getTime() + 3600_000).toISOString();

// guests: for the organizer, invitees are added as Google Calendar guests (Google can then send them invites).
export function googleCalendarUrl(m: { id: string; title: string; starts_at: string; ends_at: string | null; location: string | null; video_url: string | null; agenda?: string | null }, guests: string[] = []) {
  const details = [m.video_url ? `Join: ${m.video_url}` : '', m.agenda ? `Agenda: ${m.agenda}` : '', `Details: https://app.tapin2events.com/meetings/${m.id}`].filter(Boolean).join('\n\n');
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(m.title)}&dates=${stamp(m.starts_at)}/${stamp(endOf(m))}&details=${encodeURIComponent(details)}${m.location || m.video_url ? `&location=${encodeURIComponent(m.location || m.video_url || '')}` : ''}${guests.length ? `&add=${encodeURIComponent(guests.join(','))}` : ''}`;
}

// Finds the meeting link in pasted text (e.g. "Team sync https://meet.google.com/abc-defg-hij", or a link without https://).
export function extractMeetingLink(text: string): string | null {
  const t = (text || '').trim();
  const full = t.match(/https?:\/\/[^\s<>"')]+/i);
  if (full) return full[0].replace(/[.,;]+$/, '');
  const bare = t.match(/\b((?:meet\.google\.com|[\w-]+\.zoom\.us|zoom\.us|teams\.microsoft\.com|teams\.live\.com|[\w-]+\.webex\.com)\/[^\s<>"')]+)/i);
  return bare ? `https://${bare[1].replace(/[.,;]+$/, '')}` : null;
}

// .ics file for Apple Calendar, Outlook and others.
export function downloadIcs(m: { id: string; title: string; starts_at: string; ends_at: string | null; location: string | null; video_url: string | null; agenda?: string | null }) {
  const escIcs = (t: string) => t.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const desc = [m.video_url ? `Join: ${m.video_url}` : '', m.agenda ?? '', `https://app.tapin2events.com/organizer/meetings/${m.id}`].filter(Boolean).join('\n\n');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TapIN//Meetings//EN', 'BEGIN:VEVENT',
    `UID:${m.id}@tapin2events.com`, `DTSTAMP:${stamp(new Date().toISOString())}`, `DTSTART:${stamp(m.starts_at)}`, `DTEND:${stamp(endOf(m))}`,
    `SUMMARY:${escIcs(m.title)}`, m.location ? `LOCATION:${escIcs(m.location)}` : '', `DESCRIPTION:${escIcs(desc)}`, m.video_url ? `URL:${m.video_url}` : '',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = `${m.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'meeting'}.ics`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// "2026-10-20" + "19:00" in the person's local time -> ISO string.
export const toIso = (date: string, time: string) => new Date(`${date}T${time || '19:00'}`).toISOString();
