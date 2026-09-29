import type { ReactNode } from 'react';

// Loading placeholders. Each page shows its full layout right away, with
// gray shapes where content is still arriving, so nothing jumps around when
// it loads. Shapes match the real content's size and position.
// Pulsing is skipped for people who've turned on "reduce motion".

export function Skeleton({ className = '' }: { className?: string }) {
  // Default corners, unless the caller picked its own (e.g. a round avatar).
  const corners = /(^|\s)rounded(-|\s|$)/.test(className) ? '' : 'rounded-md ';
  return <div aria-hidden className={`${corners}bg-gray-200/80 motion-safe:animate-pulse ${className}`} />;
}

// Wraps a placeholder so screen readers hear "Loading" once, not a pile of shapes.
export function LoadingRegion({ label = 'Loading', className = '', children }: { label?: string; className?: string; children: ReactNode }) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">{label}…</span>
      {children}
    </div>
  );
}

function Lines({ widths }: { widths: string[] }) {
  return (
    <div className="flex flex-col gap-2">
      {widths.map((w, i) => <Skeleton key={i} className={`h-4 ${w}`} />)}
    </div>
  );
}

// Matches DiscoverEventCard.
export function EventCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <Skeleton className="h-48 w-full rounded-none" />
      <div className="p-4">
        <Skeleton className="h-5 w-4/5" />
        <div className="mt-3"><Lines widths={['w-1/2', 'w-2/3']} /></div>
        <Skeleton className="mt-4 h-9 w-full rounded-lg" />
      </div>
    </div>
  );
}

export function EventCardGridSkeleton({ count = 6, className = 'mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3' }: { count?: number; className?: string }) {
  return (
    <LoadingRegion label="Loading events" className={className}>
      {Array.from({ length: count }, (_, i) => <EventCardSkeleton key={i} />)}
    </LoadingRegion>
  );
}

// Matches the 3-across 9:16 video grids on profiles.
export function TileGridSkeleton({ count = 6, className = 'mt-3' }: { count?: number; className?: string }) {
  return (
    <div className={`grid grid-cols-3 gap-1 ${className}`}>
      {Array.from({ length: count }, (_, i) => <Skeleton key={i} className="aspect-[9/16] w-full rounded-lg" />)}
    </div>
  );
}

// Matches the compact white rows on the dashboard (Earnings, Resource bookings…).
export function RowSkeleton({ tall = false, twoLine = false, subtitle = false }: { tall?: boolean; twoLine?: boolean; subtitle?: boolean }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
      <div className="flex-1">
        <Skeleton className={subtitle ? 'h-4 w-40' : 'h-3 w-24'} />
        <Skeleton className={`mt-2 ${tall ? 'h-7 w-32' : subtitle ? 'h-3 w-56 max-w-full' : 'h-4 w-56 max-w-full'}`} />
        {tall && <Skeleton className="mt-2 h-3 w-40" />}
        {twoLine && <Skeleton className="mt-2 h-4 w-32 sm:hidden" />}
      </div>
      <Skeleton className="h-4 w-16" />
    </div>
  );
}

// A generic list of rows (tickets, orders, bookings, applications…).
export function ListSkeleton({ rows = 4, className = 'mt-6' }: { rows?: number; className?: string }) {
  return (
    <LoadingRegion className={`flex flex-col gap-3 ${className}`}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
          <Skeleton className="h-14 w-14 shrink-0 rounded-lg" />
          <div className="flex-1"><Lines widths={['w-3/5', 'w-2/5']} /></div>
        </div>
      ))}
    </LoadingRegion>
  );
}

// ---------- Full-page layouts ----------

// Public event page: hero, facts, organizer row, ticket box, description.
export function EventPageSkeleton() {
  return (
    <LoadingRegion label="Loading event" className="min-h-screen bg-ink">
      <div className="relative aspect-[16/9] w-full bg-gray-300 motion-safe:animate-pulse sm:aspect-[21/9]">
        <div className="absolute inset-x-4 bottom-5 sm:inset-x-6">
          <div className="mx-auto max-w-3xl">
            <div className="h-5 w-20 rounded-full bg-white/40" />
            <div className="mt-3 h-8 w-4/5 rounded-md bg-white/50" />
            <div className="mt-2 h-8 w-3/5 rounded-md bg-white/50" />
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <Lines widths={['w-48', 'w-40']} />
        <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-5">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="mt-6 h-40 w-full rounded-2xl" />
        <div className="mt-8"><Lines widths={['w-full', 'w-full', 'w-11/12', 'w-4/5', 'w-2/3']} /></div>
      </div>
    </LoadingRegion>
  );
}

