import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import type { Resource, TapEvent, ResourceReview, ResourceMedia } from '../lib/types';
import PublicHeader from '../components/discover/PublicHeader';

function pricingLabel(r: Resource) {
  if (r.pricing_type === 'contact_quote') return 'Contact for a quote';
  if (r.pricing_type === 'hourly') return `$${r.base_rate}/hour`;
  return `$${r.base_rate} flat rate`;
}

const SOCIAL_LINKS: Array<{ key: keyof Resource; label: string }> = [
  { key: 'instagram_url', label: 'Instagram' },
  { key: 'facebook_url', label: 'Facebook' },
  { key: 'youtube_url', label: 'YouTube' },
  { key: 'website_url', label: 'Website' },
];

export default function ResourceProfile() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [resource, setResource] = useState<Resource | null>(null);
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
  const [media, setMedia] = useState<ResourceMedia[]>([]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase.from('resources').select('*').eq('id', id).single();
      setResource((data as Resource) ?? null);
      setLoading(false);

      const [{ data: reviewRows }, { data: mediaRows }] = await Promise.all([
        supabase.from('resource_reviews').select('*').eq('resource_id', id).order('created_at', { ascending: false }),
        supabase.from('resource_media').select('*').eq('resource_id', id).order('display_order', { ascending: true }),
      ]);
      setReviews((reviewRows ?? []) as ResourceReview[]);
      setMedia((mediaRows ?? []) as ResourceMedia[]);
    })();
  }, [id]);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('events')
      .select('*')
      .eq('organizer_id', user.id)
      .order('start_date', { ascending: true })
      .then(({ data }) => setMyEvents((data ?? []) as TapEvent[]));
  }, [user?.id]);

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

    const html = `
      <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#4f46e5,#14b8a6);padding:24px;color:white;">
          <div style="font-size:20px;font-weight:800;">TapIN</div>
          <div style="margin-top:8px;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;opacity:0.9;">New booking request</div>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 12px;color:#374151;">You've received a new booking request for <strong>${selectedEvent?.title ?? 'an event'}</strong>.</p>
          <table style="width:100%;font-size:14px;color:#374151;">
            <tr><td style="padding:4px 0;color:#6b7280;width:100px;">Offered rate</td><td style="padding:4px 0;font-weight:600;">$${offeredRate}</td></tr>
            ${serviceDate ? `<tr><td style="padding:4px 0;color:#6b7280;">Date</td><td style="padding:4px 0;font-weight:600;">${serviceDate}</td></tr>` : ''}
            <tr><td style="padding:4px 0;color:#6b7280;">From</td><td style="padding:4px 0;font-weight:600;">${user.email}</td></tr>
          </table>
          ${message ? `<p style="margin:16px 0 0;color:#374151;">"${message}"</p>` : ''}
          <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">Log in to your Resource Dashboard on TapIN to accept or decline.</p>
        </div>
      </div>`;
    supabase.functions
      .invoke('send-ticket-confirmation', { body: { to: resource.email, subject: `New booking request: ${selectedEvent?.title ?? 'an event'}`, html } })
      .catch(() => { /* request already succeeded; notification is best-effort */ });
  }

  if (loading) return (<><PublicHeader /><div className="p-10 text-center text-gray-500">Loading…</div></>);
  if (!resource) return (<><PublicHeader /><div className="p-10 text-center text-magenta">Resource not found.</div></>);

  const averageRating = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white">
      <PublicHeader />
      <div className="mx-auto max-w-5xl px-4 py-10">
        <Link to="/resources" className="text-sm text-marigold hover:underline">&larr; Back to Artists &amp; Resources</Link>

        {resource.profile_image ? (
          <img src={resource.profile_image} alt="" className="mt-4 aspect-[21/9] w-full rounded-2xl object-cover" />
        ) : (
          <div className="mt-4 flex aspect-[21/9] w-full items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-teal-100">
            <span className="font-display text-6xl font-extrabold text-indigo-300">{resource.display_name.charAt(0)}</span>
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="md:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="font-display text-2xl font-bold text-gray-900">{resource.display_name}</h1>
                <p className="mt-1 text-sm text-gray-500">
                  {[resource.city, resource.state].filter(Boolean).join(', ') || resource.location || 'Location not listed'}
                </p>
              </div>
              <span className="rounded-full border border-green-600 px-3 py-1 text-sm font-medium text-green-600">
                {pricingLabel(resource)}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {resource.categories.map((c) => (
                <span key={c} className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">{c}</span>
              ))}
            </div>

            <p className="mt-2 text-sm text-gray-500">
              {reviews.length > 0 ? `\u2605 ${averageRating.toFixed(1)} average (${reviews.length} review${reviews.length === 1 ? '' : 's'})` : 'No reviews yet'}
            </p>

            <div className="mt-6 border-t border-gray-200 pt-6">
              <h2 className="font-display text-lg font-semibold text-gray-900">About</h2>
              <p className="mt-2 whitespace-pre-wrap text-gray-600">{resource.bio}</p>
            </div>

            {media.length > 0 && (
              <div className="mt-6 border-t border-gray-200 pt-6">
                <h2 className="font-display text-lg font-semibold text-gray-900">Portfolio</h2>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {media.map((m) => (
                    <img key={m.id} src={m.media_url} alt={m.caption ?? ''} className="aspect-square w-full rounded-lg object-cover" />
                  ))}
                </div>
              </div>
            )}

            {resource.pricing_details && (
              <div className="mt-6 border-t border-gray-200 pt-6">
                <h2 className="font-display text-lg font-semibold text-gray-900">Pricing details</h2>
                <p className="mt-2 whitespace-pre-wrap text-gray-600">{resource.pricing_details}</p>
              </div>
            )}

            {SOCIAL_LINKS.some((s) => resource[s.key]) && (
              <div className="mt-6 flex flex-wrap gap-3 border-t border-gray-200 pt-6">
                {SOCIAL_LINKS.filter((s) => resource[s.key]).map((s) => (
                  <a
                    key={s.key}
                    href={resource[s.key] as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:border-marigold hover:text-marigold"
                  >
                    {s.label}
                  </a>
                ))}
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
          </div>

          <div className="md:sticky md:top-6 md:self-start">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
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
                    className="rounded-lg bg-gradient-to-r from-marigold to-mint px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {submitting ? 'Sending…' : 'Send booking request'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
