import { useEffect, useState } from 'react';
import EventHighlights from '../components/video/EventHighlights';
import HeaderVideo, { ProcessingLabel, useHeaderVideo, useHeaderVideoProcessing } from '../components/video/HeaderVideo';
import EmbeddedCheckoutSheet from '../components/events/EmbeddedCheckoutSheet';
import { publishableKey } from '../lib/embeddedCheckout';
import { useEventWhiteLabel } from '../lib/whiteLabel';
import WhiteLabelHeader from '../components/events/WhiteLabelHeader';
import MerchAddOns, { type AddOnPick } from '../components/events/MerchAddOns';
import GalaGuestCard from '../components/events/GalaGuestCard';
import VolunteerCard from '../components/events/VolunteerCard';
import { recordLinkVisit } from '../lib/linkTracking';
import { NetworkingInvite } from '../components/business/NetworkingCards';
import { MoreFromOrg, OrgHostedBy } from '../components/business/OrgHostedBy';
import DonationCard from '../components/business/DonationCard';
import RegistrationSheet from '../components/business/RegistrationSheet';
import { loadMyRequest, loadQuestions, type MyRequest, type Question } from '../lib/registration';
import TierPicker from '../components/business/TierPicker';
import { loadTiers, type TierAvail } from '../lib/tiers';
import BusinessEventSections, { OrgStrip, useBusinessData } from '../components/business/BusinessEventSections';
import { useFeature } from '../lib/preview';
import EventCover from '../components/EventCover';
import ShareQR from '../components/ShareQR';
import CopyAddress from '../components/CopyAddress';
import { isIOS } from '../lib/displayMode';
import HostedBy from '../components/HostedBy';
import CancelRegistration, { canCancelRegistration } from '../components/CancelRegistration';
import BackButton from '../components/BackButton';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import type { TapEvent, Ticket } from '../lib/types';
import ShopSection from '../components/products/ShopSection';
import EventLinks from '../components/EventLinks';
import EventProgram from '../components/EventProgram';
import { visibleLinks } from '../lib/socialLinks';
import { safeTicketUrl, ticketSiteName } from '../lib/externalTickets';
import VendorApplicationForm from '../components/VendorApplicationForm';
import SeatPicker from '../components/SeatPicker';
import { resolveFeatureIcon } from '../lib/featureIconMap';
import CommunityPosts from '../components/discover/CommunityPosts';
import { EventPageSkeleton } from '../components/ui/Skeleton';

