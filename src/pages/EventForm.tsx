import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import type { EventType } from '../lib/types';
import { AVAILABLE_FEATURES, type EventFeature } from '../lib/eventFeatures';

const CATEGORIES = [
  'Music',
  'Arts & Culture',
  'Community',
  'Nightlife',
  'Food & Drink',
  'Business',
  'Sports & Fitness',
  'Other',
];

const STEPS = ['Event Details', 'Location & Schedule', 'Features', 'Media & Social'] as const;

export default function EventForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState(1);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [eventType, setEventType] = useState<EventType>('free');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isOnline, setIsOnline] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [ticketPrice, setTicketPrice] = useState('0');
  const [maxCapacity, setMaxCapacity] = useState('');
  const [features, setFeatures] = useState<EventFeature[]>([]);
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [instagramUrl, setInstagramUrl] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      const { data, error } = await supabase.from('events').select('*').eq('id', id).single();
      if (error || !data) {
        setError('Could not load this event.');
        setLoading(false);
        return;
      }
      setTitle(data.title ?? '');
      setDescription(data.description ?? '');
      setCategory(data.category ?? CATEGORIES[0]);
      setEventType(data.event_type ?? 'free');
      setStartDate(data.start_date ? data.start_date.slice(0, 16) : '');
      setEndDate(data.end_date ? data.end_date.slice(0, 16) : '');
      setIsOnline(!!data.is_online);
      setLocationName(data.location_name ?? '');
      setLocationAddress(data.location_address ?? '');
      setTicketPrice(String(data.ticket_price ?? 0));
      setMaxCapacity(data.max_capacity ? String(data.max_capacity) : '');
      setFeatures(Array.isArray(data.features) ? data.features : []);
      setPosterUrl(data.poster_url ?? null);
      setInstagramUrl(data.social_links?.instagram ?? '');
      setFacebookUrl(data.social_links?.facebook ?? '');
      setWebsiteUrl(data.social_links?.website ?? '');
      setStatus(data.status === 'published' ? 'published' : 'draft');
      setLoading(false);
    })();
  }, [id, isEdit]);

  function toggleFeature(f: EventFeature) {
    setFeatures((prev) =>
      prev.some((x) => x.title === f.title) ? prev.filter((x) => x.title !== f.title) : [...prev, f]
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!title.trim()) {
      setError('Event title is required.');
      setStep(1);
      return;
    }
    setSaving(true);
    setError(null);

    let uploadedPosterUrl = posterUrl;
    if (posterFile) {
      const path = `${user.id}/${Date.now()}-${posterFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('event-posters')
        .upload(path, posterFile, { upsert: true });
      if (uploadError) {
        setError(`Poster upload failed: ${uploadError.message}`);
        setSaving(false);
        return;
      }
      const { data: publicUrlData } = supabase.storage.from('event-posters').getPublicUrl(path);
      uploadedPosterUrl = publicUrlData.publicUrl;
    }

    const payload = {
      title,
      description,
      category,
      event_type: eventType,
      start_date: startDate ? new Date(startDate).toISOString() : null,
      end_date: endDate ? new Date(endDate).toISOString() : null,
      is_online: isOnline,
      location_name: locationName,
      location_address: locationAddress,
      ticket_price: eventType === 'free' ? 0 : Number(ticketPrice) || 0,
      max_capacity: maxCapacity ? Number(maxCapacity) : null,
      features,
      poster_url: uploadedPosterUrl,
      social_links: { instagram: instagramUrl || null, facebook: facebookUrl || null, website: websiteUrl || null },
      status,
      organizer_id: user.id,
      organizer_email: user.email,
    };

    const { data, error } = isEdit
      ? await supabase.from('events').update(payload).eq('id', id).select().single()
      : await supabase.from('events').insert(payload).select().single();

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }
    navigate(`/organizer/events/${data.id}`);
  }

  if (loading) return <p className="text-muted">Loading…</p>;

  const isLastStep = step === STEPS.length;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 font-display text-3xl font-extrabold text-bone">
        {isEdit ? 'Edit event' : 'Create event'}
      </h1>

      {/* Step indicator — every circle is directly clickable, so steps can
          be jumped to and skipped freely rather than forcing a strict
          next-only sequence. */}
      <div className="mb-2 flex items-center">
        {STEPS.map((label, i) => {
          const n = i + 1;
          return (
            <div key={label} className="flex flex-1 items-center last:flex-none">
              <button
                type="button"
                onClick={() => setStep(n)}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition ${
                  step === n ? 'bg-gradient-to-r from-marigold to-mint text-white' : 'bg-surface2 text-muted hover:text-bone'
                }`}
              >
                {n}
              </button>
              {n < STEPS.length && <div className="mx-1 h-0.5 flex-1 bg-surface2" />}
            </div>
          );
        })}
      </div>
      <p className="mb-6 text-sm text-muted">Step {step} of {STEPS.length} &middot; {STEPS[step - 1]}</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {step === 1 && (
          <>
            <Field label="Title">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputClass}
                placeholder="Juneteenth Block Party"
              />
            </Field>

            <Field label="Description">
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className={inputClass} />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Category">
                <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Type">
                <select value={eventType} onChange={(e) => setEventType(e.target.value as EventType)} className={inputClass}>
                  <option value="free">Free</option>
                  <option value="paid">Paid</option>
                  <option value="private">Private</option>
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {eventType !== 'free' && (
                <Field label="Ticket price ($)">
                  <input type="number" min="0" step="0.01" value={ticketPrice} onChange={(e) => setTicketPrice(e.target.value)} className={inputClass} />
                </Field>
              )}
              <Field label="Max capacity">
                <input type="number" min="0" value={maxCapacity} onChange={(e) => setMaxCapacity(e.target.value)} className={inputClass} />
              </Field>
            </div>

            <Field label="Publish status">
              <select value={status} onChange={(e) => setStatus(e.target.value as 'draft' | 'published')} className={inputClass}>
                <option value="draft">Draft (only you can see it)</option>
                <option value="published">Published (visible to attendees)</option>
              </select>
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Starts">
                <input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Ends">
                <input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
              </Field>
            </div>

            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={isOnline} onChange={(e) => setIsOnline(e.target.checked)} />
              This is a virtual/online event
            </label>

            {!isOnline && (
              <>
                <Field label="Venue name">
                  <input value={locationName} onChange={(e) => setLocationName(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Address">
                  <input value={locationAddress} onChange={(e) => setLocationAddress(e.target.value)} className={inputClass} />
                </Field>
              </>
            )}
          </>
        )}

        {step === 3 && (
          <div>
            <p className="text-sm text-muted">Highlight what makes your event special. Select any that apply — this is entirely optional.</p>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {AVAILABLE_FEATURES.map((f) => {
                const selected = features.some((x) => x.title === f.title);
                return (
                  <button
                    key={f.title}
                    type="button"
                    onClick={() => toggleFeature(f)}
                    className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition ${
                      selected ? 'border-marigold bg-marigold/10' : 'border-gray-300 bg-surface2 hover:border-marigold/50'
                    }`}
                  >
                    <span className="text-xl leading-none">{f.icon}</span>
                    <span>
                      <span className="block text-sm font-semibold text-bone">{f.title}</span>
                      <span className="block text-xs text-muted">{f.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 4 && (
          <>
            <Field label="Poster image">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setPosterFile(e.target.files?.[0] ?? null)}
                className="text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface2 file:px-3 file:py-1.5 file:text-bone"
              />
              {posterUrl && !posterFile && (
                <img src={posterUrl} alt="Current poster" className="mt-2 h-24 rounded-lg object-cover" />
              )}
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Instagram">
                <input value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} className={inputClass} placeholder="https://" />
              </Field>
              <Field label="Facebook">
                <input value={facebookUrl} onChange={(e) => setFacebookUrl(e.target.value)} className={inputClass} placeholder="https://" />
              </Field>
              <Field label="Website">
                <input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} className={inputClass} placeholder="https://" />
              </Field>
            </div>
          </>
        )}

        {error && <p className="text-sm text-magenta">{error}</p>}

        <div className="flex flex-wrap gap-3">
          {step > 1 && (
            <button type="button" onClick={() => setStep(step - 1)} className="rounded-lg border border-gray-300 px-5 py-2.5 font-semibold text-bone hover:border-marigold">
              Back
            </button>
          )}
          {!isLastStep && (
            <button type="button" onClick={() => setStep(step + 1)} className="rounded-lg bg-marigold px-5 py-2.5 font-semibold text-ink hover:bg-marigold/90">
              Next
            </button>
          )}
          {isLastStep && (
            <button type="submit" disabled={saving} className="rounded-lg bg-marigold px-5 py-2.5 font-semibold text-ink hover:bg-marigold/90 disabled:opacity-50">
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create event'}
            </button>
          )}
          <button type="button" onClick={() => navigate(-1)} className="rounded-lg px-5 py-2.5 font-semibold text-muted hover:text-bone">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

const inputClass =
  'rounded-lg border border-gray-300 bg-surface2 px-3 py-2 text-bone outline-none focus-visible:border-marigold';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm text-muted">
      {label}
      {children}
    </label>
  );
}
