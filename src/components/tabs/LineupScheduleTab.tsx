import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import ImageUpload from '../ImageUpload';
import { ConfirmDialog } from '../admin/shared';
import LineupInvite, { type PendingInvite } from './LineupInvite';
import {
  KIND_LABELS, KIND_STYLES, fromInputs, groupByDay, initials, timeRange, toDateInput, toTimeInput,
  type LineupEntry, type ScheduleItem, type ScheduleKind,
} from '../../lib/program';
import type { TapEvent } from '../../lib/types';

interface LineupRow { id: string; booking_id: string | null; name: string | null; image_url: string | null; link_url: string | null; role: string | null; bio: string | null; sort_order: number }
interface BookingOption { id: string; resource_name: string; resource_image: string | null }

const input = 'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900';
const btn = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:border-marigold hover:text-marigold disabled:opacity-50';
const primary = 'rounded-lg bg-marigold px-4 py-2.5 text-sm font-semibold text-white hover:bg-marigold/90 disabled:opacity-50';

function Avatar({ name, url }: { name: string; url: string | null }) {
  return url
    ? <img src={url} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
    : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-marigold to-teal font-bold text-white">{initials(name)}</span>;
}

function validUrl(v: string): string | null {
  const s = v.trim();
  if (!s) return null;
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try { return new URL(withScheme).toString(); } catch { return null; }
}

// ---------- Lineup person editor (manual entries get name/photo/link; booked ones just role & bio) ----------
function PersonForm({ initial, booked, onSave, onCancel }: {
  initial: Partial<LineupRow>; booked: boolean;
  onSave: (v: Partial<LineupRow>) => Promise<string | null>; onCancel: () => void;
}) {
  const [name, setName] = useState(initial.name ?? '');
  const [role, setRole] = useState(initial.role ?? '');
  const [bio, setBio] = useState(initial.bio ?? '');
  const [link, setLink] = useState(initial.link_url ?? '');
  const [image, setImage] = useState<string | null>(initial.image_url ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!booked && !name.trim()) return setError('Add a name.');
    const url = link.trim() ? validUrl(link) : null;
    if (link.trim() && !url) return setError("That link doesn't look right.");
    setBusy(true);
    const err = await onSave(booked
      ? { role: role.trim() || null, bio: bio.trim() || null }
      : { name: name.trim(), role: role.trim() || null, bio: bio.trim() || null, link_url: url, image_url: image });
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-xl border border-marigold/40 bg-marigold/5 p-3">
      {!booked && (
        <>
          <label className="text-sm font-medium text-gray-700">Name<input className={input} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="Performer, speaker, or group" /></label>
          <ImageUpload currentUrl={image} onUploaded={setImage} pathPrefix="lineup" label="Photo (optional)" />
        </>
      )}
      <label className="text-sm font-medium text-gray-700">Role <span className="font-normal text-gray-400">(optional)</span>
        <input className={input} value={role} maxLength={80} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Headliner, Keynote speaker, Live painting" />
      </label>
      <label className="text-sm font-medium text-gray-700">Short description <span className="font-normal text-gray-400">(optional)</span>
        <textarea className={input} rows={2} value={bio} maxLength={600} onChange={(e) => setBio(e.target.value)} placeholder="What they'll be doing at your event" />
      </label>
      {!booked && (
        <label className="text-sm font-medium text-gray-700">Link <span className="font-normal text-gray-400">(optional: website or social)</span>
          <input className={input} value={link} onChange={(e) => setLink(e.target.value)} placeholder="instagram.com/theirname" inputMode="url" />
        </label>
      )}
      {error && <p role="alert" className="text-sm text-magenta">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={primary}>{busy ? 'Saving…' : 'Save'}</button>
        <button type="button" onClick={onCancel} className={btn}>Cancel</button>
      </div>
    </form>
  );
}

