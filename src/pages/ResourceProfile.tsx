import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import type { Resource } from '../lib/types';
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
  const [resource, setResource] = useState<Resource | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase.from('resources').select('*').eq('id', id).single();
      setResource((data as Resource) ?? null);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return (<><PublicHeader /><div className="p-10 text-center text-gray-500">Loading…</div></>);
  if (!resource) return (<><PublicHeader /><div className="p-10 text-center text-magenta">Resource not found.</div></>);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white">
      <PublicHeader />
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link to="/resources" className="text-sm text-marigold hover:underline">&larr; Back to Artists &amp; Resources</Link>

        <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          {resource.profile_image ? (
            <img src={resource.profile_image} alt="" className="h-56 w-full object-cover" />
          ) : (
            <div className="flex h-56 w-full items-center justify-center bg-gradient-to-br from-indigo-100 to-teal-100">
              <span className="font-display text-6xl font-extrabold text-indigo-300">{resource.display_name.charAt(0)}</span>
            </div>
          )}

          <div className="p-6">
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
              {resource.review_count > 0 ? `\u2605 ${resource.average_rating.toFixed(1)} average (${resource.review_count} review${resource.review_count === 1 ? '' : 's'})` : 'No reviews yet'}
              {resource.total_bookings > 0 && ` \u00b7 ${resource.total_bookings} booking${resource.total_bookings === 1 ? '' : 's'} completed`}
            </p>

            <h2 className="mt-6 font-display text-lg font-semibold text-gray-900">About</h2>
            <p className="mt-2 whitespace-pre-wrap text-gray-600">{resource.bio}</p>

            {resource.pricing_details && (
              <>
                <h2 className="mt-6 font-display text-lg font-semibold text-gray-900">Pricing details</h2>
                <p className="mt-2 whitespace-pre-wrap text-gray-600">{resource.pricing_details}</p>
              </>
            )}

            {SOCIAL_LINKS.some((s) => resource[s.key]) && (
              <div className="mt-6 flex flex-wrap gap-3">
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

            <div className="mt-6 rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
              Booking requests aren't available yet — reach out directly using the links above, or contact {resource.email}.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
