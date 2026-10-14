// A networking attendee card: banner, overlapping photo, name, title · company, colored "looking for"
// chips, intro, an optional "why you might connect" line, and the action area.
import type { ReactNode } from 'react';

const CHIP: Record<string, string> = {
  Hiring: 'bg-emerald-100 text-emerald-800', 'A new role': 'bg-sky-100 text-sky-800', Partners: 'bg-violet-100 text-violet-800',
  Clients: 'bg-amber-100 text-amber-900', Mentors: 'bg-rose-100 text-rose-800', Investors: 'bg-indigo-100 text-indigo-800', 'Just networking': 'bg-gray-100 text-gray-700',
};
const BANNERS = ['from-indigo-500 to-teal-400', 'from-fuchsia-500 to-orange-400', 'from-sky-500 to-indigo-500', 'from-emerald-500 to-cyan-400', 'from-amber-500 to-rose-500', 'from-violet-500 to-blue-500'];
const pick = (s: string) => BANNERS[[...s].reduce((n, c) => n + c.charCodeAt(0), 0) % BANNERS.length];

export default function NetCard({ seed, name, photo, title, company, lookingFor, intro, reason, highlight, compact = false, children }: {
  seed: string; name: string | null; photo: string | null; title: string | null; company: string | null; lookingFor: string[]; intro: string | null;
  reason?: string | null; highlight?: boolean; compact?: boolean; children?: ReactNode;
}) {
  return (
    <article className={`flex h-full flex-col overflow-hidden rounded-2xl border bg-white shadow-sm ${highlight ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-gray-200'} ${compact ? 'w-64 shrink-0 snap-start' : ''}`}>
      <div className={`h-14 bg-gradient-to-r ${pick(seed)}`} />
      <div className="-mt-8 flex flex-1 flex-col px-4 pb-4">
        {photo ? <img src={photo} alt="" className="h-16 w-16 rounded-full border-4 border-white object-cover shadow-sm" />
          : <span className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-indigo-100 text-xl font-bold text-indigo-700 shadow-sm">{(name || '?').charAt(0).toUpperCase()}</span>}
        <p className="mt-2 truncate font-display text-lg font-bold leading-tight text-gray-900">{name || 'TapIN member'}</p>
        {(title || company) && <p className="truncate text-sm text-gray-600">{title}{title && company ? <span className="text-gray-400"> · </span> : ''}{company && <span className="font-medium text-gray-800">{company}</span>}</p>}
        {reason && <p className="mt-2 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-800">✨ {reason}</p>}
        {lookingFor.length > 0 && (
          <div className="mt-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Looking for</p>
            <p className="mt-1 flex flex-wrap gap-1">{lookingFor.map((l) => <span key={l} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${CHIP[l] ?? 'bg-gray-100 text-gray-700'}`}>{l}</span>)}</p>
          </div>
        )}
        {intro && !compact && <p className="mt-2.5 border-l-2 border-gray-200 pl-2.5 text-sm italic text-gray-700">“{intro}”</p>}
        {children && <div className="mt-auto pt-3">{children}</div>}
      </div>
    </article>
  );
}
