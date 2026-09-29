import type { ResourceBookingStatus } from './types';

export const OPEN_BOOKING_STATUSES: ResourceBookingStatus[] = ['pending', 'counter_offered', 'accepted', 'confirmed'];

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending: 'Waiting for reply',
  counter_offered: 'Counter offer',
  accepted: 'Accepted',
  confirmed: 'Confirmed',
  completed: 'Completed',
  rejected: 'Declined',
  cancelled: 'Cancelled',
  deleted: 'Removed',
};

export const BOOKING_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-orange-100 text-orange-800',
  counter_offered: 'bg-blue-100 text-blue-800',
  accepted: 'bg-green-100 text-green-800',
  confirmed: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-red-100 text-red-800',
  deleted: 'bg-gray-100 text-gray-800',
};

export const BOOKING_STATUS_BORDER: Record<string, string> = {
  pending: 'border-l-orange-400',
  counter_offered: 'border-l-blue-400',
  accepted: 'border-l-green-500',
  confirmed: 'border-l-green-500',
  completed: 'border-l-gray-300',
  rejected: 'border-l-red-300',
  cancelled: 'border-l-red-300',
  deleted: 'border-l-gray-300',
};

export type BookingFilter = 'all' | 'reply' | 'waiting' | 'booked' | 'completed' | 'closed';

export const BOOKING_FILTER_LABELS: Record<BookingFilter, string> = {
  all: 'All',
  reply: 'Needs your reply',
  waiting: 'Waiting',
  booked: 'Booked',
  completed: 'Completed',
  closed: 'Closed',
};

export function filterOf(status: string): Exclude<BookingFilter, 'all'> {
  if (status === 'counter_offered') return 'reply';
  if (status === 'pending') return 'waiting';
  if (status === 'accepted' || status === 'confirmed') return 'booked';
  if (status === 'completed') return 'completed';
  return 'closed';
}

// Lower comes first: things needing you, then waiting, booked, completed, closed.
const PRIORITY: Record<Exclude<BookingFilter, 'all'>, number> = { reply: 0, waiting: 1, booked: 2, completed: 3, closed: 4 };
export function bookingPriority(status: string): number {
  return PRIORITY[filterOf(status)];
}

export function money(n: number | string | null | undefined): string {
  const v = Number(n) || 0;
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
}

// "2026-09-12" is that same day everywhere (never shifted by time zone).
export function formatServiceDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

// "17:30" -> "5:30 PM"; anything else is shown as typed.
export function formatClock(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!m) return value;
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h >= 12 ? 'PM' : 'AM'}`;
}

// The rate both sides have agreed on, once there is one.
export function agreedRate(b: { status: string; final_rate?: number | null; offered_rate: number }): number | null {
  if (b.final_rate != null) return b.final_rate;
  return ['accepted', 'confirmed', 'completed'].includes(b.status) ? b.offered_rate : null;
}

export function tidy(s: unknown): string {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

// Same fees as tickets: 3.7% + $1.79 service fee and 2.9% payment processing,
// paid by the organizer on top of the agreed price (the resource receives it in full).
export function bookingFees(rate: number) {
  const cents = Math.round((Number(rate) || 0) * 100);
  const service = Math.round(cents * 0.037) + 179;
  const processing = Math.round(cents * 0.029);
  return { service: service / 100, processing: processing / 100, total: (cents + service + processing) / 100 };
}
