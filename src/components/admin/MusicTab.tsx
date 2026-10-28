import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { toast, toastError } from '../../lib/toast';
import Sheet from '../scouting/Sheet';
import MusicUsage from './MusicUsage';

// Admin → Music: every song on TapIN (search, listen), remove a song with a reason (the file is deleted from storage,
// the artist is told, and it's logged), the takedown log, and repeat copyright removals.
interface Track { id: string; title: string; url: string | null; size_bytes: number; duration_sec: number | null; plays: number; created_at: string; artist: string; resource_id: string; artist_email: string; uploaded_by: string }
interface Takedown { id: string; track_title: string; artist_email: string; reason: string; requested_by: string | null; notes: string | null; admin_email: string; created_at: string }
interface Data { tracks: Track[]; takedowns: Takedown[]; repeat: { artist_email: string; count: number }[] }
const REASONS = [
  { key: 'copyright', label: 'Copyright notice (DMCA)' },
  { key: 'inappropriate', label: 'Against TapIN\u2019s content rules' },
  { key: 'other', label: 'Other' },
];
const when = (s: string) => new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export default function MusicTab() {
  const [q, setQ] = useState('');
  const [d, setD] = useState<Data | null>(null);
  const [removing, setRemoving] = useState<Track | null>(null);
  const [reason, setReason] = useState('copyright');
  const [requestedBy, setRequestedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { supabase.rpc('admin_music_list', { p_q: q || null }).then(({ data }) => setD((data ?? null) as Data | null)); }, [q]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  async function remove() {
    if (!removing) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('music-upload', { body: { action: 'delete', track_id: removing.id, reason, requested_by: requestedBy.trim() || null, notes: notes.trim() || null } });
    setBusy(false);
    if (error || (data as { error?: string } | null)?.error) return toastError((data as { error?: string } | null)?.error ?? 'Couldn\u2019t remove it.');
    toast(`Removed \u201c${removing.title}\u201d and notified the artist`);
    setRemoving(null); setRequestedBy(''); setNotes(''); load();
  }

  return (
    <div className="flex flex-col gap-4">
      <MusicUsage />
      <section className="rounded-2xl border border-gray-200 bg-surface p-4">
        <h3 className="font-display text-lg font-semibold text-bone">🎵 Songs on TapIN</h3>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by song, artist, or email" className="mt-2 min-h-[44px] w-full rounded-xl border border-gray-300 bg-white px-3 text-base text-gray-900 sm:text-sm" />
        {d && d.tracks.length === 0 && <p className="mt-3 text-sm text-muted">No songs{q ? ' match' : ' yet'}.</p>}
        <ul className="mt-3 flex flex-col gap-2">
          {(d?.tracks ?? []).map((t) => (
            <li key={t.id} className="rounded-xl border border-gray-200 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-gray-900">{t.title}</span>
                  <span className="block truncate text-xs text-gray-500">{t.artist} · {t.artist_email}</span>
                  <span className="block text-xs text-gray-500">Uploaded {when(t.created_at)} · {(t.size_bytes / 1024 / 1024).toFixed(1)} MB · {t.plays} play{t.plays === 1 ? '' : 's'}</span>
                </span>
                <button onClick={() => { setRemoving(t); setReason('copyright'); }} className="shrink-0 rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50">Remove</button>
              </div>
              {t.url && <audio controls preload="none" src={t.url} className="mt-2 w-full" />}
            </li>
          ))}
        </ul>
      </section>
      {d && d.repeat.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="font-display text-lg font-semibold text-amber-900">⚠️ Repeat copyright removals</h3>
          <ul className="mt-2 text-sm text-amber-900">{d.repeat.map((r) => <li key={r.artist_email}>{r.artist_email}: {r.count} copyright removals</li>)}</ul>
          <p className="mt-2 text-xs text-amber-800">Your Copyright policy says repeat infringers may have their accounts restricted. Review these in Users.</p>
        </section>
      )}
      <section className="rounded-2xl border border-gray-200 bg-surface p-4">
        <h3 className="font-display text-lg font-semibold text-bone">🗂️ Takedown log</h3>
        {d && d.takedowns.length === 0 && <p className="mt-1 text-sm text-muted">No songs have been removed by TapIN.</p>}
        <ul className="mt-2 flex flex-col gap-2">
          {(d?.takedowns ?? []).map((k) => (
            <li key={k.id} className="rounded-xl border border-gray-200 bg-white p-3 text-sm">
              <p className="font-semibold text-gray-900">&ldquo;{k.track_title}&rdquo; <span className="font-normal text-gray-500">· {k.artist_email}</span></p>
              <p className="text-xs text-gray-600">{when(k.created_at)} · {REASONS.find((r) => r.key === k.reason)?.label ?? k.reason}{k.requested_by ? ` · requested by ${k.requested_by}` : ''} · removed by {k.admin_email}</p>
              {k.notes && <p className="mt-1 text-xs text-gray-700">{k.notes}</p>}
            </li>
          ))}
        </ul>
      </section>
      {removing && (
        <Sheet title={`Remove \u201c${removing.title}\u201d`} onClose={() => setRemoving(null)}>
          <p className="text-sm text-gray-600">The file is deleted from storage, the song disappears from {removing.artist}&apos;s profile, and {removing.artist} is notified with the reason. This is logged.</p>
          <label className="mt-3 block text-sm font-medium text-gray-900">Reason
            <select value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 block min-h-[44px] w-full rounded-xl border border-gray-300 bg-white px-3 text-base text-gray-900 sm:text-sm">
              {REASONS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </label>
          {reason === 'copyright' && (
            <label className="mt-3 block text-sm font-medium text-gray-900">Who sent the notice (name or email)
              <input value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} className="mt-1 block min-h-[44px] w-full rounded-xl border border-gray-300 bg-white px-3 text-base text-gray-900 sm:text-sm" />
            </label>
          )}
          <label className="mt-3 block text-sm font-medium text-gray-900">Note to the artist (optional)
            <textarea value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 1000))} rows={3} className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 sm:text-sm" />
          </label>
          <button onClick={remove} disabled={busy} className="mt-4 min-h-[48px] w-full rounded-full bg-red-600 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Removing…' : 'Remove song and notify the artist'}</button>
        </Sheet>
      )}
    </div>
  );
}
