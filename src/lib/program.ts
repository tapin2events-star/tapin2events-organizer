// Event lineup (who's on the bill) and schedule (what happens when).

export interface LineupEntry {
  id: string;
  role: string | null;
  bio: string | null;
  resource_id: string | null; // set for booked TapIN resources
  name: string;
  image_url: string | null;
  link_url: string | null;    // manual entries only
  categories: string[] | null;
}

export interface ScheduleItem {
  id: string;
  title: string;
  description: string | null;
  kind: ScheduleKind;
  starts_at: string;
  ends_at: string | null;
  area: string | null;
  lineup_ids: string[];
}

export type ScheduleKind = 'performance' | 'session' | 'keynote' | 'panel' | 'workshop' | 'break' | 'meal' | 'networking' | 'vendors' | 'other';

export const KIND_LABELS: Record<ScheduleKind, string> = {
  performance: 'Performance',
  session: 'Session',
  keynote: 'Keynote',
  panel: 'Panel',
  workshop: 'Workshop',
  break: 'Break',
  meal: 'Food & drinks',
  networking: 'Networking',
  vendors: 'Vendors open',
  other: 'Other',
};

export const KIND_STYLES: Record<ScheduleKind, string> = {
  performance: 'bg-marigold/15 text-marigold',
  session: 'bg-teal/15 text-teal',
  keynote: 'bg-purple-100 text-purple-800',
  panel: 'bg-blue-100 text-blue-800',
  workshop: 'bg-emerald-100 text-emerald-800',
  break: 'bg-gray-100 text-gray-600',
  meal: 'bg-orange-100 text-orange-800',
  networking: 'bg-pink-100 text-pink-800',
  vendors: 'bg-yellow-100 text-yellow-800',
  other: 'bg-gray-100 text-gray-700',
};

export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function timeRange(start: string, end: string | null): string {
  return end ? `${timeLabel(start)} – ${timeLabel(end)}` : timeLabel(start);
}

export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export function groupByDay(items: ScheduleItem[]): { key: string; label: string; items: ScheduleItem[] }[] {
  const groups = new Map<string, { key: string; label: string; items: ScheduleItem[] }>();
  for (const it of items) {
    const k = dayKey(it.starts_at);
    if (!groups.has(k)) groups.set(k, { key: k, label: dayLabel(it.starts_at), items: [] });
    groups.get(k)!.items.push(it);
  }
  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key));
}

// <input type="date"> / <input type="time"> values in the viewer's own time zone.
export function toDateInput(iso: string): string { return dayKey(iso); }
export function toTimeInput(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
export function fromInputs(date: string, time: string): string | null {
  if (!date || !time) return null;
  const d = new Date(`${date}T${time}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function initials(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}
