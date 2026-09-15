import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import type { EventType } from '../lib/types';
import { AVAILABLE_FEATURES, type EventFeature } from '../lib/eventFeatures';

interface SponsorEntry {
  name: string;
  logo_url?: string;
  website?: string;
}
interface SponsorTier {
  tier_name: string;
  price: number;
  benefits: string;
  sponsors: SponsorEntry[];
}
interface VendorGroup {
  group_name: string;
  description?: string;
}

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

const STEPS = ['Event Details', 'Location & Schedule', 'Features', 'Sponsors & Vendors', 'Media & Social'] as const;

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
  const [vendorApplicationsEnabled, setVendorApplicationsEnabled] = useState(false);
  const [vendorFeeTiers, setVendorFeeTiers] = useState<{ tier_name: string; fee: number }[]>([]);
  const [vendorGroups, setVendorGroups] = useState<VendorGroup[]>([]);
  const [sponsorTiers, setSponsorTiers] = useState<SponsorTier[]>([]);
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
      setVendorApplicationsEnabled(!!data.vendor_applications_enabled);
      setVendorFeeTiers(Array.isArray(data.vendor_fees) ? data.vendor_fees : []);
      setVendorGroups(Array.isArray(data.vendors) ? data.vendors : []);
      setSponsorTiers(Array.isArray(data.sponsors) ? data.sponsors : []);
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

  function addSponsorTier() {
    setSponsorTiers((prev) => [...prev, { tier_name: '', price: 0, benefits: '', sponsors: [] }]);
  }
  function updateSponsorTier(index: number, updates: Partial<SponsorTier>) {
    setSponsorTiers((prev) => prev.map((t, i) => (i === index ? { ...t, ...updates } : t)));
  }
  function removeSponsorTier(index: number) {
    setSponsorTiers((prev) => prev.filter((_, i) => i !== index));
  }
  function addSponsorToTier(tierIndex: number) {
    setSponsorTiers((prev) =>
      prev.map((t, i) => (i === tierIndex ? { ...t, sponsors: [...t.sponsors, { name: '' }] } : t))
    );
  }
  function updateSponsorInTier(tierIndex: number, sponsorIndex: number, updates: Partial<SponsorEntry>) {
    setSponsorTiers((prev) =>
      prev.map((t, i) =>
        i === tierIndex ? { ...t, sponsors: t.sponsors.map((s, si) => (si === sponsorIndex ? { ...s, ...updates } : s)) } : t
      )
    );
  }
  function removeSponsorFromTier(tierIndex: number, sponsorIndex: number) {
    setSponsorTiers((prev) =>
      prev.map((t, i) => (i === tierIndex ? { ...t, sponsors: t.sponsors.filter((_, si) => si !== sponsorIndex) } : t))
    );
  }

  function addVendorGroup() {
    setVendorGroups((prev) => [...prev, { group_name: '', description: '' }]);
  }
  function updateVendorGroup(index: number, updates: Partial<VendorGroup>) {
    setVendorGroups((prev) => prev.map((g, i) => (i === index ? { ...g, ...updates } : g)));
  }
  function removeVendorGroup(index: number) {
    setVendorGroups((prev) => prev.filter((_, i) => i !== index));
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

    const payload: Record<string, unknown> = {
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
      vendor_applications_enabled: vendorApplicationsEnabled,
      vendor_fee: vendorFeeTiers[0]?.fee ?? 0,
      vendor_fees: vendorFeeTiers,
      vendors: vendorGroups,
      sponsors: sponsorTiers,
      poster_url: uploadedPosterUrl,
      social_links: { instagram: instagramUrl || null, facebook: facebookUrl || null, website: websiteUrl || null },
      status,
    };
    // Ownership is only ever set on creation. An edit must never touch
    // these fields — otherwise an admin editing someone else's event on
    // their behalf would silently reassign it to themselves.
    if (!isEdit) {
      payload.organizer_id = user.id;
      payload.organizer_email = user.email;
    }

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
          <div className="flex flex-col gap-6">
            <div>
              <h3 className="font-display text-lg font-semibold text-bone">Vendors</h3>
              <label className="mt-2 flex items-center gap-2 text-sm text-muted">
                <input type="checkbox" checked={vendorApplicationsEnabled} onChange={(e) => setVendorApplicationsEnabled(e.target.checked)} />
                Accept vendor applications for this event
              </label>

              {vendorApplicationsEnabled && (
                <>
                  <p className="mt-4 text-sm text-muted">Vendor fee tiers (e.g. Food Truck — $150, Craft Table — $75)</p>
                  <div className="mt-2 flex flex-col gap-2">
                    {vendorFeeTiers.map((t, i) => (
                      <div key={i} className="flex gap-2">
                        <input
                          className={`${inputClass} flex-1`}
                          placeholder="Tier name"
                          value={t.tier_name}
                          onChange={(e) => setVendorFeeTiers((prev) => prev.map((x, xi) => (xi === i ? { ...x, tier_name: e.target.value } : x)))}
                        />
                        <input
                          className={`${inputClass} w-28`}
                          type="number"
                          placeholder="Fee $"
                          value={t.fee}
                          onChange={(e) => setVendorFeeTiers((prev) => prev.map((x, xi) => (xi === i ? { ...x, fee: Number(e.target.value) || 0 } : x)))}
                        />
                        <button type="button" onClick={() => setVendorFeeTiers((prev) => prev.filter((_, xi) => xi !== i))} className="rounded-lg border border-gray-300 px-3 text-sm text-magenta">Remove</button>
                      </div>
                    ))}
                    <button type="button" onClick={() => setVendorFeeTiers((prev) => [...prev, { tier_name: '', fee: 0 }])} className="self-start rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-bone hover:border-marigold">
                      + Add fee tier
                    </button>
                  </div>

                  <p className="mt-4 text-sm text-muted">Vendor categories (optional — e.g. Food, Crafts, Services)</p>
                  <div className="mt-2 flex flex-col gap-2">
                    {vendorGroups.map((g, i) => (
                      <div key={i} className="flex gap-2">
                        <input
                          className={`${inputClass} flex-1`}
                          placeholder="Category name"
                          value={g.group_name}
                          onChange={(e) => updateVendorGroup(i, { group_name: e.target.value })}
                        />
                        <button type="button" onClick={() => removeVendorGroup(i)} className="rounded-lg border border-gray-300 px-3 text-sm text-magenta">Remove</button>
                      </div>
                    ))}
                    <button type="button" onClick={addVendorGroup} className="self-start rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-bone hover:border-marigold">
                      + Add category
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h3 className="font-display text-lg font-semibold text-bone">Sponsor tiers</h3>
              <p className="mt-1 text-sm text-muted">Define tiers (e.g. Gold, Silver) and add sponsors under each.</p>

              <div className="mt-3 flex flex-col gap-4">
                {sponsorTiers.map((tier, ti) => (
                  <div key={ti} className="rounded-xl border border-gray-300 bg-surface2 p-4">
                    <div className="flex gap-2">
                      <input
                        className={`${inputClass} flex-1`}
                        placeholder="Tier name (e.g. Gold)"
                        value={tier.tier_name}
                        onChange={(e) => updateSponsorTier(ti, { tier_name: e.target.value })}
                      />
                      <input
                        className={`${inputClass} w-28`}
                        type="number"
                        placeholder="Price"
                        value={tier.price}
                        onChange={(e) => updateSponsorTier(ti, { price: Number(e.target.value) || 0 })}
                      />
                      <button type="button" onClick={() => removeSponsorTier(ti)} className="rounded-lg border border-gray-300 px-3 text-sm text-magenta">Remove tier</button>
                    </div>
                    <textarea
                      className={`${inputClass} mt-2 w-full`}
                      rows={2}
                      placeholder="Benefits (e.g. Logo on materials, 4 tickets, booth space)"
                      value={tier.benefits}
                      onChange={(e) => updateSponsorTier(ti, { benefits: e.target.value })}
                    />

                    <div className="mt-3 flex flex-col gap-2">
                      {tier.sponsors.map((s, si) => (
                        <div key={si} className="flex gap-2">
                          <input
                            className={`${inputClass} flex-1`}
                            placeholder="Sponsor name"
                            value={s.name}
                            onChange={(e) => updateSponsorInTier(ti, si, { name: e.target.value })}
                          />
                          <input
                            className={`${inputClass} flex-1`}
                            placeholder="Website (optional)"
                            value={s.website ?? ''}
                            onChange={(e) => updateSponsorInTier(ti, si, { website: e.target.value })}
                          />
                          <button type="button" onClick={() => removeSponsorFromTier(ti, si)} className="rounded-lg border border-gray-300 px-3 text-sm text-magenta">Remove</button>
                        </div>
                      ))}
                      <button type="button" onClick={() => addSponsorToTier(ti)} className="self-start rounded-lg border border-gray-300 px-3 py-1 text-xs text-bone hover:border-marigold">
                        + Add sponsor to this tier
                      </button>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={addSponsorTier} className="self-start rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-bone hover:border-marigold">
                  + Add sponsor tier
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 5 && (
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
