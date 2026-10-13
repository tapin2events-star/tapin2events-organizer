import { useEffect, useRef, useState, type FormEvent } from 'react';
import FormPromoCodes, { codeProblem, pendingRow, type PendingCode } from '../components/business/FormPromoCodes';
import PromoCodes from '../components/business/PromoCodes';
import DonationSettings, { DEFAULT_DONATION_FORM, donationPatch, type DonationForm } from '../components/business/DonationSettings';
import TierListEditor from '../components/business/TierListEditor';
import { loadTierDrafts, newDraft, saveTierDrafts, tierProblems, type TierDraft } from '../lib/tiers';
import EventKindPicker from '../components/business/EventKindPicker';
import { FEATURES, useFeature } from '../lib/preview';
import type { EventKind } from '../lib/business';
import BackButton, { hasInAppHistory } from '../components/BackButton';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import type { EventType } from '../lib/types';
import { AVAILABLE_FEATURES, type EventFeature } from '../lib/eventFeatures';
import FlyerMaker from '../components/flyer/FlyerMaker';
import { normalizeLink, PLATFORMS, type LinkKey } from '../lib/socialLinks';

// Saved times are UTC ("2026-10-31T23:00:00+00:00"). The date/time field needs the
// viewer's local wall-clock time ("2026-10-31T19:00"); cutting the UTC string
// would show (and re-save) the event 4-5 hours late.
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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

// Adding months naively (date.setMonth) overflows for day-of-month values
// that don't exist in the target month — e.g. Jan 31 + 1 month becomes
// Mar 3 instead of Feb 28. This clamps to the last valid day instead.
function addMonthsClamped(date: Date, months: number): Date {
  const d = new Date(date);
  const originalDay = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const daysInTargetMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(originalDay, daysInTargetMonth));
  return d;
}

// How tickets are sold: one choice, so options can't conflict.
type SellMode = 'single' | 'tiers' | 'seating' | 'external';
const SELL_MODES: { id: SellMode; icon: string; label: string; desc: string }[] = [
  { id: 'single', icon: '🎟️', label: 'One price', desc: 'Everyone pays the same, or it\u2019s free' },
  { id: 'tiers', icon: '🏷️', label: 'Ticket types', desc: 'General, VIP, Early Bird, Student\u2026' },
  { id: 'seating', icon: '💺', label: 'Reserved seating', desc: 'Sections and seats people pick from' },
  { id: 'external', icon: '🔗', label: 'Sold elsewhere', desc: 'Link to Eventbrite or another site' },
];

