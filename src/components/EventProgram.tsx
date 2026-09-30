import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { KIND_LABELS, KIND_STYLES, groupByDay, initials, timeRange, type LineupEntry, type ScheduleItem } from '../lib/program';

function Avatar({ name, url, size = 'h-14 w-14' }: { name: string; url: string | null; size?: string }) {
  return url
    ? <img src={url} alt="" className={`${size} shrink-0 rounded-full object-cover`} />
    : <span className={`flex ${size} shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-marigold to-teal text-lg font-bold text-white`}>{initials(name)}</span>;
}

function PersonCard({ p }: { p: LineupEntry }) {
  const body = (
    <>
      <Avatar name={p.name} url={p.image_url} />
      <span className="min-w-0">
        <span className="block truncate font-semibold text-gray-900">{p.name}</span>
        {p.role && <span className="block truncate text-sm text-marigold">{p.role}</span>}
        {!p.role && p.categories && p.categories.length > 0 && (
          <span className="block truncate text-xs text-gray-500">{[...new Set(p.categories.map((c) => c.trim()))].slice(0, 3).join(' · ')}</span>
        )}
        {p.bio && <span className="mt-0.5 line-clamp-2 block text-xs text-gray-500">{p.bio}</span>}
      </span>
    </>
  );
  const cls = 'flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition';
  if (p.resource_id) return <Link to={`/resources/${p.resource_id}`} className={`${cls} hover:border-marigold`}>{body}</Link>;
  if (p.link_url) return <a href={p.link_url} target="_blank" rel="noopener noreferrer" className={`${cls} hover:border-marigold`}>{body}</a>;
  return <div className={cls}>{body}</div>;
}

// Lineup and schedule on the public event page. Shows nothing if the organizer hasn't added either.
export default function EventProgram({ eventId }: { eventId: string }) {
  const [lineup, setLineup] = useState<LineupEntry[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [showAllLineup, setShowAllLineup] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.rpc('event_program', { p_event_id: eventId }).then(({ data, error }) => {
      if (cancelled || error || !data) return;
      setLineup((data.lineup ?? []) as LineupEntry[]);
      setSchedule((data.schedule ?? []) as ScheduleItem[]);
    });
    return () => { cancelled = true; };
  }, [eventId]);

  if (lineup.length === 0 && schedule.length === 0) return null;
  const byId = new Map(lineup.map((p) => [p.id, p]));
  const days = groupByDay(schedule);
  const visibleLineup = showAllLineup ? lineup : lineup.slice(0, 6);

  return (
    <div className="mt-10 flex flex-col gap-8">
      {lineup.length > 0 && (
        <section>
          <h2 className="font-display text-xl font-bold text-gray-900">Lineup</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {visibleLineup.map((p) => <PersonCard key={p.id} p={p} />)}
          </div>
          {lineup.length > 6 && (
            <button onClick={() => setShowAllLineup((v) => !v)} className="mt-3 text-sm font-medium text-marigold hover:underline">
              {showAllLineup ? 'Show less' : `See all ${lineup.length}`}
            </button>
          )}
        </section>
      )}

      {schedule.length > 0 && (
        <section>
          <h2 className="font-display text-xl font-bold text-gray-900">Schedule</h2>
          {days.map((day) => (
            <div key={day.key} className="mt-4">
              {days.length > 1 && <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">{day.label}</h3>}
              <ol className="relative flex flex-col gap-2 border-l-2 border-marigold/30 pl-4">
                {day.items.map((it) => {
                  const people = it.lineup_ids.map((id) => byId.get(id)).filter(Boolean) as LineupEntry[];
                  return (
                    <li key={it.id} className="relative rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                      <span className="absolute -left-[23px] top-4 h-3 w-3 rounded-full border-2 border-white bg-marigold" aria-hidden="true" />
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-semibold text-gray-900">{timeRange(it.starts_at, it.ends_at)}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${KIND_STYLES[it.kind] ?? KIND_STYLES.other}`}>{KIND_LABELS[it.kind] ?? it.kind}</span>
                        {it.area && <span className="text-xs text-gray-500">📍 {it.area}</span>}
                      </div>
                      <p className="mt-1 font-medium text-gray-900">{it.title}</p>
                      {it.description && <p className="mt-0.5 whitespace-pre-line text-sm text-gray-600">{it.description}</p>}
                      {people.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {people.map((p) => {
                            const chip = (<><Avatar name={p.name} url={p.image_url} size="h-6 w-6" /><span className="truncate">{p.name}</span></>);
                            const cls = 'flex max-w-full items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 py-0.5 pl-0.5 pr-2.5 text-xs font-medium text-gray-700';
                            return p.resource_id
                              ? <Link key={p.id} to={`/resources/${p.resource_id}`} className={`${cls} hover:border-marigold`}>{chip}</Link>
                              : <span key={p.id} className={cls}>{chip}</span>;
                          })}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
          <p className="mt-2 text-xs text-gray-400">Times are shown in your time zone and may change.</p>
        </section>
      )}
    </div>
  );
}
