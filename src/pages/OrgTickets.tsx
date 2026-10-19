import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useBrandedTab, useOrgWhiteLabel } from '../lib/whiteLabel';
import WhiteLabelHeader from '../components/events/WhiteLabelHeader';
import BrandedSignIn from '../components/BrandedSignIn';
import { ListSkeleton } from '../components/ui/Skeleton';

// "Your tickets" for one organization's events, in the organization's branding (white-label buyers never land
// on TapIN's general Activity page). Shows only the signed-in person's own tickets.
interface Row {
  id: string; quantity: number | null; status: string; guest_name: string | null; section_name: string | null; seat_assignment: string | null;
  events: { id: string; title: string; start_date: string | null; location_name: string | null; poster_url: string | null };
}

export default function OrgTickets() {
  const { slug } = useParams<{ slug: string }>();
  const { user, loading: authLoading } = useAuth();
  const { brand, orgId, eventId, ready } = useOrgWhiteLabel(slug);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  useBrandedTab(brand, 'Your tickets');

  useEffect(() => {
    if (!orgId || !user?.email) return;
    supabase.from('tickets')
      .select('id, quantity, status, guest_name, section_name, seat_assignment, events!inner(id, title, start_date, location_name, poster_url, organization_id)')
      .eq('events.organization_id', orgId)
      .ilike('attendee_email', user.email)
      .in('status', ['confirmed', 'used'])
      .then(({ data }) => setRows(((data ?? []) as unknown as Row[]).sort((a, b) => String(a.events.start_date).localeCompare(String(b.events.start_date)))));
  }, [orgId, user?.email]);

  const now = Date.now();
  const upcoming = (rows ?? []).filter((r) => !r.events.start_date || Date.parse(r.events.start_date) > now - 6 * 3600_000);
  const past = (rows ?? []).filter((r) => r.events.start_date && Date.parse(r.events.start_date) <= now - 6 * 3600_000).reverse();
  const byEvent = (list: Row[]) => {
    const m = new Map<string, Row[]>();
    list.forEach((r) => m.set(r.events.id, [...(m.get(r.events.id) ?? []), r]));
    return [...m.values()];
  };
  const accent = brand?.primary ?? '#0F1B3D';
  const day = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).replace(':00 ', ' ') : 'Date to be announced');

  const card = (group: Row[], dim = false) => {
    const e = group[0].events;
    return (
      <div key={e.id} className={`overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm ${dim ? 'opacity-70' : ''}`}>
        <div className="flex gap-3 p-4">
          {e.poster_url ? <img src={e.poster_url} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" /> : <div className="h-16 w-16 shrink-0 rounded-xl" style={{ background: accent }} />}
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 [overflow-wrap:anywhere]">{e.title}</p>
            <p className="text-sm text-gray-500">{day(e.start_date)}{e.location_name ? ` · ${e.location_name}` : ''}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-gray-100 px-4 py-3">
          {group.map((t, i) => (
            <Link key={t.id} to={`/pass/${t.id}`} className="rounded-full px-3 py-1.5 text-sm font-semibold text-white" style={{ background: accent }}>
              {t.guest_name ? t.guest_name : group.length > 1 ? `Ticket ${i + 1}` : 'View ticket'}{[t.section_name, t.seat_assignment].filter(Boolean).length ? ` · ${[t.section_name, t.seat_assignment].filter(Boolean).join(' ')}` : ''}
            </Link>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <div className="mx-auto max-w-md px-4 py-10">
        {brand && <WhiteLabelHeader brand={brand} />}
        <h1 className="mt-4 font-display text-2xl font-bold text-gray-900">Your tickets</h1>
        {!ready || authLoading ? (
          <ListSkeleton rows={2} className="mt-4" />
        ) : !orgId ? (
          <p className="mt-4 text-sm text-gray-600">This page isn't available.</p>
        ) : !user ? (
          <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 text-center">
            <p className="text-sm text-gray-600">Sign in with the email you used to get your tickets.</p>
            {brand
              ? <button onClick={() => setSigningIn(true)} className="mt-3 rounded-xl px-5 py-2.5 text-sm font-semibold text-white" style={{ background: accent }}>Sign in</button>
              : <Link to="/login" state={{ from: `/tickets/${slug}` }} className="mt-3 inline-block rounded-xl px-5 py-2.5 text-sm font-semibold text-white" style={{ background: accent }}>Sign in</Link>}
          </div>
        ) : rows === null ? (
          <ListSkeleton rows={2} className="mt-4" />
        ) : rows.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-white/60 p-6 text-center text-sm text-gray-500">No tickets for {brand?.name ?? 'this organization'}'s events with {user.email}.</p>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {byEvent(upcoming).map((g) => card(g))}
            {past.length > 0 && <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-500">Past</p>}
            {byEvent(past).map((g) => card(g, true))}
          </div>
        )}
      </div>
      {signingIn && brand && <BrandedSignIn brand={brand} eventId={eventId} onClose={() => setSigningIn(false)} onDone={() => setSigningIn(false)} />}
    </div>
  );
}
