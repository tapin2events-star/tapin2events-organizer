import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import Sheet from './Sheet';
import { STAGES, type Card, type CardResource, type Show, type Stage } from '../../lib/scouting';

// One artist on the board: where they stand, your notes, and the next step.
export default function CardSheet({ card, resource, shows, addedByName, onClose, onChanged }: {
  card: Card; resource: CardResource | null; shows: Show[]; addedByName: string | null; onClose: () => void; onChanged: () => void;
}) {
  const { user } = useAuth();
  const [notes, setNotes] = useState(card.notes ?? '');
  const [rating, setRating] = useState<number | null>(card.rating);
  const [tags, setTags] = useState(card.tags.join(', '));
  const [stage, setStage] = useState<Stage>(card.stage);
  const [showId, setShowId] = useState(card.show_id ?? '');
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [booking, setBooking] = useState<{ status: string; kind: string | null } | null>(null);

  useEffect(() => {
    if (!card.booking_id) { setBooking(null); return; }
    supabase.from('resource_bookings').select('status, kind').eq('id', card.booking_id).maybeSingle().then(({ data }) => setBooking(data ?? null));
  }, [card.booking_id]);

  const name = resource?.display_name ?? card.outside_name ?? 'Artist';
  const show = shows.find((s) => s.id === showId) ?? null;

  async function save(close = true) {
    setBusy(true); setMsg(null);
    const { error } = await supabase.from('scout_cards').update({
      notes: notes.trim().slice(0, 3000) || null, rating, stage, show_id: showId || null,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 12),
    }).eq('id', card.id);
    setBusy(false);
    if (error) { setMsg({ ok: false, text: "Couldn't save. Please try again." }); return false; }
    onChanged();
    if (close) onClose();
    return true;
  }

  async function sendInvite() {
    if (!resource || !show?.event_id || !user?.email) return;
    if (!(await save(false))) return;
    setBusy(true); setMsg(null);
    const { error } = await supabase.from('resource_bookings').insert({
      resource_id: resource.id, resource_email: 'set-by-server', organizer_email: user.email, event_id: show.event_id, offered_rate: 0, kind: 'lineup_invite', booking_details: {},
    });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: /already have an open booking/i.test(error.message) ? `${name} already has an open booking or invite for that event.` : 'Only the event\u2019s organizer can send invites for it.' });
    setStage('in_talks');
    setMsg({ ok: true, text: `Lineup invite sent. This moves to Confirmed when ${name} accepts.` });
    onChanged();
  }

  async function remove() {
    await supabase.from('scout_cards').delete().eq('id', card.id);
    onChanged(); onClose();
  }

  const field = 'mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900';
  return (
    <Sheet title={name} onClose={onClose} wide>
      <div className="-mt-2 flex items-center gap-3">
        {resource?.profile_image ? <img src={resource.profile_image} alt="" className="h-12 w-12 rounded-full object-cover" /> : <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-marigold to-teal text-lg font-bold text-white">{name.charAt(0).toUpperCase()}</span>}
        <div className="min-w-0 text-sm">
          <p className="truncate text-gray-600">{resource ? (resource.categories ?? []).slice(0, 3).join(' · ') || 'On TapIN' : 'Not on TapIN yet'}</p>
          <p className="flex flex-wrap gap-3">
            {resource && <Link to={`/resources/${resource.id}`} className="font-medium text-marigold">View profile</Link>}
            {card.outside_link && <a href={card.outside_link} target="_blank" rel="noopener noreferrer" className="font-medium text-marigold">Open link ↗</a>}
          </p>
        </div>
      </div>

      <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-gray-400">Where they stand</p>
      <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Stage">
        {STAGES.map((s) => (
          <button key={s.key} type="button" role="radio" aria-checked={stage === s.key} onClick={() => setStage(s.key)}
            className={`rounded-full px-3.5 py-2 text-sm font-medium transition ${stage === s.key ? 'bg-marigold text-white shadow-sm' : 'border border-gray-200 bg-white text-gray-600'}`}>
            {s.label}
          </button>
        ))}
      </div>
      {booking && <p className="mt-2 text-xs text-amber-700">{booking.kind === 'lineup_invite' ? 'Lineup invite' : 'Booking'} {booking.status === 'pending' ? 'waiting for their reply' : booking.status.replace('_', ' ')}.</p>}

      <div className="mt-5 grid grid-cols-2 gap-3">
        <label className="text-xs font-medium text-gray-500">Show
          <select value={showId} onChange={(e) => setShowId(e.target.value)} className={field}>
            <option value="">Not decided</option>
            {shows.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <div className="text-xs font-medium text-gray-500">Rating
          <div className="mt-1 flex h-[46px] items-center gap-0.5" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => setRating(rating === n ? null : n)}
                className={`px-0.5 text-[26px] leading-none ${rating && n <= rating ? 'text-amber-400' : 'text-gray-300'}`}>★</button>
            ))}
          </div>
        </div>
      </div>

      <label className="mt-4 block text-xs font-medium text-gray-500">Notes
        <textarea className={field} rows={3} maxLength={3000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Where you saw them, their style, contact info, availability…" />
      </label>
      <label className="mt-3 block text-xs font-medium text-gray-500">Tags
        <input className={field} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="headliner, first-timer (separate with commas)" />
      </label>
      {addedByName && <p className="mt-2 text-xs text-gray-400">Added by {addedByName}</p>}

      {resource && stage !== 'confirmed' && stage !== 'passed' && (
        <div className="mt-5 rounded-2xl bg-gray-50 p-4">
          <p className="text-sm font-semibold text-gray-900">Ready to bring them in?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {show?.event_id && <button type="button" onClick={sendInvite} disabled={busy} className="rounded-xl bg-marigold px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Send free lineup invite</button>}
            <Link to={`/resources/${resource.id}#book`} className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700">Send a paid booking</Link>
          </div>
          {!show?.event_id && <p className="mt-2 text-xs text-gray-500">To send a free lineup invite from here, pick a show that's linked to one of your events.</p>}
        </div>
      )}

      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`mt-4 rounded-xl px-3 py-2 text-sm ${msg.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{msg.text}</p>}

      <div className="mt-5 flex items-center justify-between gap-2">
        {confirmRemove ? (
          <span className="flex items-center gap-2 text-sm">
            <button type="button" onClick={remove} className="font-semibold text-red-600">Yes, remove</button>
            <button type="button" onClick={() => setConfirmRemove(false)} className="text-gray-500">Keep</button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirmRemove(true)} className="text-sm text-gray-400 hover:text-red-600">Remove</button>
        )}
        <button type="button" onClick={() => save(true)} disabled={busy} className="rounded-xl bg-marigold px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Save</button>
      </div>
    </Sheet>
  );
}