// ---------- Schedule item editor ----------
function ItemForm({ initial, defaultDate, lineup, onSave, onCancel }: {
  initial: Partial<ScheduleItem>; defaultDate: string; lineup: LineupEntry[];
  onSave: (v: Omit<ScheduleItem, 'id'>) => Promise<string | null>; onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial.title ?? '');
  const [kind, setKind] = useState<ScheduleKind>(initial.kind ?? 'performance');
  const [date, setDate] = useState(initial.starts_at ? toDateInput(initial.starts_at) : defaultDate);
  const [start, setStart] = useState(initial.starts_at ? toTimeInput(initial.starts_at) : '');
  const [end, setEnd] = useState(initial.ends_at ? toTimeInput(initial.ends_at) : '');
  const [area, setArea] = useState(initial.area ?? '');
  const [description, setDescription] = useState(initial.description ?? '');
  const [people, setPeople] = useState<string[]>(initial.lineup_ids ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError('Add a title.');
    const startsAt = fromInputs(date, start);
    if (!startsAt) return setError('Choose a date and start time.');
    let endsAt = end ? fromInputs(date, end) : null;
    // An end time earlier than the start (e.g. 11 PM – 1 AM) runs past midnight.
    if (endsAt && endsAt < startsAt) endsAt = new Date(new Date(endsAt).getTime() + 24 * 3600 * 1000).toISOString();
    setBusy(true);
    const err = await onSave({ title: title.trim(), kind, starts_at: startsAt, ends_at: endsAt, area: area.trim() || null, description: description.trim() || null, lineup_ids: people });
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-xl border border-marigold/40 bg-marigold/5 p-3">
      <label className="text-sm font-medium text-gray-700">What's happening<input className={input} value={title} maxLength={140} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Opening DJ set, Welcome remarks, Lunch" /></label>
      <label className="text-sm font-medium text-gray-700">Type
        <select className={input} value={kind} onChange={(e) => setKind(e.target.value as ScheduleKind)}>
          {(Object.keys(KIND_LABELS) as ScheduleKind[]).map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
        </select>
      </label>
      {/* Phone: date on its own row, start and end side by side. Wider screens: all three in a row. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className="col-span-2 min-w-0 text-sm font-medium text-gray-700 sm:col-span-1">Date<input type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="min-w-0 text-sm font-medium text-gray-700">Starts
          <input type="time" className={input} value={start} onChange={(e) => setStart(e.target.value)} aria-describedby="start-hint" />
          {!start && <span id="start-hint" className="mt-0.5 block text-xs font-normal text-gray-400">Tap to choose</span>}
        </label>
        <label className="min-w-0 text-sm font-medium text-gray-700">Ends <span className="font-normal text-gray-400">(optional)</span>
          <input type="time" className={input} value={end} onChange={(e) => setEnd(e.target.value)} />
          {end && <button type="button" onClick={() => setEnd('')} className="mt-0.5 block text-xs font-normal text-marigold hover:underline">Clear end time</button>}
        </label>
      </div>
      <label className="text-sm font-medium text-gray-700">Where <span className="font-normal text-gray-400">(optional)</span><input className={input} value={area} maxLength={80} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Main stage, Room B, Courtyard" /></label>
      <label className="text-sm font-medium text-gray-700">Details <span className="font-normal text-gray-400">(optional)</span><textarea className={input} rows={2} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
      {lineup.length > 0 && (
        <fieldset>
          <legend className="text-sm font-medium text-gray-700">Who's involved <span className="font-normal text-gray-400">(optional)</span></legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {lineup.map((p) => {
              const on = people.includes(p.id);
              return (
                <button type="button" key={p.id} aria-pressed={on}
                  onClick={() => setPeople((prev) => (on ? prev.filter((x) => x !== p.id) : [...prev, p.id]))}
                  className={`rounded-full border px-3 py-1.5 text-sm ${on ? 'border-marigold bg-marigold text-white' : 'border-gray-300 bg-white text-gray-700'}`}>
                  {on ? '✓ ' : ''}{p.name}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
      {error && <p role="alert" className="text-sm text-magenta">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={primary}>{busy ? 'Saving…' : 'Save'}</button>
        <button type="button" onClick={onCancel} className={btn}>Cancel</button>
      </div>
    </form>
  );
}

export default function LineupScheduleTab({ event, isOwner }: { event: TapEvent; isOwner: boolean }) {
  const [rows, setRows] = useState<LineupRow[]>([]);
  const [display, setDisplay] = useState<Map<string, LineupEntry>>(new Map());
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [bookings, setBookings] = useState<BookingOption[]>([]);
  const { user } = useAuth();
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [takenResources, setTakenResources] = useState<Set<string>>(new Set());
  const [inviting, setInviting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingPerson, setEditingPerson] = useState<string | 'new' | null>(null);
  const [editingItem, setEditingItem] = useState<string | 'new' | null>(null);
  const [removePerson, setRemovePerson] = useState<LineupRow | null>(null);
  const [removeItem, setRemoveItem] = useState<ScheduleItem | null>(null);

  const load = useCallback(async () => {
    const [l, p, s] = await Promise.all([
      supabase.from('event_lineup').select('id, booking_id, name, image_url, link_url, role, bio, sort_order').eq('event_id', event.id).order('sort_order').order('created_at'),
      supabase.rpc('event_program', { p_event_id: event.id }),
      supabase.from('event_schedule_items').select('*').eq('event_id', event.id).order('starts_at'),
    ]);
    if (l.error || s.error) { setError("Couldn't load the lineup and schedule. Please refresh."); setLoading(false); return; }
    setRows((l.data ?? []) as LineupRow[]);
    setDisplay(new Map(((p.data?.lineup ?? []) as LineupEntry[]).map((x) => [x.id, x])));
    setItems((s.data ?? []) as ScheduleItem[]);
    if (isOwner) {
      const { data: all } = await supabase.from('resource_bookings').select('id, resource_id, show_on_event_page, status, kind, booking_details')
        .eq('event_id', event.id).in('status', ['pending', 'counter_offered', 'accepted', 'confirmed', 'completed']);
      setTakenResources(new Set((all ?? []).map((x) => x.resource_id)));
      const b = (all ?? []).filter((x) => ['accepted', 'confirmed', 'completed'].includes(x.status));
      const pend = (all ?? []).filter((x) => x.kind === 'lineup_invite' && x.status === 'pending');
      if (pend.length) {
        const { data: pr } = await supabase.from('resources').select('id, display_name, profile_image').in('id', pend.map((x) => x.resource_id));
        const pm = new Map((pr ?? []).map((r) => [r.id, r]));
        setInvites(pend.map((x) => ({ id: x.id, resource_id: x.resource_id, resource_name: pm.get(x.resource_id)?.display_name ?? 'Invited', resource_image: pm.get(x.resource_id)?.profile_image ?? null, role: (x.booking_details as { lineup_role?: string } | null)?.lineup_role ?? null })));
      } else setInvites([]);
      const unlisted = b.filter((x) => !x.show_on_event_page);
      if (unlisted.length) {
        const { data: res } = await supabase.from('resources').select('id, display_name, profile_image').in('id', unlisted.map((x) => x.resource_id));
        const byId = new Map((res ?? []).map((r) => [r.id, r]));
        setBookings(unlisted.map((x) => ({ id: x.id, resource_name: byId.get(x.resource_id)?.display_name ?? 'Booked resource', resource_image: byId.get(x.resource_id)?.profile_image ?? null })));
      } else setBookings([]);
    }
    setLoading(false);
  }, [event.id, isOwner]);

  useEffect(() => { load(); }, [load]);

  const lineup: LineupEntry[] = useMemo(() => rows.map((r) => display.get(r.id) ?? {
    id: r.id, role: r.role, bio: r.bio, resource_id: null, name: r.name ?? 'Booked resource', image_url: r.image_url, link_url: r.link_url, categories: null,
  }), [rows, display]);

  const defaultDate = toDateInput(items.length ? items[items.length - 1].starts_at : event.start_date ?? new Date().toISOString());

  async function addBooked(bookingId: string) {
    const { error: e } = await supabase.from('resource_bookings').update({ show_on_event_page: true }).eq('id', bookingId);
    if (e) return setError("Couldn't add them. Please try again.");
    await load();
  }

  async function savePerson(id: string | 'new', v: Partial<LineupRow>): Promise<string | null> {
    if (id === 'new') {
      const nextOrder = rows.length ? Math.max(...rows.map((r) => r.sort_order)) + 1 : 0;
      const { error: e } = await supabase.from('event_lineup').insert({ event_id: event.id, sort_order: nextOrder, ...v });
      if (e) return "Couldn't save. Please try again.";
    } else {
      const { error: e } = await supabase.from('event_lineup').update(v).eq('id', id);
      if (e) return "Couldn't save. Please try again.";
    }
    setEditingPerson(null);
    await load();
    return null;
  }

  async function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[index], next[j]] = [next[j], next[index]];
    setRows(next);
    await Promise.all(next.map((r, i) => (r.sort_order === i ? null : supabase.from('event_lineup').update({ sort_order: i }).eq('id', r.id))));
  }

  async function saveItem(id: string | 'new', v: Omit<ScheduleItem, 'id'>): Promise<string | null> {
    const { error: e } = id === 'new'
      ? await supabase.from('event_schedule_items').insert({ event_id: event.id, ...v })
      : await supabase.from('event_schedule_items').update(v).eq('id', id);
    if (e) return "Couldn't save. Please try again.";
    setEditingItem(null);
    await load();
    return null;
  }

  if (loading) return <p className="text-sm text-muted">Loading…</p>;
  const byId = new Map(lineup.map((p) => [p.id, p]));

  return (
    <div className="flex flex-col gap-8">
      <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
        Show attendees who's on the bill and what happens when. Both appear on your public event page{event.status === 'draft' ? ' once the event is published' : ''}.
      </p>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {/* ---------- Lineup ---------- */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold text-bone">Lineup</h2>
          {editingPerson === null && !inviting && (
            <div className="flex flex-wrap gap-2">
              {isOwner && <button onClick={() => setInviting(true)} className="rounded-lg bg-marigold px-3 py-2 text-sm font-semibold text-white hover:bg-marigold/90">+ Add from TapIN</button>}
              <button onClick={() => setEditingPerson('new')} className={btn}>+ Add someone</button>
            </div>
          )}
        </div>
        {inviting && user?.email && (
          <LineupInvite eventId={event.id} organizerEmail={user.email} existingResourceIds={takenResources}
            onClose={() => setInviting(false)} onSent={() => { setInviting(false); load(); }} />
        )}
        {invites.length > 0 && (
          <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="text-sm font-medium text-gray-700">Waiting for a reply</p>
            <p className="text-xs text-gray-500">Not shown on your event page until they accept.</p>
            <ul className="mt-2 flex flex-col gap-2">
              {invites.map((iv) => (
                <li key={iv.id} className="flex items-center gap-3 rounded-lg bg-white p-2">
                  {iv.resource_image ? <img src={iv.resource_image} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-200 text-sm font-bold text-gray-600">{iv.resource_name.charAt(0)}</span>}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-gray-900">{iv.resource_name}</span>
                    <span className="block truncate text-xs text-gray-500">{iv.role ? `${iv.role} · ` : ''}Invite pending</span>
                  </span>
                  <button className="text-xs font-medium text-gray-500 hover:text-red-600" onClick={async () => {
                    await supabase.from('resource_bookings').update({ status: 'cancelled', cancellation_reason: 'Lineup invite withdrawn' }).eq('id', iv.id);
                    load();
                  }}>Withdraw</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {editingPerson === 'new' && <div className="mt-3"><PersonForm initial={{}} booked={false} onSave={(v) => savePerson('new', v)} onCancel={() => setEditingPerson(null)} /></div>}

        {isOwner && bookings.length > 0 && (
          <div className="mt-3 rounded-xl border border-dashed border-gray-300 p-3">
            <p className="text-sm font-medium text-gray-700">From your bookings</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {bookings.map((b) => (
                <button key={b.id} onClick={() => addBooked(b.id)} className="flex items-center gap-2 rounded-full border border-gray-300 bg-white py-1 pl-1 pr-3 text-sm text-gray-700 hover:border-marigold">
                  {b.resource_image ? <img src={b.resource_image} alt="" className="h-7 w-7 rounded-full object-cover" /> : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-xs font-bold">{initials(b.resource_name)}</span>}
                  + {b.resource_name}
                </button>
              ))}
            </div>
          </div>
        )}

        {rows.length === 0 && editingPerson === null ? (
          <p className="mt-3 text-sm text-muted">No one yet. Add performers, speakers, or vendors{isOwner ? ", including resources you've booked" : ''}.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {rows.map((r, i) => {
              const p = lineup[i];
              if (editingPerson === r.id) {
                return <li key={r.id}><PersonForm initial={r} booked={!!r.booking_id} onSave={(v) => savePerson(r.id, v)} onCancel={() => setEditingPerson(null)} /></li>;
              }
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-3">
                  <Avatar name={p.name} url={p.image_url} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-900">{p.name}{r.booking_id && <span className="ml-2 rounded-full bg-teal/15 px-2 py-0.5 text-[11px] font-medium text-teal">Booked on TapIN</span>}</p>
                    <p className="truncate text-sm text-marigold">{r.role || <span className="text-gray-400">No role yet</span>}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${p.name} up`} className={btn}>↑</button>
                    <button onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label={`Move ${p.name} down`} className={btn}>↓</button>
                    <button onClick={() => setEditingPerson(r.id)} className={btn}>Edit</button>
                    <button onClick={() => setRemovePerson(r)} className={btn} aria-label={`Remove ${p.name}`}>Remove</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ---------- Schedule ---------- */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold text-bone">Schedule</h2>
          {editingItem === null && <button onClick={() => setEditingItem('new')} className={btn}>+ Add to schedule</button>}
        </div>
        {editingItem === 'new' && <div className="mt-3"><ItemForm initial={{}} defaultDate={defaultDate} lineup={lineup} onSave={(v) => saveItem('new', v)} onCancel={() => setEditingItem(null)} /></div>}

        {items.length === 0 && editingItem === null ? (
          <p className="mt-3 text-sm text-muted">Nothing scheduled yet. Add set times, sessions, breaks, or when vendors open. Multi-day events are grouped by day.</p>
        ) : (
          groupByDay(items).map((day) => (
            <div key={day.key} className="mt-4">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{day.label}</h3>
              <ul className="flex flex-col gap-2">
                {day.items.map((it) => (
                  editingItem === it.id
                    ? <li key={it.id}><ItemForm initial={it} defaultDate={defaultDate} lineup={lineup} onSave={(v) => saveItem(it.id, v)} onCancel={() => setEditingItem(null)} /></li>
                    : (
                      <li key={it.id} className="rounded-xl border border-gray-200 bg-white p-3">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-sm font-semibold text-gray-900">{timeRange(it.starts_at, it.ends_at)}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${KIND_STYLES[it.kind]}`}>{KIND_LABELS[it.kind]}</span>
                          {it.area && <span className="text-xs text-gray-500">📍 {it.area}</span>}
                        </div>
                        <p className="mt-1 font-medium text-gray-900">{it.title}</p>
                        {it.lineup_ids.length > 0 && <p className="text-xs text-gray-500">With {it.lineup_ids.map((id) => byId.get(id)?.name).filter(Boolean).join(', ')}</p>}
                        <div className="mt-2 flex gap-2">
                          <button onClick={() => setEditingItem(it.id)} className={btn}>Edit</button>
                          <button onClick={() => setRemoveItem(it)} className={btn}>Delete</button>
                        </div>
                      </li>
                    )
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      {removePerson && (
        <ConfirmDialog title={`Remove ${byId.get(removePerson.id)?.name ?? 'them'} from the lineup?`} confirmLabel="Remove" danger onClose={() => setRemovePerson(null)}
          body={removePerson.booking_id ? "They'll come off your event page and schedule. Their booking isn't affected." : "They'll come off your event page and schedule."}
          onConfirm={async () => { const { error: e } = await supabase.from('event_lineup').delete().eq('id', removePerson.id); if (e) setError("Couldn't remove them."); await load(); }} />
      )}
      {removeItem && (
        <ConfirmDialog title="Delete this from the schedule?" confirmLabel="Delete" danger onClose={() => setRemoveItem(null)}
          body={<>"{removeItem.title}" will be removed from your event page.</>}
          onConfirm={async () => { const { error: e } = await supabase.from('event_schedule_items').delete().eq('id', removeItem.id); if (e) setError("Couldn't delete it."); await load(); }} />
      )}
    </div>
  );
}