export default function EventForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  const [step, setStep] = useState(1);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [aiNotes, setAiNotes] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showAiNotes, setShowAiNotes] = useState(false);
  // Quick create: fill the form from a flyer image and/or a short description.
  // ?start=scratch (from the + menu) opens the regular form with Quick create collapsed.
  const [quickOpen, setQuickOpen] = useState(() => new URLSearchParams(window.location.search).get('start') !== 'scratch');
  const [quickText, setQuickText] = useState('');
  const [quickFlyerUrl, setQuickFlyerUrl] = useState<string | null>(null);
  const [quickUploading, setQuickUploading] = useState(false);
  const [quickFilling, setQuickFilling] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);
  const [quickResult, setQuickResult] = useState<{ fromFlyer: boolean; needs_review: string[]; review_note: string | null; price_found: string | null; date_found: string | null } | null>(null);
  const [eventType, setEventType] = useState<EventType>('free');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isOnline, setIsOnline] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  // Tracks whether the event was ALREADY part of a series when loaded —
  // distinct from isRecurring, which the organizer can still toggle. Only
  // an event that wasn't already recurring should be eligible to generate
  // a new series; a genuinely already-recurring event shouldn't regenerate
  // one just because the box is still checked while editing.
  const [wasAlreadyRecurring, setWasAlreadyRecurring] = useState(false);
  // Editing one date of a series: apply to just this date, or this and every upcoming date.
  const [applyScope, setApplyScope] = useState<'one' | 'upcoming'>('upcoming');
  const [loadedStart, setLoadedStart] = useState<string | null>(null);
  const [loadedEnd, setLoadedEnd] = useState<string | null>(null);
  const [recurFrequency, setRecurFrequency] = useState<'weekly' | 'monthly'>('weekly');
  const [recurCount, setRecurCount] = useState('4');
  const [seriesPassEnabled, setSeriesPassEnabled] = useState(false);
  const [seriesPassDiscount, setSeriesPassDiscount] = useState('10');
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [ticketPrice, setTicketPrice] = useState('0');
  const [externalTicketUrl, setExternalTicketUrl] = useState('');
  const [maxCapacity, setMaxCapacity] = useState('');
  const [features, setFeatures] = useState<EventFeature[]>([]);
  const [vendorApplicationsEnabled, setVendorApplicationsEnabled] = useState(false);
  const [vendorFeeTiers, setVendorFeeTiers] = useState<{ tier_name: string; fee: number }[]>([]);
  const [vendorGroups, setVendorGroups] = useState<VendorGroup[]>([]);
  const [sponsorTiers, setSponsorTiers] = useState<SponsorTier[]>([]);
  const [seatingEnabled, setSeatingEnabled] = useState(false);
  const [externalChosen, setExternalChosen] = useState(false);
  const [seatingSections, setSeatingSections] = useState<{ name: string; price: number; num_tables: number; seats_per_table: number; total_seats: number; color: string; bundle_enabled: boolean; bundle_price: number; bundle_description: string; bundle_product_id: string | null }[]>([]);
  const [eventProducts, setEventProducts] = useState<{ id: string; name: string }[]>([]);
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [showFlyerMaker, setShowFlyerMaker] = useState(false);
  const [searchParams] = useSearchParams();
  const flyerOpened = useRef(false);
  const [posterPreview, setPosterPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!posterFile) {
      setPosterPreview(null);
      return;
    }
    const url = URL.createObjectURL(posterFile);
    setPosterPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [posterFile]);
  // Social and website links, keyed by platform (see lib/socialLinks).
  const [links, setLinks] = useState<Record<LinkKey, string>>({ instagram: '', tiktok: '', facebook: '', youtube: '', x: '', website: '' });
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  // Admin-only: a private test event (see Admin > Preview). ?test=1 starts one checked.
  const [allowTransfers, setAllowTransfers] = useState(true);
  // TapIN for Business (preview): event type + organization. ?kind= and ?org= come from an organization's page.
  const businessOn = useFeature('business');
  const [eventKind, setEventKind] = useState<EventKind>(() => { const k = new URLSearchParams(window.location.search).get('kind'); return k === 'business' || k === 'nonprofit' ? k : 'community'; });
  const [orgId, setOrgId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('org'));
  // Ticket types (preview): several tiers instead of one price.
  const [useTiers, setUseTiers] = useState(false);
  // Donations (nonprofit events, preview).
  const [donationForm, setDonationForm] = useState<DonationForm>(DEFAULT_DONATION_FORM);
  const [tierDrafts, setTierDrafts] = useState<TierDraft[]>([]);
  // Which "How will you sell tickets?" card is selected (derived from the saved settings).
  const sellMode: SellMode = externalChosen || externalTicketUrl.trim() ? 'external' : seatingEnabled ? 'seating' : useTiers ? 'tiers' : 'single';
  function chooseSellMode(m: SellMode) {
    setExternalChosen(m === 'external');
    if (m !== 'external') setExternalTicketUrl('');
    setSeatingEnabled(m === 'seating');
    setUseTiers(m === 'tiers');
    if (m === 'tiers' && tierDrafts.length === 0) setTierDrafts([newDraft('General Admission', eventType === 'free' ? '' : ticketPrice !== '0' ? ticketPrice : '')]);
    if (m === 'seating' && eventType === 'free') setEventType('paid');
  }
  // Promo codes typed into the form before the event exists (new events only).
  const [pendingCodes, setPendingCodes] = useState<PendingCode[]>([]);
  const [tierOriginalIds, setTierOriginalIds] = useState<string[]>([]);
  const [tierSold, setTierSold] = useState<Record<string, number>>({});
  const [isTest, setIsTest] = useState(() => !isEdit && searchParams.get('test') === '1');

  const [loading, setLoading] = useState(isEdit);

  // From the dashboard's "Make a flyer" shortcut: jump to the last step and
  // open the flyer maker once the event has loaded.
  useEffect(() => {
    if (loading || !isEdit || flyerOpened.current || searchParams.get('flyer') !== '1') return;
    flyerOpened.current = true;
    setStep(STEPS.length);
    setShowFlyerMaker(true);
  }, [loading, isEdit, searchParams]);

  async function handleFlyerUpload(file: File) {
    if (!user) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setQuickError('Please upload a JPG, PNG, WebP, or GIF image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setQuickError('That image is over 5 MB. Try a smaller version of your flyer.');
      return;
    }
    setQuickUploading(true);
    setQuickError(null);
    // Uploaded to the same place event posters live, so the flyer can
    // become this event's poster without a second upload.
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${user.id}/${Date.now()}-flyer.${ext}`;
    const { error } = await supabase.storage.from('event-posters').upload(path, file, { contentType: file.type });
    setQuickUploading(false);
    if (error) {
      setQuickError('Upload failed. Please try again.');
      return;
    }
    setQuickFlyerUrl(supabase.storage.from('event-posters').getPublicUrl(path).data.publicUrl);
  }

  async function handleQuickFill() {
    if (!quickText.trim() && !quickFlyerUrl) {
      setQuickError('Upload a flyer or describe your event first.');
      return;
    }
    setQuickFilling(true);
    setQuickError(null);
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const { data, error } = await supabase.functions.invoke('extract-event-details', {
      body: { text: quickText, image_url: quickFlyerUrl, today },
    });
    setQuickFilling(false);
    if (error || !data?.fields) {
      let msg = "Couldn't read that right now. Please try again.";
      try {
        const body = await (error as { context?: Response })?.context?.json();
        if (body?.error) msg = body.error;
      } catch {
        // keep the generic message
      }
      setQuickError(msg);
      return;
    }
    const f = data.fields;
    // Only fill what the AI actually found; anything missing is left for the
    // organizer. Status stays Draft, and ticketing stays free -- a price on
    // the flyer is shown below rather than applied.
    if (f.title) setTitle(f.title);
    if (f.description) setDescription(f.description);
    if (f.category) setCategory(f.category);
    // Only fill the times when both date and time were found; a date with no
    // time is shown in the note below instead of being filled in as midnight.
    if (f.start_datetime) setStartDate(f.start_datetime);
    if (f.end_datetime) setEndDate(f.end_datetime);
    setIsOnline(!!f.is_online);
    if (f.location_name) setLocationName(f.location_name);
    if (f.location_address) setLocationAddress(f.location_address);
    if (quickFlyerUrl) {
      setPosterUrl(quickFlyerUrl);
      setPosterFile(null);
    }
    setQuickResult({ fromFlyer: !!quickFlyerUrl, needs_review: f.needs_review ?? [], review_note: f.review_note, price_found: f.price_found, date_found: f.date_found ?? null });
    setQuickOpen(false);
  }
  const [saving, setSaving] = useState(false);
  // Set by the Preview button: save, then open the event page instead of the dashboard.
  const previewAfterSave = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [originalBookedSeats, setOriginalBookedSeats] = useState<string[]>([]);

  useEffect(() => {
    if (!isEdit || !id) return;
    supabase.from('products').select('id, name').eq('event_id', id).then(({ data }) => setEventProducts(data ?? []));
  }, [isEdit, id]);

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
      setExternalTicketUrl(data.external_ticket_url ?? '');
      setStartDate(toLocalInput(data.start_date));
      setEndDate(toLocalInput(data.end_date));
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
      setSeatingEnabled(!!data.is_seating_enabled);
      setSeatingSections(
        Array.isArray(data.seating_sections)
          ? data.seating_sections.map((s: any) => ({
              name: s.name ?? '',
              price: s.price ?? 0,
              num_tables: s.num_tables ?? 1,
              seats_per_table: s.seats_per_table ?? (s.total_seats ?? 8),
              total_seats: s.total_seats ?? (s.num_tables ?? 1) * (s.seats_per_table ?? 8),
              color: s.color ?? '#4F46E5',
              bundle_enabled: s.bundle_enabled ?? false,
              bundle_price: s.bundle_price ?? 0,
              bundle_description: s.bundle_description ?? '',
              bundle_product_id: s.bundle_product_id ?? null,
            }))
          : []
      );
      setOriginalBookedSeats(Array.isArray(data.booked_seats) ? data.booked_seats : []);
      setPosterUrl(data.poster_url ?? null);
      setLinks({
        instagram: data.social_links?.instagram ?? '',
        tiktok: data.social_links?.tiktok ?? '',
        facebook: data.social_links?.facebook ?? '',
        youtube: data.social_links?.youtube ?? '',
        x: data.social_links?.x ?? data.social_links?.twitter ?? '',
        website: data.social_links?.website ?? '',
      });
      setStatus(data.status === 'published' ? 'published' : 'draft');
      setIsTest(!!data.is_test);
      setAllowTransfers(data.allow_transfers !== false);
      setEventKind((data.event_kind as EventKind) ?? 'community');
      setDonationForm({
        enabled: !!data.donations_enabled, pitch: data.donation_description ?? '', goal: data.donation_goal ? String(data.donation_goal) : '',
        min: String(Math.max(5, Number(data.min_donation_amount) || 5)), presets: (data.donation_presets ?? [25, 50, 100]).join(', '), show: data.show_donors !== false,
      });
      loadTierDrafts(data.id).then(({ drafts, sold }) => {
        setTierDrafts(drafts); setTierSold(sold); setTierOriginalIds(drafts.map((d) => d.id as string));
        setUseTiers(drafts.some((d) => d.active));
      });
      setOrgId(data.organization_id ?? null);
      setIsRecurring(!!data.is_recurring);
      setWasAlreadyRecurring(!!data.is_recurring);
      setLoadedStart(data.start_date ?? null);
      setLoadedEnd(data.end_date ?? null);
      if (data.recurrence_rule?.frequency) setRecurFrequency(data.recurrence_rule.frequency);
      if (data.recurrence_rule?.count) setRecurCount(String(data.recurrence_rule.count));
      setSeriesPassEnabled(!!data.series_pass_enabled);
      if (data.series_pass_discount != null) setSeriesPassDiscount(String(data.series_pass_discount));
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
    const previewing = previewAfterSave.current;
    previewAfterSave.current = false;
    if (!user) return;
    {
      const codeErr = isEdit ? null : pendingCodes.map(codeProblem).find(Boolean);
      if (codeErr) { setError(codeErr); return; }
    }
    if (businessOn && useTiers && !seatingEnabled) {
      const problems = tierProblems(tierDrafts, tierSold);
      if (problems.length) { setError(problems[0]); setStep(1); return; }
    }
    if (businessOn && eventKind !== 'business') {
      const { problem } = donationPatch(donationForm);
      if (problem) { setError(problem); setStep(1); return; }
    }
    if (businessOn && eventKind !== 'community' && !orgId) {
      setError('Choose the organization this event belongs to.');
      setStep(1);
      return;
    }
    if (!title.trim()) {
      setError('Event title is required.');
      setStep(1);
      return;
    }

    // Prevent shrinking or renaming a section that already has real,
    // sold seats -- seat labels are tied to the section name, so
    // renaming would silently orphan existing tickets from capacity
    // tracking, and reducing capacity below what's sold would make the
    // section show fewer seats than are actually already taken.
    if (isEdit && seatingEnabled && originalBookedSeats.length > 0) {
      // Seat labels are "<section name>-T<table>-<seat>" -- strip only that
      // trailing pattern, since a naive split on "-T" would misparse a
      // section name that itself happens to contain "-T" (e.g. "VIP-Table").
      const sectionNameFromLabel = (label: string) => label.replace(/-T\d+-\d+$/, '');
      const bookedSectionNames = new Set(originalBookedSeats.map(sectionNameFromLabel));
      for (const sectionName of bookedSectionNames) {
        const bookedCount = originalBookedSeats.filter((s) => sectionNameFromLabel(s) === sectionName).length;
        const currentSection = seatingSections.find((s) => s.name === sectionName);
        if (!currentSection) {
          setError(`"${sectionName}" already has ${bookedCount} seat(s) sold and can't be removed or renamed. Add a new section instead if you want to change it.`);
          setStep(1);
          return;
        }
        const newCapacity = currentSection.num_tables * currentSection.seats_per_table;
        if (newCapacity < bookedCount) {
          setError(`"${sectionName}" already has ${bookedCount} seat(s) sold — capacity can't be reduced below that.`);
          setStep(1);
          return;
        }
      }
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
      external_ticket_url: normalizeLink('website', externalTicketUrl),
      max_capacity: maxCapacity ? Number(maxCapacity) : null,
      features,
      vendor_applications_enabled: vendorApplicationsEnabled,
      vendor_fee: vendorFeeTiers[0]?.fee ?? 0,
      vendor_fees: vendorFeeTiers,
      vendors: vendorGroups,
      sponsors: sponsorTiers,
      is_seating_enabled: seatingEnabled,
      seating_sections: seatingEnabled
        ? seatingSections.map((s) => ({ ...s, total_seats: s.num_tables * s.seats_per_table }))
        : [],
      series_pass_enabled: (isRecurring || wasAlreadyRecurring) ? seriesPassEnabled : false,
      series_pass_discount: (isRecurring || wasAlreadyRecurring) && seriesPassEnabled ? Number(seriesPassDiscount) || 0 : null,
      poster_url: uploadedPosterUrl,
      social_links: Object.fromEntries(PLATFORMS.map((p) => [p.key, normalizeLink(p.key, links[p.key])])),
      status,
      ...(isAdmin ? { is_test: isTest } : {}),
      allow_transfers: allowTransfers,
      ...(businessOn && eventKind !== 'business' ? donationPatch(donationForm).patch : {}),
      ...(businessOn && useTiers && !seatingEnabled ? (() => {
        const live = tierDrafts.filter((d) => d.active).map((d) => (d.price === '' ? 0 : Number(d.price)));
        const paid = live.filter((p) => p > 0);
        return { event_type: paid.length ? (eventType === 'private' ? 'private' : 'paid') : (eventType === 'private' ? 'private' : 'free'), ticket_price: paid.length ? Math.min(...paid) : 0 };
      })() : {}),
      ...(businessOn ? { event_kind: eventKind, organization_id: orgId || null } : {}),
      // While business events are in preview they stay private as test events.
      ...(businessOn && isAdmin && eventKind !== 'community' && FEATURES.business?.status === 'preview' ? { is_test: true } : {}),
    };
    // Ownership is only ever set on creation. An edit must never touch
    // these fields — otherwise an admin editing someone else's event on
    // their behalf would silently reassign it to themselves.
    if (!isEdit) {
      payload.organizer_id = user.id;
      payload.organizer_email = user.email;
      // Previewing a brand-new event never publishes it.
      if (previewing) payload.status = 'draft';
    }

    const { data, error } = isEdit
      ? await supabase.from('events').update(payload).eq('id', id).select().single()
      : await supabase.from('events').insert(payload).select().single();

    if (error) {
      setSaving(false);
      setError(error.message);
      return;
    }

    // "This and all upcoming dates": copy the shared details to every later date in
    // the series. Dates stay as they are; if the start/end time changed, the same
    // time of day (and length) is applied to each later date.
    let seriesUpdated = 0;
    if (isEdit && wasAlreadyRecurring && applyScope === 'upcoming') {
      const seriesParentId = data.parent_event_id || data.id;
      const fromIso = data.start_date ?? new Date().toISOString();
      const { data: later } = await supabase.from('events').select('id, start_date, end_date')
        .or(`id.eq.${seriesParentId},parent_event_id.eq.${seriesParentId}`)
        .neq('id', data.id).gt('start_date', fromIso).neq('status', 'cancelled');
      const shared: Record<string, unknown> = { ...payload };
      for (const k of ['start_date', 'end_date', 'status', 'date_tbd', 'organizer_id', 'organizer_email', 'parent_event_id', 'is_recurring', 'recurrence_rule', 'booked_seats']) delete shared[k];
      const oldS = loadedStart ? new Date(loadedStart) : null;
      const newS = data.start_date ? new Date(data.start_date) : null;
      const timeChanged = !!(oldS && newS && (oldS.getHours() !== newS.getHours() || oldS.getMinutes() !== newS.getMinutes()));
      const newLen = newS && data.end_date ? new Date(data.end_date).getTime() - newS.getTime() : null;
      const oldLen = oldS && loadedEnd ? new Date(loadedEnd).getTime() - oldS.getTime() : null;
      const lengthChanged = newLen !== oldLen;
      for (const occ of later ?? []) {
        const row: Record<string, unknown> = { ...shared };
        if ((timeChanged || lengthChanged) && newS && occ.start_date) {
          const st = new Date(occ.start_date);
          st.setHours(newS.getHours(), newS.getMinutes(), 0, 0);
          row.start_date = st.toISOString();
          row.end_date = newLen !== null ? new Date(st.getTime() + newLen).toISOString() : null;
        }
        const { error: occErr } = await supabase.from('events').update(row).eq('id', occ.id);
        if (!occErr) seriesUpdated += 1;
      }
    }
    void seriesUpdated;

    // A series pass setting belongs to the whole series, not just the one
    // occurrence being edited -- the checkout flow reads it off the parent,
    // and any occurrence's page displays it off itself, so every row in
    // the series needs to agree.
    if (isEdit && wasAlreadyRecurring) {
      const seriesParentId = data.parent_event_id || data.id;
      await supabase
        .from('events')
        .update({
          series_pass_enabled: seriesPassEnabled,
          series_pass_discount: seriesPassEnabled ? Number(seriesPassDiscount) || 0 : null,
        })
        .or(`id.eq.${seriesParentId},parent_event_id.eq.${seriesParentId}`);
    }

    // Recurring series: the just-created event is the parent. Each
    // additional occurrence is a fully independent event row (its own
    // tickets, capacity, and check-in), offset by the chosen interval —
    // deliberately not a single virtual "recurring" event, since every
    // other part of the app (checkout, check-in, capacity) already
    // assumes one event = one occurrence.
    if (!wasAlreadyRecurring && isRecurring && startDate) {
      const count = Math.min(Math.max(Number(recurCount) || 0, 2), 52);
      const baseStart = new Date(startDate);
      const baseEnd = endDate ? new Date(endDate) : null;
      const recurrenceRule = { frequency: recurFrequency, count };

      await supabase
        .from('events')
        .update({
          is_recurring: true,
          recurrence_rule: recurrenceRule,
          series_pass_enabled: seriesPassEnabled,
          series_pass_discount: seriesPassEnabled ? Number(seriesPassDiscount) || 0 : null,
        })
        .eq('id', data.id);

      const occurrences = [];
      for (let i = 1; i < count; i++) {
        let offsetStart: Date;
        let offsetEnd: Date | null;
        if (recurFrequency === 'weekly') {
          offsetStart = new Date(baseStart);
          offsetStart.setDate(offsetStart.getDate() + 7 * i);
          offsetEnd = baseEnd ? new Date(baseEnd) : null;
          if (offsetEnd) offsetEnd.setDate(offsetEnd.getDate() + 7 * i);
        } else {
          offsetStart = addMonthsClamped(baseStart, i);
          offsetEnd = baseEnd ? addMonthsClamped(baseEnd, i) : null;
        }
        occurrences.push({
          ...payload,
          organizer_id: user.id,
          organizer_email: user.email,
          start_date: offsetStart.toISOString(),
          end_date: offsetEnd ? offsetEnd.toISOString() : null,
          parent_event_id: String(data.id),
          is_recurring: true,
          recurrence_rule: recurrenceRule,
          series_pass_enabled: seriesPassEnabled,
          series_pass_discount: seriesPassEnabled ? Number(seriesPassDiscount) || 0 : null,
        });
      }
      if (occurrences.length > 0) {
        const { error: seriesError } = await supabase.from('events').insert(occurrences);
        if (seriesError) {
          setSaving(false);
          setError(`Event created, but generating the rest of the series failed: ${seriesError.message}`);
          return;
        }
      }
    }

    if (businessOn && !seatingEnabled && (useTiers || tierOriginalIds.length)) {
      const tierErr = await saveTierDrafts(data.id, tierDrafts, tierOriginalIds, tierSold, useTiers);
      // Promo codes added while creating the event (a first code on a single-price event turns
      // its price into a General Admission ticket type so checkout can apply it).
      if (!isEdit && pendingCodes.length > 0 && eventType !== 'free') {
        const { error: codeSaveErr } = await supabase.from('promo_codes').insert(pendingCodes.map((c) => pendingRow(data.id, c)));
        if (codeSaveErr) console.error('[event form] promo codes', codeSaveErr);
      }
      if (tierErr) { setSaving(false); setError(`Event saved, but ticket types didn't: ${tierErr} Open the event's Tickets tab to fix it.`); return; }
    }

    setSaving(false);
    navigate(previewing ? `/events/${data.id}` : `/organizer/events/${data.id}`);
  }

  if (loading) return <p className="text-muted">Loading…</p>;

  const isLastStep = step === STEPS.length;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-3"><BackButton fallback={isEdit && id ? `/organizer/events/${id}` : '/organizer'} fallbackLabel={isEdit ? 'Back to event' : 'Organizer Dashboard'} /></div>
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
                  step === n ? 'bg-gradient-to-r from-marigold to-teal text-white' : 'bg-surface2 text-muted hover:text-bone'
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
            {businessOn && <EventKindPicker kind={eventKind} onKind={setEventKind} orgId={orgId} onOrg={setOrgId} />}
            {!isEdit && quickOpen && (
              <div className="rounded-2xl border border-marigold/30 bg-marigold/5 p-4">
                <p className="font-semibold text-bone">✨ Quick create with AI</p>
                <p className="mt-0.5 text-sm text-muted">
                  Upload your flyer or describe your event, and we'll fill in the form. Nothing is published until you review it and choose to.
                </p>
                <div className="mt-3 flex items-center gap-3">
                  {quickFlyerUrl ? (
                    <div className="relative">
                      <img src={quickFlyerUrl} alt="Your flyer" className="h-24 w-20 rounded-lg object-cover" />
                      <button type="button" onClick={() => setQuickFlyerUrl(null)} aria-label="Remove flyer" className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-gray-800 text-xs text-white">✕</button>
                    </div>
                  ) : (
                    <label className="flex h-24 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 bg-white text-center text-xs text-muted hover:border-marigold">
                      <span className="text-xl">🖼️</span>
                      {quickUploading ? 'Uploading…' : 'Upload flyer'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        disabled={quickUploading}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (file) handleFlyerUpload(file);
                        }}
                      />
                    </label>
                  )}
                  <textarea
                    value={quickText}
                    onChange={(e) => setQuickText(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    placeholder="Or describe it, e.g. Poetry night at Kings Barcade, Oct 30 at 8pm, $10 at the door"
                    className={`${inputClass} flex-1 text-sm`}
                  />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleQuickFill}
                    disabled={quickFilling || quickUploading || (!quickText.trim() && !quickFlyerUrl)}
                    className="rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {quickFilling ? 'Reading…' : 'Fill in the form'}
                  </button>
                  <button type="button" onClick={() => setQuickOpen(false)} className="-my-2 py-2 text-sm text-muted hover:text-bone">
                    I'll fill it in myself
                  </button>
                </div>
                {quickError && <p className="mt-2 text-sm text-magenta">{quickError}</p>}
              </div>
            )}

            {quickResult && (
              <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm">
                <p className="font-semibold text-green-800">
                  ✨ Filled in from your {quickResult.fromFlyer ? 'flyer' : 'description'}
                </p>
                <p className="mt-0.5 text-green-800">
                  Review every step before publishing. Your event stays a draft until you choose to publish it.
                </p>
                {quickResult.needs_review.length > 0 && (
                  <p className="mt-2 text-amber-800">
                    <span className="font-semibold">Please double-check:</span>{' '}
                    {quickResult.needs_review
                      .map((k) => ({ title: 'Title', category: 'Category', date: 'Date', start_time: 'Start time', end_time: 'End time', location: 'Location', description: 'Description' } as Record<string, string>)[k] ?? k)
                      .join(', ')}
                  </p>
                )}
                {quickResult.date_found && (
                  <p className="mt-2 rounded-lg bg-amber-100 px-3 py-2 text-amber-900">
                    Your {quickResult.fromFlyer ? 'flyer' : 'description'} says{' '}
                    <span className="font-semibold">{new Date(`${quickResult.date_found}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>{' '}
                    but doesn't list a start time. Enter the date and start time under <span className="font-semibold">Start</span> below.
                  </p>
                )}
                {quickResult.review_note && <p className="mt-1 text-amber-800">{quickResult.review_note}</p>}
                {quickResult.price_found && !/^free$/i.test(quickResult.price_found.trim()) && (
                  <p className="mt-2 text-bone">
                    Your {quickResult.fromFlyer ? 'flyer' : 'description'} lists <span className="font-semibold">{quickResult.price_found}</span>. To sell tickets through TapIN, change <span className="font-semibold">Type</span> below to Paid and enter a price. Otherwise it stays a free listing.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setQuickResult(null);
                    setQuickOpen(true);
                  }}
                  className="mt-2 text-sm font-medium text-marigold hover:underline"
                >
                  Try again with a different flyer or description
                </button>
              </div>
            )}

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
              <div className="mt-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!title.trim()) {
                        setAiError('Add a title first so there\'s something to write about.');
                        return;
                      }
                      setAiGenerating(true);
                      setAiError(null);
                      const { data, error } = await supabase.functions.invoke('generate-event-description', {
                        body: {
                          title,
                          category,
                          start_date: startDate ? new Date(startDate).toISOString() : null,
                          location_name: locationName,
                          is_online: isOnline,
                          is_free: eventType === 'free',
                          ticket_price: ticketPrice,
                          notes: aiNotes,
                        },
                      });
                      setAiGenerating(false);
                      if (error || !data?.description) {
                        setAiError(data?.error || 'Could not generate a description right now. Please try again.');
                        return;
                      }
                      setDescription(data.description);
                    }}
                    disabled={aiGenerating}
                    className="flex items-center gap-1.5 rounded-full border border-marigold/40 bg-marigold/10 px-3 py-1.5 text-sm font-medium text-marigold hover:bg-marigold/20 disabled:opacity-50"
                  >
                    <span aria-hidden>✨</span>
                    {aiGenerating ? 'Writing…' : description.trim() ? 'Rewrite with AI' : 'Help me write this'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAiNotes((v) => !v)}
                    className="-my-2 py-2 text-sm font-medium text-muted hover:text-bone"
                  >
                    {showAiNotes ? 'Hide extra context' : '+ Add context for the AI'}
                  </button>
                </div>
                {showAiNotes && (
                  <input
                    value={aiNotes}
                    onChange={(e) => setAiNotes(e.target.value)}
                    placeholder="e.g. kid-friendly, first time hosting this, bring your own chair"
                    className={`${inputClass} mt-2`}
                  />
                )}
                <p className="mt-1 text-xs text-muted">
                  Uses the title, category, date, location, and price you've filled in so far — you can regenerate after adding more.
                </p>
                {aiError && <p className="mt-1 text-xs text-magenta">{aiError}</p>}
              </div>
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

            {/* How will you sell tickets? One clear choice; each shows only its own settings. */}
            <div>
              <p className="text-sm font-medium text-bone">How will you sell tickets?</p>
              <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4" role="radiogroup" aria-label="How will you sell tickets?">
                {SELL_MODES.map((m) => (
                  <button key={m.id} type="button" role="radio" aria-checked={sellMode === m.id} onClick={() => chooseSellMode(m.id)}
                    className={`flex min-h-[88px] flex-col items-start rounded-2xl border p-3 text-left transition ${sellMode === m.id ? 'border-marigold bg-marigold/5 ring-2 ring-marigold/30' : 'border-gray-200 bg-white hover:border-gray-400'}`}>
                    <span className="text-xl leading-none" aria-hidden="true">{m.icon}</span>
                    <span className="mt-1.5 text-sm font-semibold text-gray-900">{m.label}</span>
                    <span className="mt-0.5 text-xs leading-snug text-gray-500">{m.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {sellMode === 'single' && eventType !== 'free' && (
                <Field label="Ticket price ($)">
                  <input type="number" min="0" step="0.01" value={ticketPrice} onChange={(e) => setTicketPrice(e.target.value)} className={inputClass} />
                </Field>
              )}
              {(sellMode === 'single' || sellMode === 'tiers') && (
                <Field label="Max capacity">
                  <input type="number" min="0" value={maxCapacity} onChange={(e) => setMaxCapacity(e.target.value)} className={inputClass} />
                </Field>
              )}
            </div>

            {sellMode === 'tiers' && (
              <div className="-mx-1 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-3 sm:mx-0 sm:p-4">
                <p className="text-sm font-semibold text-bone">Ticket types</p>
                <p className="text-xs text-muted">Each with its own price, quantity and sales dates. Free and paid types can be mixed.</p>
                <TierListEditor drafts={tierDrafts} onChange={setTierDrafts} sold={tierSold} inputClass={`${inputClass} mt-1 block w-full min-w-0 text-base`} />
              </div>
            )}

            {((sellMode === 'single' && eventType !== 'free') || (sellMode === 'tiers' && tierDrafts.some((d) => Number(d.price) > 0)) || (sellMode === 'seating' && seatingSections.some((x) => Number(x.price) > 0))) && (
              isEdit && id
                ? <div className="rounded-2xl border border-gray-200 bg-white p-3 sm:p-4"><PromoCodes eventId={id} tiers={[]} /></div>
                : <FormPromoCodes codes={pendingCodes} onChange={setPendingCodes} inputClass={`${inputClass} mt-1 block w-full min-w-0 text-base`} />
            )}

            {businessOn && eventKind !== 'business' && <DonationSettings nonprofit={eventKind === 'nonprofit'} value={donationForm} onChange={setDonationForm} inputClass={`${inputClass} mt-1 block w-full min-w-0 text-base`} />}

            {sellMode === 'external' && <Field label="Ticket link">
              <input
                value={externalTicketUrl}
                onChange={(e) => setExternalTicketUrl(e.target.value)}
                className={inputClass}
                placeholder="eventbrite.com/e/your-event"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
              />
              {externalTicketUrl.trim() && !normalizeLink('website', externalTicketUrl) ? (
                <p className="mt-1 text-xs text-magenta">That doesn't look like a link.</p>
              ) : externalTicketUrl.trim() ? (
                <p className="mt-1 text-xs text-muted">Your event page will send people to this link for tickets. TapIN checkout is turned off for this event.</p>
              ) : (
                <p className="mt-1 text-xs text-muted">Paste your Eventbrite or ticket link to send people there instead of selling tickets on TapIN.</p>
              )}
            </Field>}

            <div className={sellMode === 'seating' ? '' : 'hidden'}>
              {(
                <>
                  <p className="text-sm font-semibold text-bone">💺 Reserved seating sections</p>

                {seatingEnabled && (
                  <div className="mt-3 flex flex-col gap-3">
                    <p className="text-xs text-muted">
                      Each section is made of tables with seats around them. Attendees pick their exact seats on a visual map; each is assigned specifically, not just a quantity.
                    </p>
                    {seatingSections.map((s, i) => {
                      const computedTotal = s.num_tables * s.seats_per_table;
                      return (
                        <div key={i} className="rounded-xl border border-gray-300 bg-surface2 p-4">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="font-medium text-bone">{s.name || 'Untitled section'}</p>
                              <p className="text-xs text-muted">{computedTotal} seats</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-bone">${s.price}</span>
                              <button type="button" onClick={() => setSeatingSections((prev) => prev.filter((_, xi) => xi !== i))} className="text-magenta">
                                Remove
                              </button>
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-3">
                            <Field label="Section name">
                              <input
                                className={inputClass}
                                placeholder="Main Section"
                                value={s.name}
                                onChange={(e) => setSeatingSections((prev) => prev.map((x, xi) => (xi === i ? { ...x, name: e.target.value } : x)))}
                              />
                            </Field>
                            <Field label="Price per seat ($)">
                              <input
                                className={inputClass}
                                type="number"
                                value={s.price}
                                onChange={(e) => setSeatingSections((prev) => prev.map((x, xi) => (xi === i ? { ...x, price: Number(e.target.value) || 0 } : x)))}
                              />
                            </Field>
                            <Field label="Number of tables">
                              <input
                                className={inputClass}
                                type="number"
                                min="1"
                                value={s.num_tables}
                                onChange={(e) => setSeatingSections((prev) => prev.map((x, xi) => (xi === i ? { ...x, num_tables: Math.max(1, Number(e.target.value) || 1) } : x)))}
                              />
                            </Field>
                            <Field label="Seats per table">
                              <input
                                className={inputClass}
                                type="number"
                                min="1"
                                value={s.seats_per_table}
                                onChange={(e) => setSeatingSections((prev) => prev.map((x, xi) => (xi === i ? { ...x, seats_per_table: Math.max(1, Number(e.target.value) || 1) } : x)))}
                              />
                            </Field>
                          </div>

                          <div className="mt-3">
                            <p className="text-sm text-muted">Section color</p>
                            <div className="mt-1 flex gap-2">
                              {['#4F46E5', '#DC2626', '#16A34A', '#D97706', '#7C3AED', '#0891B2', '#65A30D', '#EA580C'].map((c) => (
                                <button
                                  key={c}
                                  type="button"
                                  onClick={() => setSeatingSections((prev) => prev.map((x, xi) => (xi === i ? { ...x, color: c } : x)))}
                                  className={`h-6 w-6 rounded-full ${s.color === c ? 'ring-2 ring-offset-2 ring-offset-surface2 ring-bone' : ''}`}
                                  style={{ backgroundColor: c }}
                                />
                              ))}
                            </div>
                          </div>

                          <div className="mt-3 border-t border-gray-300 pt-3">
                            <label className="flex items-center gap-2 text-sm text-muted">
                              <input
                                type="checkbox"
                                checked={s.bundle_enabled}
                                onChange={(e) => setSeatingSections((prev) => prev.map((x, xi) => (xi === i ? { ...x, bundle_enabled: e.target.checked } : x)))}
                              />
                              Offer a bundled upgrade for this section (e.g. seat + T-shirt, seat + VIP perk)
                            </label>
                            {s.bundle_enabled && (
                              <div className="mt-2 flex flex-col gap-2">
                                <p className="text-xs text-muted">
                                  Buyers still pick their exact seat as normal — this just adds an optional upgrade for whatever seat they choose.
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                  <Field label="Bundle price per seat ($)">
                                    <input
                                      className={inputClass}
                                      type="number"
                                      value={s.bundle_price}
                                      onChange={(e) => setSeatingSections((prev) => prev.map((x, xi) => (xi === i ? { ...x, bundle_price: Number(e.target.value) || 0 } : x)))}
                                    />
                                  </Field>
                                  <Field label="Include a product (optional)">
                                    <select
                                      className={inputClass}
                                      value={s.bundle_product_id ?? ''}
                                      onChange={(e) => setSeatingSections((prev) => prev.map((x, xi) => (xi === i ? { ...x, bundle_product_id: e.target.value || null } : x)))}
                                    >
                                      <option value="">None</option>
                                      {eventProducts.map((p) => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                      ))}
                                    </select>
                                  </Field>
                                </div>
                                {isEdit && eventProducts.length === 0 && (
                                  <p className="text-xs text-muted">No products yet for this event — add one from the Products tab, then come back here to link it.</p>
                                )}
                                {!isEdit && (
                                  <p className="text-xs text-muted">Product linking is available once you've saved this event and added products to it.</p>
                                )}
                                <Field label="What's included (shown to buyers)">
                                  <textarea
                                    className={inputClass}
                                    rows={2}
                                    placeholder="Includes a commemorative T-shirt and a drink voucher"
                                    value={s.bundle_description}
                                    onChange={(e) => setSeatingSections((prev) => prev.map((x, xi) => (xi === i ? { ...x, bundle_description: e.target.value } : x)))}
                                  />
                                </Field>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setSeatingSections((prev) => [...prev, { name: '', price: 25, num_tables: 1, seats_per_table: 8, total_seats: 8, color: '#4F46E5', bundle_enabled: false, bundle_price: 0, bundle_description: '', bundle_product_id: null }])}
                      className="self-start rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-bone hover:border-marigold"
                    >
                      + Add section
                    </button>
                  </div>
                )}
                </>
              )}
            </div>

            <Field label="Publish status">
              <select value={status} onChange={(e) => setStatus(e.target.value as 'draft' | 'published')} className={inputClass}>
                <option value="draft">Draft (only you can see it)</option>
                <option value="published">Published (visible to attendees)</option>
              </select>
              {status === 'published' && !isTest && <FollowerPublishNote email={user?.email} />}
            </Field>
            <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-surface p-3 text-sm text-bone">
              <input type="checkbox" checked={allowTransfers} onChange={(e) => setAllowTransfers(e.target.checked)} className="mt-0.5 h-4 w-4 accent-marigold" />
              <span><strong>Let attendees transfer tickets</strong><span className="block text-xs text-muted">Ticket holders can send their ticket to a friend before the event. The friend gets a new QR code and the old one stops working.</span></span>
            </label>
            {isAdmin && (
              <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <input type="checkbox" checked={isTest} onChange={(e) => setIsTest(e.target.checked)} className="mt-0.5 h-4 w-4 accent-marigold" />
                <span><strong>Test event</strong> (admin only)<span className="block text-xs">Only you and this event's team can see it, even when published. It never appears on Discover or in follower emails.</span></span>
              </label>
            )}
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

            {!wasAlreadyRecurring && (
              <div className="mt-2 border-t border-gray-200 pt-4">
                <label className="flex items-center gap-2 text-sm text-muted">
                  <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} />
                  This event repeats
                </label>

                {isRecurring && (
                  <div className="mt-3 flex flex-col gap-3">
                    <p className="text-xs text-muted">
                      This creates {recurCount || 0} separate events, each with its own tickets and check-in, spaced by the interval below.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Repeats">
                        <select value={recurFrequency} onChange={(e) => setRecurFrequency(e.target.value as 'weekly' | 'monthly')} className={inputClass}>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </Field>
                      <Field label="Number of occurrences">
                        <input type="number" min="2" max="52" value={recurCount} onChange={(e) => setRecurCount(e.target.value)} className={inputClass} />
                      </Field>
                    </div>
                  </div>
                )}
              </div>
            )}

            {(isRecurring || wasAlreadyRecurring) && (
              <div className="mt-2 border-t border-gray-200 pt-4">
                <label className="flex items-center gap-2 text-sm text-muted">
                  <input type="checkbox" checked={seriesPassEnabled} onChange={(e) => setSeriesPassEnabled(e.target.checked)} />
                  Offer a discounted series pass covering every occurrence
                </label>
                {seriesPassEnabled && (
                  <Field label="Series pass discount (% off buying all individually)">
                    <input type="number" min="0" max="100" value={seriesPassDiscount} onChange={(e) => setSeriesPassDiscount(e.target.value)} className={`${inputClass} max-w-[160px]`} />
                  </Field>
                )}
              </div>
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
              {posterPreview && <img src={posterPreview} alt="New poster" className="mt-2 h-24 rounded-lg object-cover" />}
              <button
                type="button"
                onClick={() => setShowFlyerMaker(true)}
                disabled={!title.trim()}
                className="mt-3 flex items-center gap-1.5 rounded-full border border-marigold/40 bg-marigold/10 px-3 py-1.5 text-sm font-medium text-marigold hover:bg-marigold/20 disabled:opacity-50"
              >
                ✨ Make a flyer
              </button>
              {!title.trim() && <p className="mt-1 text-xs text-muted">Add a title on step 1 to make a flyer.</p>}
            </Field>
            {showFlyerMaker && (
              <FlyerMaker
                event={{ id, title, category, description, startDate, endDate, isOnline, locationName, locationAddress, eventType, ticketPrice }}
                onClose={() => setShowFlyerMaker(false)}
                onUseAsPoster={(file) => setPosterFile(file)}
              />
            )}

            <div>
              <p className="text-sm font-medium text-bone">Links</p>
              <p className="text-xs text-muted">Shown on your event page so people can follow along. Paste a link or type an @handle.</p>
              <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {PLATFORMS.map((p) => {
                  const value = links[p.key];
                  const invalid = value.trim() !== '' && !normalizeLink(p.key, value);
                  return (
                    <Field key={p.key} label={p.label}>
                      <input
                        value={value}
                        onChange={(e) => setLinks((prev) => ({ ...prev, [p.key]: e.target.value }))}
                        className={inputClass}
                        placeholder={p.placeholder}
                        inputMode="url"
                        autoCapitalize="none"
                        autoCorrect="off"
                      />
                      {invalid && <p className="mt-1 text-xs text-magenta">That doesn't look like a link. It won't be shown.</p>}
                    </Field>
                  );
                })}
              </div>
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
          {isLastStep && isEdit && wasAlreadyRecurring && (
            <fieldset className="w-full rounded-xl border border-indigo-200 bg-indigo-50/60 p-3">
              <legend className="px-1 text-sm font-semibold text-bone">This is a repeating event. Apply these changes to:</legend>
              <label className="mt-1 flex items-start gap-2.5 text-sm text-bone">
                <input type="radio" name="applyScope" checked={applyScope === 'upcoming'} onChange={() => setApplyScope('upcoming')} className="mt-0.5 h-4 w-4 accent-marigold" />
                <span><strong>This and all upcoming dates</strong><span className="block text-xs text-muted">Details like the title, description, photo, price, and location update everywhere ahead. Each date keeps its own day; a new time is applied to all of them.</span></span>
              </label>
              <label className="mt-2 flex items-start gap-2.5 text-sm text-bone">
                <input type="radio" name="applyScope" checked={applyScope === 'one'} onChange={() => setApplyScope('one')} className="mt-0.5 h-4 w-4 accent-marigold" />
                <span><strong>Only this date</strong></span>
              </label>
            </fieldset>
          )}
          {isLastStep && (
            <button type="submit" disabled={saving} className="rounded-lg bg-marigold px-5 py-2.5 font-semibold text-ink hover:bg-marigold/90 disabled:opacity-50">
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create event'}
            </button>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={(e) => {
              previewAfterSave.current = true;
              handleSubmit(e as unknown as FormEvent);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-5 py-2.5 font-semibold text-bone hover:border-marigold hover:text-marigold disabled:opacity-50"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z" /><circle cx="12" cy="12" r="3" />
            </svg>
            {!isEdit ? 'Save draft & preview' : status === 'draft' ? 'Save & preview' : 'Save & view page'}
          </button>
          <button type="button" onClick={() => (hasInAppHistory() ? navigate(-1) : navigate(isEdit && id ? `/organizer/events/${id}` : '/organizer'))} className="rounded-lg px-5 py-2.5 font-semibold text-muted hover:text-bone">
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

// Tells the organizer their followers will hear about this event.
function FollowerPublishNote({ email }: { email?: string | null }) {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    if (!email) return;
    supabase.rpc('follower_count', { p_email: email }).then(({ data }) => setN(typeof data === 'number' ? data : 0));
  }, [email]);
  if (!n) return null;
  return <p className="mt-1.5 text-xs text-muted">Your {n.toLocaleString()} follower{n === 1 ? '' : 's'} will be notified about an hour after you publish (upcoming events only). Unpublish within the hour and no one is emailed.</p>;
}
