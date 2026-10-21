import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

// "Add a person" box shared across an event's and organization's sections (lineup, promotion links, teams, featured
// people). As you type it suggests people you've already added anywhere in this event or organization (and, for
// organization events, its team, featured people and other events), plus people on TapIN, and you can still type an
// email. Suggestions are visible only to the event's or organization's organizers.
export interface KnownPerson { name: string; email: string | null; user_id: string | null; photo: string | null; sources?: string[]; in_event?: boolean }

export default function PeopleInput({ eventId, orgId, value, onChange, onPick, placeholder, className, includeTapIN = true, autoFocus = false, ariaLabel, accountsOnly = false, allowEmail }: {
  eventId?: string | null; orgId?: string | null; value: string; onChange: (text: string) => void; onPick: (p: KnownPerson) => void;
  placeholder?: string; className?: string; includeTapIN?: boolean; autoFocus?: boolean; ariaLabel?: string;
  /** Only suggest people with a TapIN account (for sections that need one, like volunteers). */
  accountsOnly?: boolean;
  /** Offer "Add <email>" when a full email is typed (default: on, except accounts-only boxes). */
  allowEmail?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [known, setKnown] = useState<KnownPerson[]>([]);
  const [tapin, setTapin] = useState<KnownPerson[]>([]);
  const blurTimer = useRef<number | null>(null);
  const q = value.trim();
  useEffect(() => {
    if (!open || (!eventId && !orgId)) { setKnown([]); return; }
    const t = setTimeout(() => {
      supabase.rpc('known_people', { p_event_id: eventId ?? null, p_org_id: orgId ?? null, p_query: q.includes('@') ? q : q }).then(({ data }) => setKnown((data ?? []) as KnownPerson[]));
    }, 180);
    return () => clearTimeout(t);
  }, [open, q, eventId, orgId]);
  useEffect(() => {
    if (!open || !includeTapIN || q.length < 2 || q.includes('@')) { setTapin([]); return; }
    const t = setTimeout(() => {
      supabase.rpc('search_people_for_splits', { p_query: q }).then(({ data }) => setTapin(((data ?? []) as { id: string; full_name: string; profile_photo: string | null }[])
        .map((r) => ({ name: r.full_name, email: null, user_id: r.id, photo: r.profile_photo })).slice(0, 5)));
    }, 250);
    return () => clearTimeout(t);
  }, [open, q, includeTapIN]);
  const knownShown = accountsOnly ? known.filter((k) => k.user_id) : known;
  const knownIds = new Set(knownShown.map((k) => k.user_id).filter(Boolean));
  const tapinOnly = tapin.filter((t) => !knownIds.has(t.user_id));
  const pick = (p: KnownPerson) => { onPick(p); setOpen(false); };
  const row = (p: KnownPerson, sub: string, key: string) => (
    <li key={key}>
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(p)} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50">
        {p.photo ? <img src={p.photo} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" /> : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600">{(p.name || p.email || '?').charAt(0).toUpperCase()}</span>}
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-gray-900">{p.name || p.email}</span>
          <span className="block truncate text-[11px] text-gray-500">{sub}</span>
        </span>
      </button>
    </li>
  );
  // A full email that isn't already one of the suggestions: offer to add it as a new person.
  const typedEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(q) ? q.toLowerCase() : null;
  const offerEmail = (allowEmail ?? !accountsOnly) && !!typedEmail && !knownShown.some((k) => k.email === typedEmail);
  const showList = open && (offerEmail || knownShown.length > 0 || tapinOnly.length > 0);
  return (
    <div className="relative min-w-0">
      <input value={value} onChange={(e) => { onChange(e.target.value); setOpen(true); }} placeholder={placeholder} aria-label={ariaLabel} autoFocus={autoFocus}
        autoCapitalize="none" autoCorrect="off" autoComplete="off" className={className}
        onFocus={() => { if (blurTimer.current) window.clearTimeout(blurTimer.current); setOpen(true); }}
        onBlur={() => { blurTimer.current = window.setTimeout(() => setOpen(false), 150); }} />
      {showList && (
        <ul className="absolute left-0 right-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
          {offerEmail && typedEmail && (
            <li>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick({ name: typedEmail, email: typedEmail, user_id: null, photo: null })} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-marigold/15 text-base text-marigold" aria-hidden="true">+</span>
                <span className="min-w-0"><span className="block truncate text-sm font-medium text-gray-900">Add {typedEmail}</span><span className="block text-[11px] text-gray-500">New person (not on TapIN yet)</span></span>
              </button>
            </li>
          )}
          {knownShown.length > 0 && <li className="px-3 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">Your people</li>}
          {knownShown.map((p, i) => row(p, [accountsOnly ? null : p.email, (p.sources ?? []).join(' · ')].filter(Boolean).join(' · ') || 'Added before', `k${i}`))}
          {tapinOnly.length > 0 && <li className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-gray-400">On TapIN</li>}
          {tapinOnly.map((p, i) => row(p, 'TapIN member', `t${i}`))}
        </ul>
      )}
    </div>
  );
}