export default function PublicEventDetail() {
  const [addOns, setAddOns] = useState<AddOnPick[]>([]);
  // More than one ticket per order (single-price and free events).
  const [qty, setQty] = useState(1);
  const [guestNames, setGuestNames] = useState<string[]>([]);
  const [ticketLimit, setTicketLimit] = useState(1);
  const [myCount, setMyCount] = useState(0);
  const [buyMore, setBuyMore] = useState(false);
  const volunteersOn = useFeature('volunteers');
  const galaOn = useFeature('gala');
  // Promotion links: arriving with ?src=<code> records a visit for that link.
  useEffect(() => {
    const src = new URLSearchParams(window.location.search).get('src');
    if (src) recordLinkVisit(src);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const networkingOn = useFeature('networking');
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const { user, isAdmin } = useAuth();
  const businessOn = useFeature('business');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [event, setEvent] = useState<TapEvent | null>(null);
  // Business / nonprofit events: organization brand, agenda, speakers, sponsors (TapIN for Business).
  const biz = useBusinessData(event);
  const whiteLabel = useEventWhiteLabel(event?.id);
  const headerVideo = useHeaderVideo(event?.id);
  const headerProcessing = useHeaderVideoProcessing(event?.id);
  const videoHeadersOn = useFeature('video_headers');
  const [embedSecret, setEmbedSecret] = useState<string | null>(null);
  // Ticket tiers (preview): when an event has tiers, the tier picker replaces the single price.
  const [tiers, setTiers] = useState<TierAvail[]>([]);
  useEffect(() => { if (id && businessOn) loadTiers(id).then(setTiers); else setTiers([]); }, [id, businessOn]);
  // Registration questions and approval (preview).
  const [questions, setQuestions] = useState<Question[]>([]);
  const [myRequest, setMyRequest] = useState<MyRequest | null>(null);
  const [askSheet, setAskSheet] = useState<{ mode: 'register' | 'request'; items: { tier_id: string; qty: number }[] | null; resolve: (ok: boolean) => void } | null>(null);
  useEffect(() => { if (id && businessOn) loadQuestions(id).then(setQuestions); else setQuestions([]); }, [id, businessOn]);
  useEffect(() => { if (id && businessOn && user?.email) loadMyRequest(id, user.email).then(setMyRequest); else setMyRequest(null); }, [id, businessOn, user?.email]);
  const askFirst = (mode: 'register' | 'request', items: { tier_id: string; qty: number }[] | null) => new Promise<boolean>((resolve) => setAskSheet({ mode, items, resolve }));
  const isHost = !!event && !!user && (event.organizer_id === user.id || ((event as { collaborators?: string[] }).collaborators ?? []).includes(user.email ?? ''));
  const approvalNeeded = businessOn && !!event?.requires_approval && !isHost && myRequest?.status !== 'approved';
  const donationsOn = businessOn && (event?.event_kind ?? 'community') !== 'business' && !!event?.donations_enabled && event?.status !== 'draft';
  // Before registering or paying: questions, or (approval events) a join request instead.
  const beforeContinue = async (items: { tier_id: string; qty: number }[] | null): Promise<'continue' | 'stop'> => {
    if (approvalNeeded) {
      if (myRequest?.status === 'pending') return 'stop';
      const ok = await askFirst('request', items);
      if (ok && id && user?.email) loadMyRequest(id, user.email).then(setMyRequest);
      return 'stop';
    }
    if (questions.length) return (await askFirst('register', null)) ? 'continue' : 'stop';
    return 'continue';
  };
  const [seriesEvents, setSeriesEvents] = useState<{ id: string; start_date: string }[]>([]);
  const [selectedSectionName, setSelectedSectionName] = useState<string | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  // Promo code for reserved seats (checked with check_promo_code, applied by the seated checkout).
  const [seatCodeOpen, setSeatCodeOpen] = useState(false);
  const [seatCodeInput, setSeatCodeInput] = useState('');
  const [seatPromo, setSeatPromo] = useState<{ code: string; kind: 'percent' | 'amount'; value: number } | null>(null);
  const [seatCodeErr, setSeatCodeErr] = useState<string | null>(null);
  const [useBundle, setUseBundle] = useState(false);
  const [organizerName, setOrganizerName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [myTicket, setMyTicket] = useState<Ticket | null>(null);
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [shareCopied, setShareCopied] = useState(false);
  const checkoutStatus = searchParams.get('checkout'); // 'success' | 'cancelled' | null
  // Backed out of a seated checkout: free those seats right away.
  const seatHold = searchParams.get('seat_hold');
  const [seatsReleased, setSeatsReleased] = useState<null | 'releasing' | 'released' | 'pending'>(null);
  useEffect(() => {
    if (checkoutStatus !== 'cancelled' || !seatHold || !id) return;
    setSeatsReleased('releasing');
    supabase.functions.invoke('release-seat-hold', { body: { hold_id: seatHold } }).then(async ({ data, error }) => {
      setSeatsReleased(!error && data?.released ? 'released' : 'pending');
      const { data: fresh } = await supabase.from('events').select('booked_seats').eq('id', id).maybeSingle();
      if (fresh) setEvent((ev) => (ev ? { ...ev, booked_seats: fresh.booked_seats } : ev));
      // Tidy the address so a refresh doesn't try again.
      const url = new URL(window.location.href);
      url.searchParams.delete('seat_hold');
      window.history.replaceState(window.history.state, '', url.toString());
    });
  }, [checkoutStatus, seatHold, id]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase.from('events').select('*').eq('id', id).single();
      const ev = data as TapEvent | null;
      setEvent(ev);
      const seriesId = ev?.parent_event_id || ev?.id;
      if (ev?.is_recurring && seriesId) {
        supabase
          .from('events')
          .select('id, start_date')
          .or(`id.eq.${seriesId},parent_event_id.eq.${seriesId}`)
          .eq('status', 'published')
          .order('start_date', { ascending: true })
          .then(({ data: siblings }) => setSeriesEvents(siblings ?? []));
      }
      if (ev?.organizer_email) {
        const { data: org } = await supabase
          .from('public_profiles')
          .select('full_name')
          .eq('email', ev.organizer_email)
          .single();
        setOrganizerName(org?.full_name ?? null);
      }
      setLoading(false);
    })();
  }, [id]);

  useEffect(() => {
    if (!id || !event) return;
    (async () => {
      // Capacity check (best-effort: not race-condition-proof against
      // simultaneous last-second signups, but sufficient for typical use).
      if (event.max_capacity) {
        const { data: confirmed } = await supabase
          .from('tickets')
          .select('quantity')
          .eq('event_id', id)
          .eq('status', 'confirmed');
        setConfirmedCount((confirmed ?? []).reduce((sum, t) => sum + (t.quantity || 1), 0));
      }
      if (user?.email) {
        const { data: existing } = await supabase
          .from('tickets')
          .select('*')
          .eq('event_id', id)
          .eq('attendee_email', user.email)
          .neq('status', 'cancelled')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        setMyTicket((existing as Ticket) ?? null);
        const { data: mine } = await supabase.from('tickets').select('quantity').eq('event_id', id).eq('attendee_email', user.email).in('status', ['confirmed', 'used']);
        setMyCount(((mine ?? []) as { quantity: number | null }[]).reduce((n, t) => n + Math.max(1, t.quantity || 1), 0));
      }
      const { data: lim } = await supabase.rpc('event_ticket_limit', { p_event_id: id });
      setTicketLimit(Number(lim) || 1);
    })();
  }, [id, event, user?.email, checkoutStatus]);

  useEffect(() => {
    if (!user?.email) {
      setSavedIds([]);
      return;
    }
    supabase.from('profiles').select('saved_event_ids').eq('email', user.email).single().then(({ data }) => {
      setSavedIds((data?.saved_event_ids as string[]) ?? []);
    });
  }, [user?.email]);

  async function toggleSave() {
    if (!id) return;
    if (!user?.email) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    const next = savedIds.includes(id) ? savedIds.filter((x) => x !== id) : [...savedIds, id];
    setSavedIds(next);
    await supabase.from('profiles').update({ saved_event_ids: next }).eq('email', user.email);
  }

  async function handleShare() {
    const shareUrl = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: event?.title, url: shareUrl });
      } catch {
        /* user cancelled the native share sheet — not an error */
      }
      return;
    }
    await navigator.clipboard.writeText(shareUrl);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  }

  async function handleRegister() {
    if (!id || !event || !user?.email || event.status === 'draft' || hasEnded) return;
    setRegistering(true);
    setRegisterError(null);

    const { data: ids, error: regError } = await supabase.rpc('register_free_tickets', { p_event_id: id, p_qty: qty, p_guest_names: event.ask_guest_names ? guestNames.slice(0, qty) : null });
    if (regError || !Array.isArray(ids) || !ids.length) {
      setRegistering(false);
      setRegisterError(regError?.message && !/function|permission|jwt/i.test(regError.message) ? regError.message : 'Something went wrong. Please try again.');
      return;
    }
    const { data: ticket } = await supabase.from('tickets').select('*').eq('id', ids[0]).maybeSingle();
    setRegistering(false);
    if (!ticket) { setRegisterError('Something went wrong. Please try again.'); return; }
    setMyTicket(ticket as Ticket);
    setMyCount((n) => n + ids.length);
    setConfirmedCount((n) => n + ids.length);
    setBuyMore(false); setQty(1); setGuestNames([]);

    // Best-effort: the registration itself has already succeeded regardless
    // of whether this email actually goes out, so failures here are swallowed.
    // The server builds the confirmation email and only sends it to the ticket holder.
    supabase.functions
      .invoke('send-app-email', { body: { kind: 'registration_confirmation', ticket_id: ticket.id } })
      .catch(() => {});
  }

  async function handleBuyTicket() {
    if (!id || !event || event.status === 'draft' || hasEnded) return;
    setRegistering(true);
    setRegisterError(null);

    const base = window.location.origin + import.meta.env.BASE_URL;
    const embed = !!whiteLabel && !!(await publishableKey());
    const { data, error } = await supabase.functions.invoke('create-stripe-checkout', {
      body: {
        event_id: id,
        add_ons: addOns,
        embedded: embed,
        quantity: qty,
        guest_names: event.ask_guest_names ? guestNames.slice(0, qty) : [],
        successUrl: `${base}events/${id}?checkout=success`,
        cancelUrl: `${base}events/${id}?checkout=cancelled`,
      },
    });

    setRegistering(false);
    if (!error && data?.client_secret) { setEmbedSecret(data.client_secret as string); return; }
    if (error || !data?.url) {
      let msg = 'Something went wrong starting checkout. Please try again.';
      try { const j = await (error as { context?: Response })?.context?.json(); if (j?.error && !/stripe|unauthorized/i.test(j.error)) msg = j.error; } catch { /* keep default */ }
      setRegisterError(msg);
      return;
    }
    window.location.href = data.url;
  }

  async function handleBuySeats() {
    if (!id || !event || !selectedSectionName || selectedSeats.length === 0 || event.status === 'draft' || hasEnded) return;
    setRegistering(true);
    setRegisterError(null);

    const base = window.location.origin + import.meta.env.BASE_URL;
    const { data, error } = await supabase.functions.invoke('create-seated-checkout', {
      body: {
        event_id: id,
        section_name: selectedSectionName,
        seat_labels: selectedSeats,
        use_bundle: useBundle,
        promo_code: seatPromo?.code ?? null,
        successUrl: `${base}events/${id}?checkout=success`,
        cancelUrl: `${base}events/${id}?checkout=cancelled`,
      },
    });

    setRegistering(false);
    if (error || !data?.url) {
      let msg = 'Something went wrong starting checkout. Please try again.';
      try { const j = await (error as { context?: Response })?.context?.json(); if (j?.error) msg = String(j.error); } catch { /* default */ }
      setRegisterError(msg);
      return;
    }
    window.location.href = data.url;
  }

  async function applySeatCode() {
    if (!id) return;
    setSeatCodeErr(null);
    const { data, error } = await supabase.rpc('check_promo_code', { p_event_id: id, p_code: seatCodeInput });
    const row = ((data ?? []) as { code: string; kind: 'percent' | 'amount'; value: number; tier_ids: string[] | null }[])[0];
    if (error || !row) { setSeatCodeErr(error?.message?.replace(/^.*?: /, '') || "That code isn't valid for this event."); return; }
    if (row.tier_ids && row.tier_ids.length) { setSeatCodeErr('That code only works on certain ticket types, not reserved seats.'); return; }
    setSeatPromo({ code: row.code, kind: row.kind, value: Number(row.value) });
  }

  function toggleSeat(seatLabel: string) {
    setSelectedSeats((prev) => (prev.includes(seatLabel) ? prev.filter((s) => s !== seatLabel) : [...prev, seatLabel]));
  }

  async function handleBuySeriesPass() {
    if (!id || !event || event.status === 'draft' || hasEnded) return;
    setRegistering(true);
    setRegisterError(null);

    const base = window.location.origin + import.meta.env.BASE_URL;
    const { data, error } = await supabase.functions.invoke('create-series-pass-checkout', {
      body: {
        event_id: id,
        successUrl: `${base}events/${id}?checkout=success`,
        cancelUrl: `${base}events/${id}?checkout=cancelled`,
      },
    });

    setRegistering(false);
    if (error || !data?.url) {
      setRegisterError(error?.message || 'Something went wrong starting checkout. Please try again.');
      return;
    }
    window.location.href = data.url;
  }

  if (loading) return <EventPageSkeleton />;
  if (!event) return <div className="p-10 text-center text-magenta">Event not found.</div>;

  const isFull = !!event.max_capacity && confirmedCount >= event.max_capacity && (!myTicket || buyMore);
  const isFree = event.event_type === 'free';
  // Drafts are only visible to their organizer and team (enforced by the
  // database), so viewing one is a preview: ticket buttons are switched off.
  const isPreview = event.status === 'draft';
  const canPublish = isPreview && user?.id === event.organizer_id;
  // Mirrors public.event_has_ended() in the database, which is what actually
  // blocks registration -- this just keeps the page honest about it without
  // waiting on a page refresh after the event flips to 'completed'.
  const effectiveEnd = event.end_date ?? event.start_date;
  const hasEnded = !event.date_tbd && !!effectiveEnd && new Date(effectiveEnd).getTime() < Date.now();

  async function publishFromPreview() {
    if (!event) return;
    const { error } = await supabase.from('events').update({ status: 'published' }).eq('id', event.id);
    if (!error) setEvent({ ...event, status: 'published' });
  }

  return (
    <div className="min-h-screen bg-ink">
      {whiteLabel && <WhiteLabelHeader brand={whiteLabel} />}
      {embedSecret && <EmbeddedCheckoutSheet clientSecret={embedSecret} title={whiteLabel?.name ?? event?.title ?? 'Checkout'} accent={whiteLabel?.primary} onClose={() => setEmbedSecret(null)} />}
      {isPreview && (
        <div className="sticky top-0 z-40 border-b border-amber-300 bg-amber-100 px-4 py-2.5 sm:px-6">
          <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-amber-900">
              <span className="font-semibold">Draft preview.</span> Only you and your team can see this page. Ticket buttons turn on once it's published.
            </p>
            <div className="flex shrink-0 gap-2">
              <Link to={`/organizer/events/${event.id}/edit`} className="rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-sm font-semibold text-amber-900 hover:bg-amber-50">
                Keep editing
              </Link>
              {canPublish && (
                <button type="button" onClick={publishFromPreview} className="rounded-lg bg-mint px-3 py-1.5 text-sm font-semibold text-white hover:bg-mint/90">
                  Publish
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {!isPreview && hasEnded && event.status !== 'cancelled' && (
        <div className="sticky top-0 z-40 border-b border-gray-300 bg-gray-100 px-4 py-2.5 sm:px-6">
          <p className="mx-auto max-w-3xl text-sm text-gray-700">
            <span className="font-semibold">This event has ended.</span> New registrations and ticket purchases are closed.
          </p>
        </div>
      )}
      {/* Hero: title and key facts live directly on the image, editorial-style,
          instead of a separate text block below a plain picture frame. */}
      {businessOn && biz.isBiz && <OrgStrip org={biz.org} kind={event.event_kind} />}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-gray-900 sm:aspect-[21/9]">
        {headerProcessing && <ProcessingLabel />}
        {headerVideo ? (
          <HeaderVideo src={headerVideo.src} poster={headerVideo.poster ?? event.poster_url ?? null} postId={headerVideo.id} />
        ) : event.poster_url ? (
          <img src={event.poster_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <EventCover category={event.category} size="lg" className="h-full w-full" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        {event.poster_url && event.poster_credit && (
          <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/45 px-2 py-0.5 text-[10px] text-white/90 sm:right-6 sm:top-6">{event.poster_credit}</span>
        )}

        <BackButton variant="overlay" fallback="/" fallbackLabel="Back to Discover" className="absolute left-4 top-4 sm:left-6 sm:top-6" />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5 sm:p-8 [&_a]:pointer-events-auto [&_button]:pointer-events-auto">
          <div className="mx-auto max-w-4xl">
            {event.category && (
              <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                {event.category}
              </span>
            )}
            <h1 className="mt-2 font-display text-2xl font-extrabold leading-tight text-white sm:text-4xl">
              {event.title}
            </h1>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 pb-16 sm:px-6">
        {event.is_test && (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <strong>Test event.</strong> Only you and this event's team can see it. It won't appear on Discover or in follower emails. Payments here are real.
          </div>
        )}
        {checkoutStatus === 'success' && (
          <div className="mt-4 rounded-xl bg-green-50 p-4 text-sm text-green-700">
            ✓ Payment received! Your ticket is confirmed — check your email.
          </div>
        )}
        {checkoutStatus === 'cancelled' && (
          <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
            Checkout was cancelled — no charge was made.
            {seatsReleased === 'releasing' && ' Releasing your seats…'}
            {seatsReleased === 'released' && ' Your seats have been released so others can choose them. You can pick seats again anytime.'}
            {seatsReleased === 'pending' && " Your seats will be released automatically within 30 minutes."}
          </div>
        )}

        {/* Key facts strip: fast orientation without hunting through prose. */}
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-gray-100 pb-5 text-[15px] text-gray-700">
          {event.start_date && (
            <span className="flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
              {new Date(event.start_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              {' · '}
              {new Date(event.start_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
          <span className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400"><path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 1 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
            {event.is_online ? 'Virtual event' : (event.location_name || 'Venue TBD')}
          </span>
          <span className="ml-auto flex items-center gap-3">
            {!isPreview && <button onClick={handleShare} className="-my-2 flex items-center gap-1.5 py-2 text-sm font-medium text-gray-500 hover:text-marigold">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
              {shareCopied ? 'Copied!' : 'Share'}
            </button>}
            {!isPreview && event && <ShareQR path={`/events/${event.id}`} title={event.title} label="QR"
              subtitle={event.start_date ? new Date(event.start_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : undefined}
              className="-my-2 flex items-center gap-1.5 py-2 text-sm font-medium text-gray-500 hover:text-marigold" />}
            {!isPreview && (<button onClick={toggleSave} className={`-my-2 flex items-center gap-1.5 py-2 text-sm font-medium ${id && savedIds.includes(id) ? 'text-marigold' : 'text-gray-500 hover:text-marigold'}`}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill={id && savedIds.includes(id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" strokeLinejoin="round" /></svg>
              {id && savedIds.includes(id) ? 'Saved' : 'Save'}
            </button>)}
          </span>
        </div>

        {event.source_name ? (
          // Listed from another site: credit the source, send people there, and let the real organizer claim it.
          <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-4 text-sm">
            <p className="text-gray-700">Listed by TapIN from <strong className="text-gray-900">{event.source_name}</strong>. Details, times and tickets are set by the event's organizer.</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {(event.external_ticket_url || event.source_url) && (
                <a href={event.external_ticket_url || event.source_url || '#'} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-white">View on {event.source_name} ↗</a>
              )}
              {isAdmin && event.poster_url && (
                <button type="button" onClick={async () => {
                  const { error } = await supabase.from('events').update({ poster_url: null, poster_credit: null }).eq('id', event.id);
                  if (!error) setEvent({ ...event, poster_url: null, poster_credit: null });
                }} className="text-sm font-medium text-gray-500 hover:text-red-600">Remove photo</button>
              )}
              <a href={`mailto:support@tapin2events.com?subject=${encodeURIComponent('Claim my event: ' + event.title)}&body=${encodeURIComponent(`Hi TapIN, I'm the organizer of "${event.title}" (${window.location.href}). I'd like to manage this listing.`)}`}
                className="text-sm font-medium text-marigold hover:underline">Is this your event? Claim it</a>
            </div>
          </div>
        ) : (
          <>
            {businessOn && biz.org ? <OrgHostedBy org={biz.org} /> : event.organizer_email && <HostedBy organizerEmail={event.organizer_email} fallbackName={organizerName} />}
            <div className="mt-2 text-right text-sm">
              <a href={`mailto:${event.organizer_email}`} className="font-medium text-marigold hover:underline">
                Contact organizer
              </a>
            </div>
          </>
        )}

        {user?.email === event.organizer_email && (
          <div className="mt-3 flex flex-wrap gap-2 rounded-xl bg-gray-50 p-4">
            <Link to={`/organizer/events/${event.id}`} className="rounded-lg bg-marigold px-3 py-1.5 text-xs font-semibold text-white hover:bg-marigold/90">
              Dashboard
            </Link>
            {event.status === 'completed' ? (
              <span className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-500">Ended</span>
            ) : (
              <button
                onClick={async () => {
                  const nextStatus = event.status === 'published' ? 'draft' : 'published';
                  const { error } = await supabase.from('events').update({ status: nextStatus }).eq('id', event.id);
                  if (!error) setEvent({ ...event, status: nextStatus });
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  event.status === 'published' ? 'border border-gray-300 text-gray-700 hover:border-magenta hover:text-magenta' : 'bg-mint text-white hover:bg-mint/90'
                }`}
              >
                {event.status === 'published' ? 'Unpublish' : 'Publish event'}
              </button>
            )}
            <Link to={`/organizer/events/${event.id}/edit`} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-marigold hover:text-marigold">
              Edit
            </Link>
            <Link to={`/resources?for_event=${event.id}`} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-marigold hover:text-marigold">
              Book Resources
            </Link>
          </div>
        )}

        {/* Approval-required events: where my request stands. */}
        {businessOn && event.requires_approval && !isHost && !myTicket && (
          <div className={`mt-6 rounded-2xl px-4 py-3 text-sm ${myRequest?.status === 'approved' ? 'bg-green-50 text-green-900' : myRequest?.status === 'declined' ? 'bg-gray-100 text-gray-700' : myRequest?.status === 'pending' ? 'bg-amber-50 text-amber-900' : 'bg-indigo-50 text-indigo-900'}`}>
            {myRequest?.status === 'approved' ? <p><strong>✓ You're approved.</strong> Choose your ticket below to finish registering.</p>
              : myRequest?.status === 'declined' ? <p><strong>Your request wasn't approved this time.</strong>{myRequest.decision_note ? ` "${myRequest.decision_note}"` : ''}</p>
              : myRequest?.status === 'pending' ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p><strong>Request sent.</strong> The organizer will review it, and you'll get an email when they decide.</p>
                  <button onClick={async () => { await supabase.rpc('cancel_registration_request', { p_event_id: event.id }); setMyRequest(null); }} className="text-xs font-medium underline">Cancel request</button>
                </div>
              ) : <p><strong>This event requires approval.</strong> Request to join, and the organizer will let you know.</p>}
          </div>
        )}

        {/* The CTA is the lead of the page — everything above just orients
            the visitor, everything below is supporting detail. */}
        {safeTicketUrl(event.external_ticket_url) ? (
          // Tickets are sold on another site: send people there.
          <div className="mt-6 flex flex-col gap-4 rounded-2xl bg-gray-900 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <p className="text-sm text-gray-400">{isFree ? 'Free to attend' : 'Tickets'}</p>
              <p className="font-display text-2xl font-extrabold text-white">
                {isFree ? 'Free' : event.ticket_price > 0 ? `From $${event.ticket_price}` : 'See ticket options'}
              </p>
              <p className="mt-0.5 text-xs text-gray-400">{isFree ? 'RSVP' : 'Sold'} on {ticketSiteName(event.external_ticket_url!)}</p>
            </div>
            {isPreview ? (
              <span className="rounded-xl bg-gradient-to-r from-marigold to-teal px-6 py-3 text-center text-sm font-semibold text-white opacity-50">Available once published</span>
            ) : hasEnded ? (
              <span className="rounded-xl bg-gray-700 px-6 py-3 text-center text-sm font-semibold text-white opacity-70">Event has ended</span>
            ) : (
              <a
                href={safeTicketUrl(event.external_ticket_url)!}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-gradient-to-r from-marigold to-teal px-6 py-3 text-center text-sm font-semibold text-white hover:opacity-90"
              >
                {isFree ? 'RSVP' : 'Get tickets'} on {ticketSiteName(event.external_ticket_url!)} ↗
              </a>
            )}
          </div>
        ) : approvalNeeded && event.is_seating_enabled ? (
          <div className="mt-6 rounded-2xl bg-gray-900 p-5 text-center sm:p-6">
            <button onClick={() => beforeContinue(null)} disabled={myRequest?.status === 'pending' || isPreview || hasEnded} className="rounded-xl bg-gradient-to-r from-marigold to-teal px-6 py-3 text-sm font-semibold text-white disabled:opacity-50">{myRequest?.status === 'pending' ? 'Request sent' : 'Request to join'}</button>
          </div>
        ) : event.is_seating_enabled && event.seating_sections && event.seating_sections.length > 0 ? (
          <div className="mt-6 rounded-2xl bg-gray-900 p-5 sm:p-6">
            <p className="text-sm font-semibold text-white">Select Your Seats</p>
            {myTicket ? (
              <div className="mt-3">
                <p className="text-sm font-medium text-mint">✓ You're registered</p>
                <Link to={`/pass/${myTicket.id}`} className="text-sm font-medium text-white underline underline-offset-2">
                  View your ticket &amp; QR code
                </Link>
                {canCancelRegistration(myTicket, event.start_date) && (
                  <CancelRegistration ticketId={myTicket.id} eventTitle={event.title} variant="light" className="mt-1"
                    onCancelled={() => { setMyTicket(null); setConfirmedCount((n) => Math.max(n - (myTicket.quantity || 1), 0)); }} />
                )}
              </div>
            ) : !user ? (
              <button
                onClick={() => navigate('/login', { state: { from: location.pathname } })}
                className="mt-3 rounded-xl bg-gradient-to-r from-marigold to-teal px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
              >
                Sign in to choose seats
              </button>
            ) : (
              <>
                <div className="mt-3 flex flex-col gap-3">
                  {event.seating_sections.map((section) => (
                    <SeatPicker
                      key={section.name}
                      section={section}
                      bookedSeats={event.booked_seats ?? []}
                      selectedSeats={selectedSeats.filter((s) => s.startsWith(`${section.name}-`))}
                      onToggleSeat={(seatLabel) => {
                        // Seats from only one section can be selected at a time,
                        // since checkout is submitted per-section.
                        if (selectedSectionName && selectedSectionName !== section.name && selectedSeats.length > 0) {
                          setSelectedSeats([seatLabel]);
                          setUseBundle(false);
                        } else {
                          toggleSeat(seatLabel);
                        }
                        setSelectedSectionName(section.name);
                      }}
                    />
                  ))}
                </div>

                {selectedSeats.length > 0 && (() => {
                  const section = event.seating_sections!.find((s) => s.name === selectedSectionName);
                  const fullSeat = useBundle && section ? section.bundle_price! : section?.price ?? 0;
                  const perSeatPrice = seatPromo ? Math.max(0, seatPromo.kind === 'percent' ? Math.round(fullSeat * (100 - seatPromo.value)) / 100 : fullSeat - seatPromo.value) : fullSeat;
                  const total = selectedSeats.length * (perSeatPrice ?? 0);
                  const saved = selectedSeats.length * (fullSeat - perSeatPrice);
                  return (
                    <div className="mt-4 flex flex-col gap-3 border-t border-gray-800 pt-4">
                      <p className="text-sm text-gray-300">
                        {selectedSeats.length} seat{selectedSeats.length === 1 ? '' : 's'} selected: <span className="text-white">
                          {selectedSeats
                            .map((label) => {
                              const match = label.match(/-T(\d+)-(\d+)$/);
                              return match ? `Table ${match[1]}, Seat ${match[2]}` : label;
                            })
                            .join(' · ')}
                        </span>
                      </p>

                      {section?.bundle_enabled && (
                        <label className="flex items-start gap-2 rounded-lg bg-gray-800/70 p-3 text-sm text-gray-200">
                          <input type="checkbox" checked={useBundle} onChange={(e) => setUseBundle(e.target.checked)} className="mt-0.5" />
                          <span>
                            Add bundle upgrade — <span className="font-medium text-white">+${((section.bundle_price ?? 0) - section.price).toFixed(2)}/seat</span>
                            {section.bundle_description && <span className="block text-xs text-gray-400">{section.bundle_description}</span>}
                          </span>
                        </label>
                      )}

                      <div className="text-sm">
                        {seatPromo ? (
                          <p className="flex flex-wrap items-center gap-2 text-green-300">
                            🏷️ Code <strong>{seatPromo.code}</strong> applied: you save ${saved.toFixed(2)}
                            <button type="button" onClick={() => { setSeatPromo(null); setSeatCodeInput(''); }} className="text-xs text-gray-400 underline">Remove</button>
                          </p>
                        ) : seatCodeOpen ? (
                          <div className="flex gap-2">
                            <input value={seatCodeInput} onChange={(e) => setSeatCodeInput(e.target.value.toUpperCase())} placeholder="Promo code" aria-label="Promo code"
                              className="min-w-0 flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-base uppercase text-white sm:text-sm" />
                            <button type="button" onClick={applySeatCode} disabled={!seatCodeInput.trim()} className="rounded-lg bg-gray-700 px-3 text-sm font-semibold text-white disabled:opacity-50">Apply</button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => setSeatCodeOpen(true)} className="text-sm text-gray-300 underline">Have a promo code?</button>
                        )}
                        {seatCodeErr && <p className="mt-1 text-xs text-magenta">{seatCodeErr}</p>}
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <span />
                        <button
                          onClick={() => handleBuySeats()}
                          disabled={registering || isPreview || hasEnded}
                          className="rounded-xl bg-gradient-to-r from-marigold to-teal px-6 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                        >
                          {isPreview ? 'Available once published' : hasEnded ? 'Event has ended' : registering ? 'Please wait…' : `Buy ${selectedSeats.length} seat${selectedSeats.length === 1 ? '' : 's'} — $${total.toFixed(2)}`}
                        </button>
                      </div>
                    </div>
                  );
                })()}
                {registerError && <p className="mt-2 text-sm text-magenta">{registerError}</p>}
              </>
            )}
          </div>
        ) : businessOn && tiers.length > 0 ? (
          <>
            {myTicket && (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm">
                <span className="font-medium text-green-800">✓ You have tickets for this event</span>
                <Link to={`/pass/${myTicket.id}`} className="font-medium text-green-800 underline underline-offset-2">View ticket &amp; QR code</Link>
              </div>
            )}
            <TierPicker eventId={event.id} tiers={tiers} accent={biz.org?.brand.accent}
              beforeContinue={beforeContinue} actionLabel={approvalNeeded ? (myRequest?.status === 'pending' ? 'Request sent' : 'Request to join') : undefined}
              donation={donationsOn && !approvalNeeded ? { presets: (event.donation_presets ?? [25, 50, 100]).map(Number), min: Math.max(5, Number(event.min_donation_amount) || 5), recipient: biz.org?.name ?? organizerName ?? event.title, nonprofit: event.event_kind === 'nonprofit' } : null}
              disabledReason={isPreview ? 'Available once published' : hasEnded ? 'This event has ended' : isFull ? 'This event is full' : null}
              onRegistered={async (ticketId) => {
                const { data: t } = await supabase.from('tickets').select('*').eq('id', ticketId).maybeSingle();
                if (t) setMyTicket(t as Ticket);
                loadTiers(event.id).then(setTiers);
              }} />
          </>
        ) : (
          <div data-tour="get-tickets" className="mt-6 flex flex-col gap-4 rounded-2xl bg-gray-900 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <p className="text-sm text-gray-400">{isFree ? 'Free to attend' : 'Ticket price'}</p>
              <p className="font-display text-2xl font-extrabold text-white">{isFree ? 'Free' : `$${event.ticket_price}`}</p>
            </div>
            {myTicket && !buyMore ? (
              <div className="flex flex-col gap-1 sm:items-end">
                <p className="text-sm font-medium text-mint">✓ {myCount > 1 ? `You have ${myCount} tickets` : "You're registered"}</p>
                <Link to={myCount > 1 ? '/activity' : `/pass/${myTicket.id}`} className="text-sm font-medium text-white underline underline-offset-2">
                  {myCount > 1 ? 'View your tickets & QR codes' : <>View your ticket &amp; QR code</>}
                </Link>
                {!approvalNeeded && !hasEnded && (isFree ? myCount < ticketLimit : true) && !(event.max_capacity && confirmedCount >= event.max_capacity) && (
                  <button onClick={() => { setBuyMore(true); setQty(1); }} className="text-sm font-medium text-white/80 underline underline-offset-2">Get more tickets</button>
                )}
                {canCancelRegistration(myTicket, event.start_date) && (
                  <CancelRegistration ticketId={myTicket.id} eventTitle={event.title} variant="light" className="mt-1"
                    onCancelled={() => { setMyTicket(null); setConfirmedCount((n) => Math.max(n - (myTicket.quantity || 1), 0)); }} />
                )}
              </div>
            ) : !user ? (
              <button
                onClick={() => navigate('/login', { state: { from: location.pathname } })}
                className="rounded-xl bg-gradient-to-r from-marigold to-teal px-6 py-3 text-sm font-semibold text-white hover:opacity-90 sm:w-auto"
              >
                Sign in to {isFree ? 'register' : 'buy a ticket'}
              </button>
            ) : hasEnded ? (
              <p className="text-sm font-medium text-gray-400">This event has ended.</p>
            ) : isFull ? (
              <p className="text-sm font-medium text-gray-400">This event is full.</p>
            ) : (
              <div className="flex flex-col items-stretch gap-2 sm:items-end">
                {(() => {
                  const spots = event.max_capacity ? Math.max(0, event.max_capacity - confirmedCount) : Infinity;
                  const maxQty = Math.max(1, Math.min(isFree ? ticketLimit - myCount : ticketLimit, spots));
                  if (approvalNeeded || maxQty <= 1) return null;
                  return (
                    <div className="flex w-full flex-col gap-2 sm:max-w-sm">
                      <div className="flex items-center justify-between gap-3 rounded-xl bg-white/10 px-3 py-2">
                        <span className="text-sm text-white">Tickets</span>
                        <span className="flex items-center gap-2">
                          <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} disabled={qty <= 1} aria-label="Fewer tickets" className="h-9 w-9 rounded-lg bg-white/15 text-lg font-bold text-white disabled:opacity-30">−</button>
                          <span className="w-6 text-center text-lg font-bold text-white" aria-live="polite">{qty}</span>
                          <button type="button" onClick={() => setQty(Math.min(maxQty, qty + 1))} disabled={qty >= maxQty} aria-label="More tickets" className="h-9 w-9 rounded-lg bg-white/15 text-lg font-bold text-white disabled:opacity-30">+</button>
                        </span>
                      </div>
                      {qty >= maxQty && <p className="text-right text-xs text-gray-400">{spots <= maxQty && spots !== Infinity ? `Only ${spots} left` : `Up to ${maxQty} per order`}</p>}
                      {event.ask_guest_names && qty > 1 && (
                        <div className="flex flex-col gap-1.5">
                          <p className="text-xs text-gray-400">Guest names (for each ticket)</p>
                          {Array.from({ length: qty - 1 }).map((_, i) => (
                            <input key={i} value={guestNames[i + 1] ?? ''} onChange={(e) => { const g = [...guestNames]; g[i + 1] = e.target.value; setGuestNames(g); }} maxLength={40}
                              placeholder={`Ticket ${i + 2}: guest's name`} aria-label={`Ticket ${i + 2} guest name`} className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-base text-white placeholder:text-gray-400 sm:text-sm" />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
                {!isFree && <div className="w-full sm:max-w-sm"><MerchAddOns eventId={event.id} value={addOns} onChange={setAddOns} accent={biz.org?.brand.accent} /></div>}
                <button
                  onClick={async () => { if ((await beforeContinue(null)) === 'stop') return; if (isFree) handleRegister(); else handleBuyTicket(); }}
                  disabled={registering || isPreview || hasEnded}
                  className="rounded-xl bg-gradient-to-r from-marigold to-teal px-6 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {isPreview ? 'Available once published' : hasEnded ? 'Event has ended' : registering ? 'Please wait…' : approvalNeeded ? (myRequest?.status === 'pending' ? 'Request sent' : 'Request to join') : isFree ? (qty > 1 ? `Register ${qty} tickets — Free` : 'Register — Free') : qty > 1 ? `Buy ${qty} tickets — $${(Number(event.ticket_price) * qty).toFixed(2).replace(/\.00$/, '')}` : `Buy Ticket — $${event.ticket_price}`}
                </button>
                {registerError && <p className="text-sm text-magenta">{registerError}</p>}
              </div>
            )}
          </div>
        )}

        {event.is_recurring && seriesEvents.length > 1 && (
          <div className="mt-6">
            <label className="text-sm font-medium text-gray-700" htmlFor="series-date">Recurring event · choose a date</label>
            {(() => {
              // Attendees only need upcoming dates (plus the one they're looking at).
              const now = Date.now();
              const options = seriesEvents.filter((e) => e.id === event.id || !e.start_date || new Date(e.start_date).getTime() >= now - 6 * 3600 * 1000);
              const idx = options.findIndex((e) => e.id === event.id);
              const arrow = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-700 disabled:opacity-30';
              return (
                <div className="mt-2 flex items-center gap-2">
                  <button type="button" onClick={() => idx > 0 && navigate(`/events/${options[idx - 1].id}`)} disabled={idx <= 0} aria-label="Previous date" className={arrow}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
                  </button>
                  <select id="series-date" value={event.id} onChange={(ev) => navigate(`/events/${ev.target.value}`)}
                    className="h-11 min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 text-base font-medium text-gray-900">
                    {options.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.start_date ? new Date(e.start_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'Date TBA'}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => idx < options.length - 1 && navigate(`/events/${options[idx + 1].id}`)} disabled={idx >= options.length - 1} aria-label="Next date" className={arrow}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
                  </button>
                </div>
              );
            })()}

            {event.series_pass_enabled && !myTicket && (() => {
              const fullPrice = (event.ticket_price ?? 0) * seriesEvents.length;
              const discount = event.series_pass_discount ?? 0;
              const passPrice = Math.round(fullPrice * (1 - discount / 100) * 100) / 100;
              return (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-indigo-50 p-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      Series pass — all {seriesEvents.length} dates for ${passPrice.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {discount}% off the ${fullPrice.toFixed(2)} price of buying each date separately
                    </p>
                  </div>
                  {!user ? (
                    <button
                      onClick={() => navigate('/login', { state: { from: location.pathname } })}
                      className="rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-white hover:bg-marigold/90"
                    >
                      Sign in to buy
                    </button>
                  ) : (
                    <button
                      onClick={async () => { if ((await beforeContinue(null)) === 'stop') return; handleBuySeriesPass(); }}
                      disabled={registering || isPreview || hasEnded}
                      className="rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-white hover:bg-marigold/90 disabled:opacity-50"
                    >
                      {isPreview ? 'Available once published' : hasEnded ? 'Event has ended' : registering ? 'Please wait…' : approvalNeeded ? (myRequest?.status === 'pending' ? 'Request sent' : 'Request to join') : 'Buy series pass'}
                    </button>
                  )}
                </div>
              );
            })()}
            {registerError && <p className="mt-2 text-sm text-magenta">{registerError}</p>}
          </div>
        )}
        {event.event_type === 'paid' && !event.external_ticket_url && (
          <p className="mt-2 text-xs text-gray-500">Service and processing fees are non-refundable. If the organizer cancels, you'll be refunded the ticket price. <Link to="/refund-policy" className="underline hover:text-gray-700">Refund policy</Link></p>
        )}

        {/* What to expect: description and features together, since both
            answer the same question ("what is this actually like?"). */}
        {(event.description || (event.features && event.features.length > 0)) && (
          <div className="mt-10">
            <h2 className="font-display text-xl font-bold text-gray-900">What to expect</h2>
            {event.description && (
              <p className="mt-3 whitespace-pre-wrap leading-relaxed text-gray-600">{event.description}</p>
            )}
            {event.features && event.features.length > 0 && (
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {event.features.map((f) => (
                  <div key={f.title} className="flex items-start gap-3 rounded-xl bg-gray-50 p-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-lg leading-none">
                      {resolveFeatureIcon(f.icon)}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-gray-900">{f.title}</span>
                      {f.description && <span className="block text-xs text-gray-500">{f.description}</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {networkingOn && id && <NetworkingInvite eventId={id} />}
        {videoHeadersOn && <EventHighlights eventId={event.id} eventTitle={event.title} ended={hasEnded} started={!!event.start_date && new Date(event.start_date).getTime() <= Date.now()} />}
        {galaOn && <GalaGuestCard eventId={event.id} />}
        {volunteersOn && <VolunteerCard eventId={event.id} />}
        {donationsOn && <DonationCard event={event} recipient={biz.org?.name ?? organizerName ?? event.title} accent={biz.org?.brand.accent} />}
        {businessOn && biz.isBiz && <BusinessEventSections event={event} data={biz} />}
        {businessOn && biz.org && <MoreFromOrg org={biz.org} currentEventId={event.id} />}
        {askSheet && (
          <RegistrationSheet eventId={event.id} eventTitle={event.title} questions={questions} mode={askSheet.mode} items={askSheet.items}
            onClose={() => { askSheet.resolve(false); setAskSheet(null); }}
            onDone={() => { askSheet.resolve(true); setAskSheet(null); }} />
        )}
        <EventProgram eventId={event.id} />

        {!videoHeadersOn && <CommunityPosts eventId={event.id} />}

        {/* Logistics: everything about actually getting there. */}
        {!event.is_online && (
          <div className="mt-10">
            <h2 className="font-display text-xl font-bold text-gray-900">Location</h2>
            <p className="mt-2 font-medium text-gray-900">{event.location_name || 'Venue TBD'}</p>
            {event.location_address && <p className="select-text text-sm text-gray-500">{event.location_address}</p>}
            {(event.location_address || event.location_name) && (
              <CopyAddress
                address={[event.location_name, event.location_address].filter(Boolean).join(', ')}
                mapLink={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.latitude && event.longitude ? `${event.latitude},${event.longitude}` : (event.location_address || event.location_name || ''))}`}
              />
            )}

            {(() => {
              const mapQuery = event.latitude && event.longitude
                ? `${event.latitude},${event.longitude}`
                : event.location_address || event.location_name;
              if (!mapQuery) return null;
              const encoded = encodeURIComponent(mapQuery);
              return (
                <div className="mt-3">
                  <div className="overflow-hidden rounded-2xl border border-gray-200">
                    <iframe
                      title="Event location map"
                      src={`https://maps.google.com/maps?q=${encoded}&z=15&output=embed`}
                      className="h-64 w-full"
                      loading="lazy"
                    />
                  </div>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <a
                      href={isIOS() ? `https://maps.apple.com/?daddr=${encoded}` : `https://www.google.com/maps/dir/?api=1&destination=${encoded}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-center text-sm font-medium text-gray-700 hover:border-marigold hover:text-marigold"
                    >
                      Get Directions
                    </a>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encoded}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 rounded-lg px-4 py-2 text-center text-sm font-medium text-marigold hover:underline"
                    >
                      View on Google Maps ↗
                    </a>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        <ShopSection ownerType="event" ownerId={event.id} />

        {event.vendor_applications_enabled && (
          <div className="mt-10">
            <h2 className="font-display text-xl font-bold text-gray-900">Become a Vendor</h2>
            <div className="mt-3">
              <VendorApplicationForm
                eventId={event.id}
                feeTiers={event.vendor_fees ?? []}
                groups={event.vendors ?? []}
              />
            </div>
          </div>
        )}

        {/* Extras: lower on the page since they support the event rather than define it. */}
        {event.sponsors && event.sponsors.some((t) => t.sponsors?.length > 0) && (
          <div className="mt-10">
            <h2 className="font-display text-xl font-bold text-gray-900">Sponsors</h2>
            <div className="mt-3 flex flex-col gap-3">
              {event.sponsors
                .filter((t) => t.sponsors?.length > 0)
                .map((tier) => (
                  <div key={tier.tier_name} className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">{tier.tier_name}</span>
                    {tier.sponsors.map((s) => (
                      s.website ? (
                        <a key={s.name} href={s.website} target="_blank" rel="noopener noreferrer" className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-marigold hover:text-marigold">
                          {s.name}
                        </a>
                      ) : (
                        <span key={s.name} className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700">{s.name}</span>
                      )
                    ))}
                  </div>
                ))}
            </div>
          </div>
        )}

        {visibleLinks(event.social_links).length > 0 && (
          <div className="mt-10">
            <EventLinks links={event.social_links} subtitle="Updates, photos, and more from the organizer." />
          </div>
        )}

      </div>
    </div>
  );
}
