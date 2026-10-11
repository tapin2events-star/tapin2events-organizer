import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { STAGES, type Card, type CardResource, type Show, type Stage } from '../../lib/scouting';

// Card details: notes, rating, tags, stage, show, and the booking/invite actions.
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
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [booking, setBooking] = useState<{ status: string; kind: string | null } | null>(null);
  const [role, setRole] = useState('');

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
      resource_id: resource.id, resource_email: 'set-by-server', organizer_email: user.email, event_id: show.event_id,
      offered_rate: 0, kind: 'lineup_invite', booking_details: role.trim() ? { lineup_role: role.trim().slice(0, 80) } : {},
    });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: /already have an open booking/i.test(error.message) ? `${name} already has an open booking or invite for that event.` : /available|organizer|policy|permission/i.test(error.message) ? 'Only the event\u2019s organizer can send invites for it.' : "Couldn't send the invite. Please try again." });
    setMsg({ ok: true, text: `Lineup invite sent. The card moves to Confirmed when ${name} accepts.` });
    onChanged();
  }

  async function remove() {
    if (!window.confirm(`Remove ${name} from this board?`)) return;
    await supabase.from('scout_cards').delete().eq('id', card.id);
    onChanged(); onClose();
  }

  const input = 'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900';
  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:rounded-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={name}>
        <div className="flex items-center gap-3">
          {resource?.profile_image ? <img src={resource.profile_image} alt="" className="h-14 w-14 rounded-full object-cover" /> : <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-marigold to-teal text-xl font-bold text-white">{name.charAt(0).toUpperCase()}</span>}
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg font-bold text-gray-900">{name}</p>
            <p className="truncate text-xs text-gray-500">
              {resource ? (resource.categories ?? []).slice(0, 3).join(' · ') || (resource.kind === 'group' ? 'Group' : 'On TapIN') : 'Not on TapIN yet'}
              {addedByName ? ` · added by ${addedByName}` : ''}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100">✕</button>
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-sm">
          {resource && <Link to={`/resources/${resource.id}`} className="font-medium text-marigold hover:underline">View profile ↗</Link>}
          {card.outside_link && <a href={card.outside_link} target="_blank" rel="noopener noreferrer" className="font-medium text-marigold hover:underline">Open link ↗</a>}
          {booking && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">{booking.kind === 'lineup_invite' ? 'Lineup invite' : 'Booking'}: {booking.status.replace('_', ' ')}</span>}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="text-xs font-medium text-gray-600">Stage
            <select value={stage} onChange={(e) => setStage(e.target.value as Stage)} className={input}>
              {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-gray-600">Show
            <select value={showId} onChange={(e) => setShowId(e.target.value)} className={input}>
              <option value="">No show yet</option>
              {shows.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-3">
          <span className="text-xs font-medium text-gray-600">Your rating</span>
          <div className="mt-1 flex gap-1" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => setRating(rating === n ? null : n)}
                className={`text-2xl leading-none ${rating && n <= rating ? 'text-amber-400' : 'text-gray-300'}`}>★</button>
            ))}
          </div>
        </div>
        <label className="mt-3 block text-xs font-medium text-gray-600">Tags <span className="font-normal text-gray-400">(comma separated)</span>
          <input className={input} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="headliner, first-timer, love theme" />
        </label>
        <label className="mt-3 block text-xs font-medium text-gray-600">Notes <span className="font-normal text-gray-400">(only your planners see these)</span>
          <textarea className={input} rows={4} maxLength={3000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Where you saw them, their style, contact details, availability…" />
        </label>

        {resource && stage !== 'confirmed' && (
          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="text-sm font-medium text-gray-900">Bring them in</p>
            {show?.event_id ? (
              <div className="mt-2 flex flex-col gap-2">
                <input className={input} value={role} maxLength={80} onChange={(e) => setRole(e.target.value)} placeholder="Role on the lineup (optional), e.g. Featured poet" />
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={sendInvite} disabled={busy} className="rounded-lg bg-marigold px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Send free lineup invite</button>
                  <Link to={`/resources/${resource.id}#book`} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700">Send a paid booking</Link>
                </div>
              </div>
            ) : (
              <p className="mt-1 text-xs text-gray-500">
                {show ? `Link "${show.name}" to one of your events (edit the show on the board) to send a lineup invite from here. ` : 'Pencil them in for a show that\u2019s linked to an event to send a lineup invite from here. '}
                Or <Link to={`/resources/${resource.id}#book`} className="font-medium text-marigold">send a paid booking</Link>.
              </p>
            )}
            <p className="mt-2 text-xs text-gray-400">When they accept a booking or invite from you, this card moves to Confirmed by itself.</p>
          </div>
        )}

        {msg && <p role={msg.ok ? 'status' : 'alert'} className={`mt-3 rounded-lg px-3 py-2 text-sm ${msg.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{msg.text}</p>}
        <div className="mt-4 flex items-center justify-between gap-2">
          <button type="button" onClick={remove} className="text-sm font-medium text-red-600">Remove from board</button>
          <button type="button" onClick={() => save(true)} disabled={busy} className="rounded-lg bg-marigold px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Save</button>
        </div>
      </div>
    </div>
  );
}
