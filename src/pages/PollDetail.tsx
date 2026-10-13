import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import BackButton from '../components/BackButton';
import { meetingWhen } from '../lib/meetings';

interface Poll {
  id: string; title: string; duration_minutes: number; location: string | null; video_url: string | null; status: string; meeting_id: string | null;
  created_by: string; creator_name: string | null; event_title: string | null; org_name: string | null; can_manage: boolean;
  invitees: { email: string; full_name: string | null; photo: string | null; voted: boolean }[] | null;
  options: { id: string; starts_at: string; yes: string[]; maybe: string[] }[] | null;
}
type Answer = 'yes' | 'maybe' | 'no';

// "Find a time": tap the times that work, see who can make each, and (organizers) pick the winner.
export default function PollDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const me = (user?.email ?? '').toLowerCase();
  const [poll, setPoll] = useState<Poll | null | undefined>(undefined);
  const [mine, setMine] = useState<Record<string, Answer>>({});
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('poll_detail', { p_poll_id: id });
    const p = (data ?? null) as Poll | null;
    setPoll(p);
    if (p) {
      const m: Record<string, Answer> = {};
      (p.options ?? []).forEach((o) => { m[o.id] = o.yes.includes(me) ? 'yes' : o.maybe.includes(me) ? 'maybe' : 'no'; });
      setMine(m); setDirty(false);
    }
  }, [id, me]);
  useEffect(() => { load(); }, [load]);

  if (poll === undefined) return <div className="mx-auto max-w-3xl"><div className="h-40 animate-pulse rounded-2xl bg-gray-100" /></div>;
  if (poll === null) return <div className="mx-auto max-w-3xl"><BackButton fallback="/organizer/planning#meetings" fallbackLabel="Planning" /><p className="mt-4 text-muted">This poll doesn't exist or you're not part of it.</p></div>;

  const invitees = poll.invitees ?? [];
  const nameOf = (email: string) => invitees.find((i) => i.email.toLowerCase() === email)?.full_name?.split(' ')[0] || email.split('@')[0];
  const scored = (poll.options ?? []).map((o) => ({ ...o, score: o.yes.length * 2 + o.maybe.length }));
  const best = Math.max(0, ...scored.map((o) => o.score));
  const answered = invitees.filter((i) => i.voted).length;
  const open = poll.status === 'open';

  function cycle(optionId: string) {
    if (!open) return;
    setMine((m) => ({ ...m, [optionId]: m[optionId] === 'yes' ? 'maybe' : m[optionId] === 'maybe' ? 'no' : 'yes' }));
    setDirty(true);
  }
  async function saveVotes() {
    setBusy(true);
    const votes = Object.entries(mine).filter(([, a]) => a !== 'no').map(([option_id, answer]) => ({ option_id, answer }));
    const { error } = await supabase.rpc('vote_poll', { p_poll_id: poll!.id, p_votes: votes });
    setBusy(false);
    setMsg(error ? "Couldn't save your answers." : 'Thanks! Your answers are saved.');
    setTimeout(() => setMsg(null), 3000);
    load();
  }
  async function pick(optionId: string, startsAt: string) {
    if (!window.confirm(`Schedule "${poll!.title}" for ${meetingWhen(startsAt)}? Everyone in the poll will be invited.`)) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('schedule_from_poll', { p_poll_id: poll!.id, p_option_id: optionId });
    setBusy(false);
    if (error || !data) { setMsg(error?.message ?? "Couldn't schedule it."); return; }
    navigate(`/organizer/meetings/${data}`);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <BackButton fallback="/organizer/planning#meetings" fallbackLabel="Planning" />
      <div className="mt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">🗳️ Find a time{poll.org_name ? ` · ${poll.org_name}` : ''}{poll.event_title ? ` · ${poll.event_title}` : ''}</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold text-bone sm:text-3xl">{poll.title}</h1>
        <p className="mt-1 text-sm text-muted">About {poll.duration_minutes >= 60 ? `${poll.duration_minutes / 60} hour${poll.duration_minutes === 60 ? '' : 's'}` : `${poll.duration_minutes} minutes`}{poll.video_url ? ' · video call' : ''}{poll.location ? ` · ${poll.location}` : ''} · asked by {poll.creator_name || poll.created_by}</p>
        <p className="mt-1 text-sm text-muted">{answered} of {invitees.length} answered</p>
      </div>

      {!open && (
        <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          A time was picked. {poll.meeting_id && <button onClick={() => navigate(`/organizer/meetings/${poll.meeting_id}`)} className="font-semibold underline">Open the meeting</button>}
        </div>
      )}
      {open && <p className="mt-4 text-sm text-bone">Tap each time to answer: <span className="font-semibold text-green-700">Works</span> → <span className="font-semibold text-amber-700">If needed</span> → <span className="font-semibold text-gray-500">Can't</span></p>}

      <ul className="mt-3 flex flex-col gap-2">
        {scored.map((o) => {
          const a = mine[o.id] ?? 'no';
          const top = best > 0 && o.score === best;
          return (
            <li key={o.id} className={`rounded-2xl border p-3 ${top ? 'border-green-300 bg-green-50/60' : 'border-gray-200 bg-surface'}`}>
              <div className="flex items-center gap-3">
                <button onClick={() => cycle(o.id)} disabled={!open} aria-label={`${meetingWhen(o.starts_at)}: ${a === 'yes' ? 'works' : a === 'maybe' ? 'if needed' : "can't"}`}
                  className={`min-h-[44px] w-28 shrink-0 rounded-xl text-sm font-semibold disabled:opacity-70 ${a === 'yes' ? 'bg-green-600 text-white' : a === 'maybe' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  {a === 'yes' ? '✓ Works' : a === 'maybe' ? 'If needed' : "Can't"}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-bone">{meetingWhen(o.starts_at)}{top && <span className="ml-1.5 rounded-full bg-green-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">Best so far</span>}</p>
                  <p className="truncate text-xs text-muted">
                    {o.yes.length ? <span className="text-green-700">{o.yes.length} works ({o.yes.map(nameOf).join(', ')})</span> : <span>No one yet</span>}
                    {o.maybe.length ? <span className="text-amber-700"> · {o.maybe.length} if needed</span> : null}
                  </p>
                </div>
                {poll.can_manage && open && <button onClick={() => pick(o.id, o.starts_at)} disabled={busy} className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-semibold text-marigold hover:bg-marigold/10">Pick this</button>}
              </div>
            </li>
          );
        })}
      </ul>

      {open && (
        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] mt-4 md:bottom-4">
          <button onClick={saveVotes} disabled={busy || !dirty} className="w-full rounded-xl bg-marigold py-3 text-sm font-bold text-white shadow-lg disabled:opacity-50">{busy ? 'Saving…' : dirty ? 'Save my answers' : 'Answers saved'}</button>
        </div>
      )}
      {msg && <p role="status" className="mt-3 text-center text-sm text-green-700">{msg}</p>}

      <section className="mt-6 mb-8">
        <h2 className="font-display text-lg font-bold text-bone">Who's in this poll</h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {invitees.map((i) => (
            <li key={i.email} className="flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3 text-sm ring-1 ring-gray-200">
              {i.photo ? <img src={i.photo} alt="" className="h-7 w-7 rounded-full object-cover" /> : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600">{(i.full_name || i.email).charAt(0).toUpperCase()}</span>}
              <span className="max-w-[10rem] truncate text-gray-900">{i.full_name || i.email}</span>
              <span className={`text-xs font-semibold ${i.voted ? 'text-green-700' : 'text-gray-400'}`}>{i.voted ? 'Answered' : 'Waiting'}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
