import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

// Printable meeting minutes: opens the print dialog so people can save it as a PDF (or print it).
interface Detail {
  id: string; title: string; starts_at: string; ends_at: string | null; location: string | null; video_url: string | null; agenda: string | null; notes: string | null;
  org_name: string | null; event_title: string | null; creator_name: string | null; created_by: string; status: string;
  invitees?: { email: string; name?: string | null; full_name?: string | null; rsvp: string }[];
}
export default function MeetingMinutes() {
  const { id } = useParams();
  const [m, setM] = useState<Detail | null | undefined>(undefined);
  useEffect(() => { supabase.rpc('meeting_detail', { p_meeting_id: id }).then(({ data }) => setM((data ?? null) as Detail | null)); }, [id]);
  useEffect(() => { if (m) { document.title = `Minutes: ${m.title}`; const t = setTimeout(() => window.print(), 600); return () => clearTimeout(t); } }, [m]);
  if (m === undefined) return <p className="p-8 text-center text-sm text-gray-500">Preparing minutes…</p>;
  if (m === null) return <p className="p-8 text-center text-sm text-gray-500">You don't have access to this meeting.</p>;
  const when = new Date(m.starts_at).toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const people = m.invitees ?? [];
  const name = (p: { email: string; name?: string | null; full_name?: string | null }) => p.full_name || p.name || p.email;
  const group = (r: string) => people.filter((p) => p.rsvp === r).map(name);
  return (
    <div className="mx-auto max-w-2xl bg-white p-8 text-gray-900 print:p-0">
      <style>{'@media print { @page { margin: 18mm; } .no-print { display: none !important; } body { background: #fff !important; } }'}</style>
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gray-50 p-3 text-sm">
        <Link to={`/meetings/${m.id}`} className="font-medium text-marigold">‹ Back to meeting</Link>
        <button onClick={() => window.print()} className="rounded-xl bg-[#0F1B3D] px-4 py-2 font-semibold text-white">Save as PDF / Print</button>
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{[m.org_name, m.event_title].filter(Boolean).join(' · ') || 'Meeting'} · Minutes</p>
      <h1 className="mt-1 text-3xl font-extrabold">{m.title}</h1>
      <p className="mt-2 text-sm">{when}{m.ends_at ? ` – ${new Date(m.ends_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : ''}</p>
      {m.location && <p className="text-sm">Location: {m.location}</p>}
      {m.video_url && <p className="text-sm">Video: {m.video_url}</p>}
      <p className="text-sm">Organized by: {m.creator_name || m.created_by}</p>
      {m.status === 'cancelled' && <p className="mt-2 text-sm font-semibold">This meeting was cancelled.</p>}
      {people.length > 0 && (
        <section className="mt-6">
          <h2 className="border-b border-gray-300 pb-1 text-lg font-bold">Attendance</h2>
          <p className="mt-2 text-sm"><strong>Going:</strong> {group('going').join(', ') || 'None'}</p>
          {group('maybe').length > 0 && <p className="text-sm"><strong>Maybe:</strong> {group('maybe').join(', ')}</p>}
          {group('no').length > 0 && <p className="text-sm"><strong>Not attending:</strong> {group('no').join(', ')}</p>}
          {group('pending').length > 0 && <p className="text-sm"><strong>No response:</strong> {group('pending').join(', ')}</p>}
        </section>
      )}
      <section className="mt-6">
        <h2 className="border-b border-gray-300 pb-1 text-lg font-bold">Agenda</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{m.agenda?.trim() || 'No agenda.'}</p>
      </section>
      <section className="mt-6">
        <h2 className="border-b border-gray-300 pb-1 text-lg font-bold">Minutes & notes</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{m.notes?.trim() || 'No notes were taken.'}</p>
      </section>
      <p className="mt-10 text-xs text-gray-400">Prepared with TapIN · {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
    </div>
  );
}
