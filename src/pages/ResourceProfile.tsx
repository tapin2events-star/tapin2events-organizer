import { useEffect, useState } from 'react';
import BackButton from '../components/BackButton';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import type { Resource, TapEvent, ResourceReview } from '../lib/types';
import ShopSection from '../components/products/ShopSection';
import ResourceMediaSection from '../components/resources/ResourceMediaSection';
import EventLinks from '../components/EventLinks';
import { visibleLinks } from '../lib/socialLinks';
import { DetailSkeleton } from '../components/ui/Skeleton';
import GroupMembersSection from '../components/groups/GroupMembersSection';
import GroupBadges from '../components/groups/GroupBadges';

function pricingLabel(r: Resource) {
  if (r.pricing_type === 'contact_quote') return 'Contact for a quote';
  if (r.pricing_type === 'hourly') return `$${r.base_rate}/hour`;
  return `$${r.base_rate} flat rate`;
}


export default function ResourceProfile() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const forEvent = searchParams.get('for_event');
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [resource, setResource] = useState<Resource | null>(null);
  const [groupRole, setGroupRole] = useState<string | null>(null);
  const isGroup = resource?.kind === 'group';
  useEffect(() => {
    if (!user || !id) { setGroupRole(null); return; }
    supabase.rpc('group_role', { p_group: id }).then(({ data }) => setGroupRole((data as string) ?? null));
  }, [user, id]);
  const [loading, setLoading] = useState(true);
  const [myEvents, setMyEvents] = useState<TapEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [serviceDate, setServiceDate] = useState('');
  const [offeredRate, setOfferedRate] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<ResourceReview[]>([]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase.from('resources').select('*').eq('id', id).single();
      setResource((data as Resource) ?? null);
      setLoading(false);

      const { data: reviewRows } = await supabase.from('resource_reviews').select('*').eq('resource_id', id).order('created_at', { ascending: false });
      setReviews((reviewRows ?? []) as ResourceReview[]);
    })();
  }, [id]);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('events')
      .select('*')
      .eq('organizer_id', user.id)
      .order('start_date', { ascending: true })
      .then(({ data }) => {
        const events = (data ?? []) as TapEvent[];
        setMyEvents(events);
        if (forEvent && events.some((e) => e.id === forEvent)) {
          setSelectedEventId(forEvent);
        }
      });
  }, [user?.id, forEvent]);

  async function handleBookingRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.email || !resource || !selectedEventId || !offeredRate) return;
    setSubmitting(true);
    setBookingError(null);

    const { data: newBooking, error } = await supabase.from('resource_bookings').insert({
      event_id: selectedEventId,
      resource_id: resource.id,
      organizer_email: user.email,
      resource_email: resource.email,
      offered_rate: parseFloat(offeredRate),
      message_from_organizer: message || null,
      booking_details: serviceDate ? { service_date: serviceDate } : {},
    }).select().single();

    setSubmitting(false);
    if (error) {
      setBookingError('Something went wrong sending your request. Please try again.');
      return;
    }
    setRequestSent(true);

    const selectedEvent = myEvents.find((e) => e.id === selectedEventId);

    // In-app notification — more reliable than email right now, since email
    // to anyone but our own test account isn't deliverable yet (unverified
    // sending domain). Best-effort: the request itself already succeeded.
    supabase
      .from('notifications')
      .insert({
        user_email: resource.email,
        type: 'booking_request',
        message: `New booking request from ${user.email} for ${selectedEvent?.title ?? 'an event'}`,
        link: `/resources/dashboard?booking=${newBooking?.id}`,
      })
      .then(() => {});

    // The server builds the email and checks you're the organizer who made the booking.
    if (newBooking?.id) {
      supabase.functions
        .invoke('send-app-email', { body: { kind: 'booking_request', booking_id: newBooking.id } })
        .catch(() => { /* request already succeeded; email is best-effort */ });
    }
  }

  // Arriving from the feed's "Book [Name]" button (/resources/:id#book).
  // Declared before the early returns below: hooks must run on every render.
  const location = useLocation();
  useEffect(() => {
    if (loading || !resource || location.hash !== '#book') return;
    setTimeout(() => document.getElementById('book')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
  }, [loading, resource, location.hash]);

  if (loading) return <DetailSkeleton className="mx-auto max-w-5xl px-4 py-10" label="Loading profile" />;
  if (!resource) return <div className="p-10 text-center text-magenta">Resource not found.</div>;
  // Inactive or suspended profiles (including deleted accounts) are hidden
  // from everyone except the owner and admins.
  if (resource.status && resource.status !== 'active' && resource.email !== user?.email && !isAdmin) {
    return (
      <div className="p-10 text-center">
        <p className="text-lg font-semibold text-bone">This profile isn't available</p>
        <p className="mt-1 text-sm text-muted">It may have been removed or deactivated.</p>
        <Link to="/resources" className="mt-4 inline-block text-sm font-medium text-marigold hover:underline">Browse other resources</Link>
      </div>
    );
  }

  const averageRating = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <BackButton fallback="/resources" fallbackLabel="Artists & Resources" />

        {(resource.cover_image || resource.profile_image) ? (
          <img src={resource.cover_image || resource.profile_image!} alt="" className="mt-4 aspect-[21/9] w-full rounded-2xl object-cover" />
        ) : (
          <div className="mt-4 flex aspect-[21/9] w-full items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-teal-100">
            <span className="font-display text-6xl font-extrabold text-indigo-300">{resource.display_name.charAt(0)}</span>
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="md:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="flex flex-wrap items-center gap-2 font-display text-2xl font-bold text-gray-900">
                  {isGroup && resource.cover_image && resource.profile_image && <img src={resource.profile_image} alt="" className="h-10 w-10 rounded-full object-cover" />}
                  {resource.display_name}
                  {isGroup && <span className="rounded-full bg-purple-100 px-2.5 py-0.5 font-sans text-xs font-semibold text-purple-800">Group</span>}
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  {[resource.city, resource.state].filter(Boolean).join(', ') || resource.location || 'Location not listed'}
                </p>
              </div>
              {!isGroup && (
                <span className="rounded-full border border-green-600 px-3 py-1 text-sm font-medium text-green-600">
                  {pricingLabel(resource)}
                </span>
              )}
              {isGroup && groupRole && (
                <Link to={`/groups/${resource.id}/manage`} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-marigold">
                  {groupRole === 'member' ? 'Group settings' : 'Manage group'}
                </Link>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {resource.categories.map((c) => (
                <span key={c} className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">{c}</span>
              ))}
            </div>

            {!isGroup && <GroupBadges email={resource.email} className="mt-3" />}

            <p className="mt-2 text-sm text-gray-500">
              {reviews.length > 0 ? `\u2605 ${averageRating.toFixed(1)} average (${reviews.length} review${reviews.length === 1 ? '' : 's'})` : 'No reviews yet'}
            </p>

            <div className="mt-6 border-t border-gray-200 pt-6">
              <h2 className="font-display text-lg font-semibold text-gray-900">About</h2>
              <p className="mt-2 whitespace-pre-wrap text-gray-600">{resource.bio}</p>
            </div>

            {isGroup && <GroupMembersSection groupId={resource.id} />}

            <ResourceMediaSection resourceId={resource.id} resourceEmail={resource.email} />

            {resource.pricing_details && (
              <div className="mt-6 border-t border-gray-200 pt-6">
                <h2 className="font-display text-lg font-semibold text-gray-900">Pricing details</h2>
                <p className="mt-2 whitespace-pre-wrap text-gray-600">{resource.pricing_details}</p>
              </div>
            )}

            {visibleLinks({ instagram: resource.instagram_url, facebook: resource.facebook_url, youtube: resource.youtube_url, website: resource.website_url }).length > 0 && (
              <div className="mt-6 border-t border-gray-200 pt-6">
                <EventLinks
                  title="Links"
                  links={{ instagram: resource.instagram_url, facebook: resource.facebook_url, youtube: resource.youtube_url, website: resource.website_url }}
                />
              </div>
            )}

            {reviews.length > 0 && (
              <div className="mt-6 border-t border-gray-200 pt-6">
                <h2 className="font-display text-lg font-semibold text-gray-900">Reviews</h2>
                <div className="mt-3 flex flex-col gap-3">
                  {reviews.map((r) => (
                    <div key={r.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                      <p className="text-sm text-orange-400">{'\u2605'.repeat(r.rating)}{'\u2606'.repeat(5 - r.rating)}</p>
                      {r.comment && <p className="mt-1 text-sm text-gray-600">{r.comment}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <ShopSection ownerType="resource" ownerId={resource.id} />
          </div>

          <div className="md:sticky md:top-6 md:self-start">
            {isGroup ? (
            <div id="book" className="scroll-mt-24 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs uppercase tracking-widest text-gray-400">Book this group</p>
              <p className="mt-1 font-display text-lg font-bold text-gray-900">{resource.display_name}</p>
              <p className="mt-3 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
                Booking groups directly is coming soon. For now, you can book members individually from their profiles above.
              </p>
            </div>
            ) : (
            <div id="book" className="scroll-mt-24 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs uppercase tracking-widest text-gray-400">Book this resource</p>
              <p className="mt-1 font-display text-lg font-bold text-gray-900">{resource.display_name}</p>
              <p className="text-sm text-gray-500">{pricingLabel(resource)}</p>

              {requestSent ? (
                <div className="mt-4 rounded-xl bg-green-50 p-4 text-sm text-green-700">
                  ✓ Your booking request has been sent to {resource.display_name}. They'll respond soon.
                </div>
              ) : !user ? (
                <div className="mt-4 rounded-xl bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">Sign in to request a booking for one of your events.</p>
                  <button
                    onClick={() => navigate('/login', { state: { from: `/resources/${id}` } })}
                    className="mt-3 w-full rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-ink hover:bg-marigold/90"
                  >
                    Sign in
                  </button>
                </div>
              ) : myEvents.length === 0 ? (
                <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
                  You'll need to <Link to="/organizer/new" className="font-medium text-marigold hover:underline">create an event</Link> before requesting a booking.
                </div>
              ) : (
                <form onSubmit={handleBookingRequest} className="mt-4 flex flex-col gap-3">
                  <label className="flex flex-col gap-1 text-sm text-gray-700">
                    For which event?
                    <select required value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900">
                      <option value="">Select an event…</option>
                      {myEvents.map((e) => (
                        <option key={e.id} value={e.id}>{e.title}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-gray-700">
                    Service date
                    <input type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900" />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-gray-700">
                    Offered rate ($)
                    <input required type="number" min="0" step="0.01" value={offeredRate} onChange={(e) => setOfferedRate(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900" />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-gray-700">
                    Message (optional)
                    <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900" placeholder="Tell them about your event and what you need" />
                  </label>
                  {bookingError && <p className="text-sm text-magenta">{bookingError}</p>}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-lg bg-gradient-to-r from-marigold to-teal px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {submitting ? 'Sending…' : 'Send booking request'}
                  </button>
                </form>
              )}
            </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
