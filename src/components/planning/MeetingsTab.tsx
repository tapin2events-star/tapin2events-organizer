import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { MeetingSheet, PollSheet } from './MeetingSheets';
import { meetingWhen, type MeetingRow, type PlanTarget, type PollRow } from '../../lib/meetings';

const decode = (t: string) => t.replace(/&#8217;|&rsquo;/g, '\u2019').replace(/&amp;/g, '&');
const RSVP_LABEL = { going: 'Going', maybe: 'Maybe', no: "Can't make it" } as const;

// Planning > Meetings: open "find a time" polls, upcoming meetings (with quick RSVP), past meetings.
export default function MeetingsTab({ meetings, polls, targets, defaultTarget, canSchedule, query, onChanged }: {
  meetings: MeetingRow[]; polls: PollRow[]; targets: PlanTarget[]; defaultTarget: string; canSchedule: boolean; query: string; onChanged: () => void;
}) {
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<null | 'meeting' | 'poll'>(null);
  const [showPast, setShowPast] = useState(false);
  const q = query.trim().toLowerCase();
  const match = (t: string, extra?: string | null) => !q || t.toLowerCase().includes(q) || (extra ?? '').toLowerCase().includes(q);
  const now = Date.now();
  const upcoming = meetings.filter((m) => new Date(m.ends_at || m.starts_at).getTime() >= now - 30 * 60000 && match(m.title, m.org_name));
  const past = meetings.filter((m) => new Date(m.ends_at || m.starts_at).getTime() < now - 30 * 60000 && match(m.title, m.org_name)).reverse();
  const openPolls = polls.filter((p) => match(p.title, p.org_name));

  async function rsvp(m: MeetingRow, value: 'going' | 'maybe' | 'no') {
    const { error } = await supabase.rpc('rsvp_meeting', { p_meeting_id: m.id, p_rsvp: value });
    if (!error) onChanged();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">Schedule team meetings or find a time that works for everyone. Paste a Zoom or Meet link; everyone gets reminders.</p>
        {canSchedule && (
          <div className="flex gap-2">
            <button onClick={() => setSheet('poll')} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700">🗳️ Find a time</button>
            <button onClick={() => setSheet('meeting')} className="rounded-xl bg-marigold px-3 py-2 text-sm font-semibold text-white">+ Schedule</button>
          </div>
        )}
      </div>

      {openPolls.length > 0 && (
        <section>
          <h3 className="font-display text-lg font-bold text-bone">Finding a time</h3>
          <ul className="mt-2 flex flex-col gap-2">
            {openPolls.map((p) => (
              <li key={p.id}><Link to={`/organizer/polls/${p.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 hover:border-indigo-400">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-bone">🗳️ {p.title}</span>
                  <span className="block truncate text-xs text-muted">{[p.org_name, p.event_title && decode(p.event_title)].filter(Boolean).join(' · ') || 'Poll'} · {p.responded} of {p.invited} answered · {p.options} times</span>
                </span>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${p.i_voted ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900'}`}>{p.i_voted ? 'Answered' : 'Your turn'}</span>
              </Link></li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="font-display text-lg font-bold text-bone">Upcoming meetings</h3>
        {upcoming.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-muted">
            {q ? 'No meetings match.' : canSchedule ? <>No meetings scheduled. <button onClick={() => setSheet('meeting')} className="font-medium text-marigold">Schedule one</button> or <button onClick={() => setSheet('poll')} className="font-medium text-marigold">find a time</button>.</> : 'No meetings scheduled yet.'}
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {upcoming.map((m) => {
              const d = new Date(m.starts_at);
              return (
                <li key={m.id} className={`rounded-2xl border bg-surface p-3 ${m.status === 'cancelled' ? 'border-gray-200 opacity-60' : 'border-gray-200'}`}>
                  <button onClick={() => navigate(`/organizer/meetings/${m.id}`)} className="flex w-full items-start gap-3 text-left">
                    <span className="flex w-12 shrink-0 flex-col items-center rounded-xl py-1.5 text-white" style={{ background: m.org_color || '#4F46E5' }}>
                      <span className="text-[10px] font-bold uppercase">{d.toLocaleDateString('en-US', { month: 'short' })}</span>
                      <span className="text-lg font-extrabold leading-none">{d.getDate()}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-bone">{m.title}{m.status === 'cancelled' && <span className="ml-1.5 rounded bg-gray-200 px-1.5 text-[10px] font-bold text-gray-600">CANCELLED</span>}</span>
                      <span className="block truncate text-xs text-muted">{meetingWhen(m.starts_at)}{m.video_url ? ' · 💻 Video' : ''}{m.location ? ` · ${m.location}` : ''}</span>
                      <span className="block truncate text-xs text-muted">{[m.org_name, m.event_title && decode(m.event_title)].filter(Boolean).join(' · ')}{m.org_name || m.event_title ? ' · ' : ''}{m.going} going{m.maybe ? `, ${m.maybe} maybe` : ''} of {m.invited}</span>
                    </span>
                  </button>
                  {m.status === 'scheduled' && m.my_rsvp && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-[3.75rem]">
                      {(['going', 'maybe', 'no'] as const).map((v) => (
                        <button key={v} onClick={() => rsvp(m, v)} aria-pressed={m.my_rsvp === v}
                          className={`min-h-[34px] rounded-full px-3 text-xs font-semibold ${m.my_rsvp === v ? (v === 'going' ? 'bg-green-600 text-white' : v === 'maybe' ? 'bg-amber-500 text-white' : 'bg-gray-700 text-white') : 'bg-gray-100 text-gray-700'}`}>
                          {RSVP_LABEL[v]}
                        </button>
                      ))}
                      {m.video_url && new Date(m.starts_at).getTime() - now < 30 * 60000 && <a href={m.video_url} target="_blank" rel="noopener noreferrer" className="min-h-[34px] rounded-full bg-indigo-600 px-3 py-2 text-xs font-semibold text-white">Join call</a>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <button onClick={() => setShowPast(!showPast)} className="text-sm font-medium text-marigold">{showPast ? 'Hide' : 'Show'} past meetings ({past.length})</button>
          {showPast && (
            <ul className="mt-2 flex flex-col gap-2">
              {past.map((m) => (
                <li key={m.id}><Link to={`/organizer/meetings/${m.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-surface p-3 text-sm hover:border-marigold">
                  <span className="min-w-0 truncate"><span className="font-medium text-bone">{m.title}</span> <span className="text-muted">· {meetingWhen(m.starts_at)}</span></span>
                  <span className="shrink-0 text-xs text-marigold">Notes ›</span>
                </Link></li>
              ))}
            </ul>
          )}
        </section>
      )}

      {sheet === 'meeting' && <MeetingSheet targets={targets} defaultTarget={defaultTarget} onClose={() => setSheet(null)} onSaved={(id) => { setSheet(null); onChanged(); navigate(`/organizer/meetings/${id}`); }} />}
      {sheet === 'poll' && <PollSheet targets={targets} defaultTarget={defaultTarget} onClose={() => setSheet(null)} />}
    </div>
  );
}
