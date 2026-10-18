import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { MoveEventToOrgSheet } from '../business/MoveEvents';
import { Link } from 'react-router-dom';
import type { TapEvent } from '../../lib/types';
import { useEscapeKey } from '../../lib/useEscapeKey';
import CancelEventDialog from './CancelEventDialog';
import DeleteEventDialog from './DeleteEventDialog';

// The ⋯ menu on an organizer's own event card. Events with no tickets,
// registrations, or payments can be deleted; events with any are cancelled
// instead so those records are kept (the database enforces this too).
export default function EventActions({
  event,
  seriesChildren,
  hasSales,
  onDeleted,
  onCancelled,
}: {
  event: TapEvent;
  seriesChildren: TapEvent[];
  hasSales: boolean | undefined;
  onDeleted: (ids: string[]) => void;
  onCancelled: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<'delete' | 'cancel' | null>(null);
  const [moving, setMoving] = useState(false);
  const { user } = useAuth();
  const ref = useRef<HTMLDivElement>(null);
  useEscapeKey(() => setOpen(false), open);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const isSeries = seriesChildren.length > 0;
  const cancelled = event.status === 'cancelled';



  return (
    <>
      <div ref={ref} className="absolute left-3 top-3 z-20">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={`Options for ${event.title}`}
          aria-expanded={open}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-lg font-bold leading-none text-white backdrop-blur-sm hover:bg-black/70"
        >
          ⋯
        </button>
        {open && (
          <div className="mt-1 w-48 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 text-sm shadow-lg">
            <Link to={`/organizer/events/${event.id}/edit`} className="block px-4 py-2.5 text-gray-800 hover:bg-gray-50">Edit event</Link>
            {!event.organization_id && event.organizer_id === user?.id && <button type="button" onClick={() => { setOpen(false); setMoving(true); }} className="block w-full px-4 py-2.5 text-left text-gray-800 hover:bg-gray-50">Move to organization…</button>}
            {event.organization_id && (event.event_kind ?? 'community') === 'community' && <button type="button" onClick={async () => { setOpen(false); if (!window.confirm('Remove this event from its organization? It will be hosted under your name, and future ticket money goes to your own payout account.')) return; const { error } = await supabase.rpc('remove_event_from_org', { p_event_id: event.id }); if (error) window.alert(error.message && !/function|permission/i.test(error.message) ? error.message : "Couldn't remove it."); else window.location.reload(); }} className="block w-full px-4 py-2.5 text-left text-gray-800 hover:bg-gray-50">Remove from organization</button>}
            <Link to={`/events/${event.id}`} className="block px-4 py-2.5 text-gray-800 hover:bg-gray-50">
              {event.status === 'draft' ? 'Preview' : 'View live page'}
            </Link>
            {hasSales === undefined ? (
              <p className="px-4 py-2.5 text-gray-400">Checking…</p>
            ) : hasSales ? (
              !cancelled && (
                <button type="button" onClick={() => { setOpen(false); setConfirm('cancel'); }} className="block w-full px-4 py-2.5 text-left text-magenta hover:bg-red-50">
                  Cancel event
                </button>
              )
            ) : (
              <button type="button" onClick={() => { setOpen(false); setConfirm('delete'); }} className="block w-full px-4 py-2.5 text-left text-magenta hover:bg-red-50">
                {isSeries ? 'Delete series' : 'Delete event'}
              </button>
            )}
          </div>
        )}
      </div>

      {confirm === 'cancel' && (
        <CancelEventDialog eventId={event.id} eventTitle={event.title} onClose={() => setConfirm(null)} onCancelled={() => onCancelled(event.id)} />
      )}

      {confirm === 'delete' && (
        <DeleteEventDialog event={event} seriesChildren={seriesChildren} onClose={() => setConfirm(null)} onDeleted={(ids) => { setConfirm(null); onDeleted(ids); }} />
      )}

      {moving && <MoveEventToOrgSheet eventId={event.id} eventTitle={event.title} onClose={() => setMoving(false)} onDone={(name) => { setMoving(false); window.alert(`Moved to ${name}.`); window.location.reload(); }} />}
    </>
  );
}