// Social feed: a full-screen dark video with the side buttons and caption area.
export function FeedSkeleton() {
  return (
    <LoadingRegion label="Loading feed" className="relative h-[100dvh] w-full overflow-hidden bg-gray-900">
      <div className="absolute inset-x-0 top-4 flex justify-center gap-6">
        <div className="h-4 w-16 rounded bg-white/25" />
        <div className="h-4 w-20 rounded bg-white/15" />
      </div>
      <div className="absolute bottom-28 right-4 flex flex-col items-center gap-6 md:bottom-10">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-10 w-10 rounded-full bg-white/20 motion-safe:animate-pulse" />)}
      </div>
      <div className="absolute bottom-24 left-4 right-20 md:bottom-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-white/25 motion-safe:animate-pulse" />
          <div className="h-4 w-32 rounded bg-white/25 motion-safe:animate-pulse" />
        </div>
        <div className="mt-3 h-3.5 w-full rounded bg-white/20 motion-safe:animate-pulse" />
        <div className="mt-2 h-3.5 w-3/4 rounded bg-white/20 motion-safe:animate-pulse" />
      </div>
    </LoadingRegion>
  );
}

// Social profile (creator page, and the signed-in Profile page).
export function ProfileSkeleton({ withBack = true, className = 'mx-auto max-w-2xl px-4 py-8' }: { withBack?: boolean; className?: string }) {
  return (
    <LoadingRegion label="Loading profile" className={className}>
      {withBack && <Skeleton className="h-4 w-14" />}
      <div className="mt-4 flex items-center gap-4">
        <Skeleton className="h-20 w-20 shrink-0 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-6 w-40" />
          <div className="mt-2 flex gap-2"><Skeleton className="h-5 w-20 rounded-full" /><Skeleton className="h-5 w-20 rounded-full" /></div>
        </div>
      </div>
      <div className="mt-4"><Lines widths={['w-full', 'w-3/4']} /></div>
      <div className="mt-5 flex gap-8">
        {[0, 1, 2].map((i) => <div key={i}><Skeleton className="h-5 w-8" /><Skeleton className="mt-1.5 h-3 w-14" /></div>)}
      </div>
      <div className="mt-6 flex gap-6 border-b border-gray-200 pb-3">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-4 w-14" />)}
      </div>
      <TileGridSkeleton />
    </LoadingRegion>
  );
}

// Detail pages with an image beside text (resource profile, product page).
export function DetailSkeleton({ className = 'mx-auto max-w-2xl px-4 py-8', label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <LoadingRegion label={label} className={className}>
      <Skeleton className="h-4 w-14" />
      <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Skeleton className="aspect-square w-full rounded-2xl" />
        <div>
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="mt-3 h-6 w-24" />
          <div className="mt-5"><Lines widths={['w-full', 'w-full', 'w-5/6', 'w-2/3']} /></div>
          <Skeleton className="mt-6 h-12 w-full rounded-xl" />
        </div>
      </div>
    </LoadingRegion>
  );
}

// Ticket / QR pass.
export function TicketSkeleton() {
  return (
    <LoadingRegion label="Loading ticket" className="min-h-screen bg-gradient-to-br from-indigo-50 to-white">
      <div className="mx-auto max-w-md px-4 py-10">
        <div className="overflow-hidden rounded-3xl bg-white shadow-lg">
          <Skeleton className="h-40 w-full rounded-none" />
          <div className="p-6">
            <Skeleton className="h-6 w-3/4" />
            <div className="mt-3"><Lines widths={['w-1/2', 'w-2/3']} /></div>
            <Skeleton className="mx-auto mt-6 h-52 w-52 rounded-2xl" />
          </div>
        </div>
      </div>
    </LoadingRegion>
  );
}

// Organizer's event management page: banner, title + buttons, tabs, stat cards.
export function OrganizerEventSkeleton() {
  return (
    <LoadingRegion label="Loading event">
      <Skeleton className="mb-6 aspect-[21/9] w-full rounded-2xl" />
      <Skeleton className="h-8 w-2/3" />
      <div className="mt-3 flex flex-wrap gap-2">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-28 rounded-lg" />)}
      </div>
      <div className="mt-6 flex gap-5 border-b border-gray-200 pb-3">
        {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-4 w-16" />)}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    </LoadingRegion>
  );
}

// Organizer Dashboard's event list (matches the ticket-stub event cards).
export function DashboardEventsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <LoadingRegion label="Loading your events" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <Skeleton className="h-40 w-full rounded-none" />
          <div className="p-5">
            <Skeleton className="h-5 w-3/4" />
            <div className="mt-3"><Lines widths={['w-1/2', 'w-1/3']} /></div>
            <Skeleton className="mt-5 h-11 w-full rounded-xl" />
          </div>
        </div>
      ))}
    </LoadingRegion>
  );
}

// Matches the "Needs attention" card at the top of the Organizer Dashboard.
export function NeedsAttentionSkeleton() {
  return (
    <LoadingRegion label="Checking what needs your attention" className="mb-4 rounded-2xl border border-gray-200 bg-white p-4">
      <Skeleton className="h-5 w-40" />
      <div className="mt-3 flex flex-col gap-2">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    </LoadingRegion>
  );
}
