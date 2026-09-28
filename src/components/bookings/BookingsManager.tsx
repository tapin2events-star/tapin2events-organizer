import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import BookingThread from './BookingThread';
import { MessageButton, ThreadPreview } from './ThreadEntry';
import { useThreadSummaries } from '../../lib/bookingThreads';
import type { ResourceBooking } from '../../lib/types';
import {
  BOOKING_FILTER_LABELS, BOOKING_STATUS_BORDER, BOOKING_STATUS_LABELS, BOOKING_STATUS_STYLES, OPEN_BOOKING_STATUSES,
  agreedRate, bookingPriority, filterOf, formatClock, formatServiceDate, money, tidy, type BookingFilter,
} from '../../lib/bookings';

interface BookingRow extends ResourceBooking {
  resource_name: string;
  resource_image: string | null;
  resource_categories: string[];
  event_title: string;
  event_status: string | null;
  has_review: boolean;
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} aria-label={`${n} star${n > 1 ? 's' : ''}`} className="p-1 text-2xl leading-none">
          <span className={n <= value ? 'text-orange-400' : 'text-gray-300'}>★</span>
        </button>
      ))}
    </div>
  );
}

// Everything an organizer needs to manage the artists, vendors, and services
// they've booked: status, dates, rates, cancelling, completing, reviewing, and
// whether each confirmed booking is listed on the public event page.
// Pass eventId to show just one event's bookings (the event's Bookings tab).
export default function BookingsManager({ eventId, title }: { eventId?: string; title?: string }) {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('booking');
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState<BookingFilter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [openDetails, setOpenDetails] = useState<Set<string>>(new Set(highlightId ? [highlightId] : []));
  const [openThread, setOpenThread] = useState<Set<string>>(new Set(highlightId && searchParams.get('messages') ? [highlightId] : []));
  const { summaries, applyLocal } = useThreadSummaries(bookings.map((b) => b.id));
  function toggleThread(id: string, forceOpen = false) {
    setOpenThread((prev) => {
      const n = new Set(prev);
      if (n.has(id) && !forceOpen) n.delete(id); else n.add(id);
      return n;
    });
  }
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  async function load() {
    if (!user?.email) return;
    let query = supabase.from('resource_bookings').select('*').eq('organizer_email', user.email).order('created_at', { ascending: false });
    if (eventId) query = query.eq('event_id', eventId);
    const { data: rows, error } = await query;
    if (error) {
      console.error('Failed to load bookings:', error);
      setLoadError(true);
      setLoading(false);
      return;
    }
    const resourceIds = [...new Set((rows ?? []).map((b) => b.resource_id))];
    const eventIds = [...new Set((rows ?? []).map((b) => b.event_id))];
    const bookingIds = (rows ?? []).map((b) => b.id);
    const [{ data: resources }, { data: events }, { data: reviews }] = await Promise.all([
      resourceIds.length ? supabase.from('resources').select('id, display_name, profile_image, categories').in('id', resourceIds) : Promise.resolve({ data: [] }),
      eventIds.length ? supabase.from('events').select('id, title, status').in('id', eventIds) : Promise.resolve({ data: [] }),
      bookingIds.length ? supabase.from('resource_reviews').select('booking_id').in('booking_id', bookingIds) : Promise.resolve({ data: [] }),
    ]);
    const resById = new Map((resources ?? []).map((r) => [r.id as string, r]));
    const evById = new Map((events ?? []).map((e) => [e.id as string, e]));
    const reviewed = new Set((reviews ?? []).map((r) => r.booking_id as string));
    setBookings(
      (rows ?? []).map((b) => {
        const r = resById.get(b.resource_id) as { display_name: string; profile_image: string | null; categories: string[] } | undefined;
        const e = evById.get(b.event_id) as { title: string; status: string } | undefined;
        return {
          ...(b as ResourceBooking),
          resource_name: tidy(r?.display_name) || 'Unavailable resource',
          resource_image: r?.profile_image ?? null,
          resource_categories: r?.categories ?? [],
          event_title: tidy(e?.title) || 'Untitled event',
          event_status: e?.status ?? null,
          has_review: reviewed.has(b.id),
        };
      })
    );
    setLoading(false);
  }

  useEffect(() => { load(); }, [user?.email, eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (highlightId && itemRefs.current[highlightId]) itemRefs.current[highlightId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightId, bookings.length]);

  const counts = useMemo(() => {
    const c: Record<BookingFilter, number> = { all: bookings.length, reply: 0, waiting: 0, booked: 0, completed: 0, closed: 0 };
    bookings.forEach((b) => { c[filterOf(b.status)]++; });
    return c;
  }, [bookings]);

  const visible = useMemo(() => {
    const list = filter === 'all' ? bookings : bookings.filter((b) => filterOf(b.status) === filter);
    return [...list].sort((a, b) => {
      const p = bookingPriority(a.status) - bookingPriority(b.status);
      if (p !== 0) return p;
      // Booked: soonest date first. Everything else: newest first.
      if (filterOf(a.status) === 'booked') return (a.booking_details?.service_date ?? '9999').localeCompare(b.booking_details?.service_date ?? '9999');
      return b.created_at.localeCompare(a.created_at);
    });
  }, [bookings, filter]);

  function patchLocal(id: string, patch: Partial<BookingRow>) {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  async function update(b: BookingRow, patch: Record<string, unknown>, local: Partial<BookingRow>, errorText: string) {
    setBusyId(b.id);
    setActionError(null);
    const { error } = await supabase.from('resource_bookings').update(patch).eq('id', b.id);
    setBusyId(null);
    if (error) {
      console.error('Booking update failed:', error);
      setActionError(errorText);
      return false;
    }
    patchLocal(b.id, local);
    return true;
  }

  async function respondToCounter(b: BookingRow, accept: boolean) {
    const status = accept ? 'accepted' : 'rejected';
    const ok = await update(b, { status }, { status: status as BookingRow['status'], final_rate: accept ? b.counter_offer_rate : b.final_rate }, 'Could not send your response. Please try again.');
    if (ok) {
      supabase.from('notifications').insert({
        user_email: b.resource_email,
        type: `counter_offer_${status}`,
        message: `${user!.email} has ${accept ? 'accepted' : 'declined'} your counter offer for ${b.event_title}`,
        link: `/resources/dashboard?booking=${b.id}`,
      }).then(() => {});
    }
  }

  async function cancelBooking(b: BookingRow) {
    const reason = cancelReason.trim().slice(0, 300);
    const ok = await update(b, { status: 'cancelled', cancellation_reason: reason || null }, { status: 'cancelled', cancellation_reason: reason || null }, 'Could not cancel this booking. Please try again.');
    if (ok) { setCancellingId(null); setCancelReason(''); }
  }

  async function toggleListed(b: BookingRow) {
    const next = !(b.show_on_event_page ?? true);
    patchLocal(b.id, { show_on_event_page: next });
    const { error } = await supabase.from('resource_bookings').update({ show_on_event_page: next }).eq('id', b.id);
    if (error) {
      patchLocal(b.id, { show_on_event_page: !next });
      setActionError("Couldn't change that. Please try again.");
    }
  }

  async function submitReview(b: BookingRow) {
    setBusyId(b.id);
    setActionError(null);
    const { error } = await supabase.from('resource_reviews').insert({ resource_id: b.resource_id, booking_id: b.id, reviewer_email: user!.email, rating, comment: comment.trim() || null });
    setBusyId(null);
    if (error) {
      console.error('Review failed:', error);
      setActionError('Could not submit your review. Please try again.');
      return;
    }
    patchLocal(b.id, { has_review: true });
    setReviewingId(null); setRating(5); setComment('');
  }

  const findLink = eventId ? `/resources?for_event=${eventId}` : '/resources';
  const btn = 'rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-medium text-gray-700 hover:border-marigold hover:text-marigold disabled:opacity-50';

  if (loading) return <p className="text-sm text-muted">Loading bookings…</p>;
  if (loadError) return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Couldn't load your bookings. Please refresh and try again.</p>;

  return (
    <div>
      {title && <h2 className="font-display text-xl font-bold text-gray-900">{title}</h2>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Artists, vendors, and services you've requested for {eventId ? 'this event' : 'your events'}.</p>
        <Link to={findLink} className="rounded-lg bg-marigold px-4 py-2.5 text-sm font-semibold text-white hover:bg-marigold/90">Find &amp; book a resource</Link>
      </div>

      <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
        TapIN doesn't handle payment for bookings. Once a resource accepts, agree on payment with them directly.
      </p>

      {bookings.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-white/60 px-6 py-12 text-center">
          <p className="font-display text-lg font-bold text-gray-900">No bookings yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">Book DJs, musicians, decorators, hosts, and more. Confirmed bookings can appear on your public event page.</p>
          <Link to={findLink} className="mt-4 inline-block rounded-lg bg-marigold px-5 py-2.5 text-sm font-semibold text-white">Browse resources</Link>
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Filter bookings">
            {(Object.keys(BOOKING_FILTER_LABELS) as BookingFilter[]).filter((f) => f === 'all' || counts[f] > 0).map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filter === f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${filter === f ? 'bg-marigold text-white' : 'border border-gray-200 bg-white text-gray-700 hover:border-marigold'}`}
              >
                {BOOKING_FILTER_LABELS[f]} <span className={filter === f ? 'text-white/80' : 'text-gray-400'}>{counts[f]}</span>
              </button>
            ))}
          </div>

          {actionError && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>}

          <div className="mt-4 flex flex-col gap-3">
            {visible.map((b) => {
              const d = b.booking_details ?? {};
              const date = formatServiceDate(d.service_date);
              const agreed = agreedRate(b);
              const open = OPEN_BOOKING_STATUSES.includes(b.status);
              const listedEligible = ['accepted', 'confirmed', 'completed'].includes(b.status);
              const detailsOpen = openDetails.has(b.id);
              const threadOpen = openThread.has(b.id);
              const times = [formatClock(d.start_time), formatClock(d.end_time)].filter(Boolean).join(' – ');
              return (
                <div
                  key={b.id}
                  ref={(el) => { itemRefs.current[b.id] = el; }}
                  className={`rounded-xl border border-l-4 bg-white p-4 shadow-sm ${BOOKING_STATUS_BORDER[b.status] ?? 'border-l-gray-300'} ${highlightId === b.id ? 'border-marigold ring-2 ring-marigold/40' : 'border-gray-200'}`}
                >
                  <div className="flex items-start gap-3">
                    {b.resource_image ? (
                      <img src={b.resource_image} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-marigold to-teal font-bold text-white">{b.resource_name.charAt(0).toUpperCase()}</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link to={`/resources/${b.resource_id}`} className="font-semibold text-gray-900 hover:text-marigold">{b.resource_name}</Link>
                          {b.resource_categories.length > 0 && <p className="truncate text-xs text-gray-500">{b.resource_categories.slice(0, 3).join(' · ')}</p>}
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${BOOKING_STATUS_STYLES[b.status] ?? BOOKING_STATUS_STYLES.pending}`}>{BOOKING_STATUS_LABELS[b.status] ?? b.status}</span>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">
                        {!eventId && (
                          <>
                            <Link to={`/organizer/events/${b.event_id}`} className="font-medium text-gray-800 hover:text-marigold">{b.event_title}</Link>
                            {' · '}
                          </>
                        )}
                        {date ?? 'Date not set'}
                        {times && ` · ${times}`}
                      </p>
                      <p className="mt-0.5 text-sm text-gray-500">
                        {agreed != null ? <>Agreed <strong className="text-gray-800">{money(agreed)}</strong></> : b.status === 'counter_offered' ? <>Offered {money(b.offered_rate)} · Countered <strong className="text-blue-700">{money(b.counter_offer_rate)}</strong></> : <>Offered {money(b.offered_rate)}</>}
                      </p>
                    </div>
                  </div>

                  {threadOpen ? (
                    <div className="mt-3">
                      <BookingThread
                        bookingId={b.id}
                        otherPartyName={b.resource_name}
                        starters={b.status === 'counter_offered'
                          ? [...(Number(b.offered_rate) > 0 ? [`Could you do ${money(b.offered_rate)}?`] : []), 'Can we meet in the middle?', 'What does that rate include?']
                          : ['Is this date still available?', 'What do you need for setup?', 'Is there flexibility on the rate?']}
                        onChange={(info) => applyLocal(b.id, info)}
                      />
                    </div>
                  ) : (
                    <ThreadPreview summary={summaries.get(b.id)} myEmail={user?.email} otherName={b.resource_name} onOpen={() => toggleThread(b.id, true)} />
                  )}

                  {b.status === 'counter_offered' && (
                    <div className="mt-3 rounded-lg bg-blue-50 p-3">
                      <p className="text-sm text-blue-800">{b.resource_name} proposed <strong>{money(b.counter_offer_rate)}</strong> instead of {money(b.offered_rate)}.</p>
                      {b.response_from_resource && <p className="mt-1 text-sm italic text-blue-900">"{tidy(b.response_from_resource)}"</p>}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button onClick={() => respondToCounter(b, true)} disabled={busyId === b.id} className="rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">Accept {money(b.counter_offer_rate)}</button>
                        <button onClick={() => respondToCounter(b, false)} disabled={busyId === b.id} className={btn}>Decline</button>
                        {!threadOpen && !summaries.get(b.id)?.message_count && <button onClick={() => toggleThread(b.id, true)} className={btn}>💬 Discuss</button>}
                      </div>
                    </div>
                  )}

                  {listedEligible && (
                    <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg bg-gray-50 px-3 py-2.5">
                      <input type="checkbox" checked={b.show_on_event_page ?? true} onChange={() => toggleListed(b)} className="mt-0.5 h-5 w-5 shrink-0 accent-marigold" />
                      <span className="text-sm text-gray-700">
                        <span className="font-medium">List on the event page</span>
                        <span className="block text-xs text-gray-500">
                          Shows {b.resource_name} under "Featured artists &amp; services"{b.event_status && !['published', 'completed'].includes(b.event_status) ? ' once the event is published' : ''}.
                        </span>
                      </span>
                    </label>
                  )}

                  {detailsOpen && (
                    <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 rounded-lg border border-gray-100 p-3 text-sm sm:grid-cols-2">
                      {d.setup_time && <div><dt className="text-xs text-gray-400">Setup</dt><dd className="text-gray-800">{formatClock(d.setup_time)}</dd></div>}
                      {d.breakdown_time && <div><dt className="text-xs text-gray-400">Breakdown</dt><dd className="text-gray-800">{formatClock(d.breakdown_time)}</dd></div>}
                      <div><dt className="text-xs text-gray-400">Requested</dt><dd className="text-gray-800">{new Date(b.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</dd></div>
                      {['accepted', 'confirmed', 'completed'].includes(b.status) && (
                        <div><dt className="text-xs text-gray-400">Contact</dt><dd><a href={`mailto:${b.resource_email}`} className="break-all text-marigold hover:underline">{b.resource_email}</a></dd></div>
                      )}
                      {d.special_requirements && <div className="sm:col-span-2"><dt className="text-xs text-gray-400">Requirements</dt><dd className="whitespace-pre-line text-gray-800">{tidy(d.special_requirements)}</dd></div>}
                      {b.message_from_organizer && <div className="sm:col-span-2"><dt className="text-xs text-gray-400">Your message</dt><dd className="whitespace-pre-line text-gray-800">{b.message_from_organizer}</dd></div>}
                      {b.response_from_resource && b.status !== 'counter_offered' && <div className="sm:col-span-2"><dt className="text-xs text-gray-400">Their reply</dt><dd className="whitespace-pre-line text-gray-800">{b.response_from_resource}</dd></div>}
                      {b.status === 'cancelled' && b.cancellation_reason && <div className="sm:col-span-2"><dt className="text-xs text-gray-400">Cancellation reason</dt><dd className="text-gray-800">{b.cancellation_reason}</dd></div>}
                    </dl>
                  )}

                  {cancellingId === b.id ? (
                    <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                      <p className="text-sm font-semibold text-red-800">Cancel this booking?</p>
                      <p className="mt-0.5 text-xs text-red-700">{b.resource_name} will be told right away{b.status === 'accepted' || b.status === 'confirmed' ? ", and will no longer be listed on your event page" : ''}. This can't be undone.</p>
                      <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} maxLength={300} rows={2} placeholder="Reason (optional). They'll see this." className="mt-2 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-base text-gray-900" />
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button onClick={() => cancelBooking(b)} disabled={busyId === b.id} className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">{busyId === b.id ? 'Cancelling…' : 'Cancel booking'}</button>
                        <button onClick={() => { setCancellingId(null); setCancelReason(''); }} disabled={busyId === b.id} className={btn}>Keep it</button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button onClick={() => setOpenDetails((prev) => { const n = new Set(prev); if (n.has(b.id)) n.delete(b.id); else n.add(b.id); return n; })} className={btn} aria-expanded={detailsOpen}>{detailsOpen ? 'Hide details' : 'Details'}</button>
                      <MessageButton summary={summaries.get(b.id)} open={threadOpen} onToggle={() => toggleThread(b.id)} className={btn} />
                      {(b.status === 'accepted' || b.status === 'confirmed') && (
                        <button onClick={() => update(b, { status: 'completed' }, { status: 'completed' }, 'Could not update this booking. Please try again.')} disabled={busyId === b.id} className={btn}>Mark completed</button>
                      )}
                      {b.status === 'completed' && !b.has_review && reviewingId !== b.id && (
                        <button onClick={() => setReviewingId(b.id)} className={btn}>Leave a review</button>
                      )}
                      {b.status === 'completed' && b.has_review && <span className="text-xs text-gray-400">✓ Review submitted</span>}
                      {open && (
                        <button onClick={() => { setCancellingId(b.id); setCancelReason(''); }} className="ml-auto rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50">Cancel booking</button>
                      )}
                    </div>
                  )}


                  {reviewingId === b.id && (
                    <div className="mt-3 rounded-lg bg-gray-50 p-3">
                      <StarPicker value={rating} onChange={setRating} />
                      <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="How was your experience? (optional)" rows={2} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-base text-gray-900" />
                      <div className="mt-2 flex gap-2">
                        <button onClick={() => submitReview(b)} disabled={busyId === b.id} className="rounded-lg bg-marigold px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Submit review</button>
                        <button onClick={() => setReviewingId(null)} className={btn}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {visible.length === 0 && <p className="rounded-xl border border-dashed border-gray-300 py-8 text-center text-sm text-gray-500">Nothing in this view.</p>}
          </div>
        </>
      )}
    </div>
  );
}
