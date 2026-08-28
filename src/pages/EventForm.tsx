import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import type { EventType } from '../lib/types';

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

export default function EventForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [eventType, setEventType] = useState<EventType>('free');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [ticketPrice, setTicketPrice] = useState('0');
  const [maxCapacity, setMaxCapacity] = useState('');
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
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
      setLocationName(data.location_name ?? '');
      setLocationAddress(data.location_address ?? '');
      setTicketPrice(String(data.ticket_price ?? 0));
      setMaxCapacity(data.max_capacity ? String(data.max_capacity) : '');
      setPosterUrl(data.poster_url ?? null);
      setStatus(data.status === 'published' ? 'published' : 'draft');
      setLoading(false);
    })();
  }, [id, isEdit]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
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
      location_name: locationName,
      location_address: locationAddress,
      ticket_price: eventType === 'free' ? 0 : Number(ticketPrice) || 0,
      max_capacity: maxCapacity ? Number(maxCapacity) : null,
      poster_url: uploadedPosterUrl,
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
    navigate(`/events/${data.id}`);
  }

  if (loading) return <p className="text-muted">Loading…</p>;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 font-display text-3xl font-extrabold text-bone">
        {isEdit ? 'Edit event' : 'Create event'}
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Field label="Title">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
            placeholder="Juneteenth Block Party"
          />
        </Field>

        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Category">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Type">
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value as EventType)}
              className={inputClass}
            >
              <option value="free">Free</option>
              <option value="paid">Paid</option>
              <option value="private">Private</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Starts">
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Ends">
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Venue name">
          <input
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Address">
          <input
            value={locationAddress}
            onChange={(e) => setLocationAddress(e.target.value)}
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {eventType !== 'free' && (
            <Field label="Ticket price ($)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={ticketPrice}
                onChange={(e) => setTicketPrice(e.target.value)}
                className={inputClass}
              />
            </Field>
          )}
          <Field label="Max capacity">
            <input
              type="number"
              min="0"
              value={maxCapacity}
              onChange={(e) => setMaxCapacity(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

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

        <Field label="Publish status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as 'draft' | 'published')}
            className={inputClass}
          >
            <option value="draft">Draft (only you can see it)</option>
            <option value="published">Published (visible to attendees)</option>
          </select>
        </Field>

        {error && <p className="text-sm text-magenta">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-marigold px-5 py-2.5 font-semibold text-ink hover:bg-marigold/90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create event'}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg px-5 py-2.5 font-semibold text-muted hover:text-bone"
          >
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
