import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import BackButton from '../components/BackButton';
import { ListSkeleton } from '../components/ui/Skeleton';

interface Person { full_name: string | null; photo: string | null; email: string; title: string | null; company: string | null; linkedin: string | null; event_id: string; event_title: string | null; connected_at: string; events_together: number }
const field = 'mt-1 block w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900';

// People I've met (Preview): everyone you've connected with at events, private to you, plus your saved
// networking card (prefills future events) and whether your professional info shows on your public profile.
export default function PeopleIveMet() {
  const { user } = useAuth();
  const [people, setPeople] = useState<Person[] | null>(null);
  const [q, setQ] = useState('');
  const [card, setCard] = useState({ pro_title: '', pro_company: '', pro_linkedin: '', show_pro_public: false });
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc('people_ive_met').then(({ data }) => setPeople((data ?? []) as Person[]));
    if (user) supabase.from('profiles').select('pro_title, pro_company, pro_linkedin, show_pro_public').eq('id', user.id).maybeSingle().then(({ data }) => {
      const d = data as { pro_title: string | null; pro_company: string | null; pro_linkedin: string | null; show_pro_public: boolean } | null;
      if (d) setCard({ pro_title: d.pro_title ?? '', pro_company: d.pro_company ?? '', pro_linkedin: d.pro_linkedin ?? '', show_pro_public: !!d.show_pro_public });
    });
  }, [user]);

  async function saveCard(next = card) {
    if (!user) return;
    let li = next.pro_linkedin.trim();
    if (li && !/^https?:\/\//i.test(li)) li = `https://${li}`;
    li = li.replace(/^http:\/\//i, 'https://');
    if (li && !/^https:\/\/([a-z]+\.)?linkedin\.com\//i.test(li)) { setMsg("That doesn't look like a LinkedIn link."); return; }
    const { error } = await supabase.from('profiles').update({ pro_title: next.pro_title.trim() || null, pro_company: next.pro_company.trim() || null, pro_linkedin: li || null, show_pro_public: next.show_pro_public }).eq('id', user.id);
    setMsg(error ? "Couldn't save." : 'Saved.'); setTimeout(() => setMsg(null), 2000);
    if (!error) { setCard({ ...next, pro_linkedin: li }); setEditing(false); }
  }

  const shown = (people ?? []).filter((p) => !q.trim() || [p.full_name, p.company, p.title, p.event_title].some((x) => (x ?? '').toLowerCase().includes(q.trim().toLowerCase())));
  return (
    <div className="mx-auto max-w-3xl">
      <BackButton fallback="/profile" fallbackLabel="Profile" />
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">🤝 Networking · Preview</p>
      <h1 className="font-display text-3xl font-extrabold text-bone">People I've met</h1>
      <p className="mt-1 text-sm text-muted">Everyone you've connected with at events. Only you can see this list.</p>

      <section className="mt-5 rounded-2xl border border-gray-200 bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-bone">Your networking card</p>
            <p className="text-sm text-muted">{[card.pro_title, card.pro_company].filter(Boolean).join(' · ') || 'Not filled in yet'}{card.pro_linkedin ? ' · LinkedIn added' : ''}</p>
            <p className="text-xs text-muted">Prefills your card at every event with networking.</p>
          </div>
          {!editing && <button onClick={() => setEditing(true)} className="text-sm font-medium text-marigold">Edit</button>}
        </div>
        {editing && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block min-w-0 text-xs font-medium text-gray-500">Title<input value={card.pro_title} maxLength={100} onChange={(e) => setCard({ ...card, pro_title: e.target.value })} className={field} /></label>
            <label className="block min-w-0 text-xs font-medium text-gray-500">Company<input value={card.pro_company} maxLength={100} onChange={(e) => setCard({ ...card, pro_company: e.target.value })} className={field} /></label>
            <label className="block min-w-0 text-xs font-medium text-gray-500 sm:col-span-2">LinkedIn<input value={card.pro_linkedin} onChange={(e) => setCard({ ...card, pro_linkedin: e.target.value })} placeholder="linkedin.com/in/yourname" inputMode="url" className={field} /></label>
            <div className="flex gap-2 sm:col-span-2">
              <button onClick={() => saveCard()} className="rounded-xl bg-marigold px-4 py-2.5 text-sm font-semibold text-white">Save</button>
              <button onClick={() => setEditing(false)} className="rounded-xl px-3 py-2.5 text-sm text-gray-500">Cancel</button>
            </div>
          </div>
        )}
        <label className="mt-3 flex items-start gap-3 border-t border-gray-100 pt-3 text-sm">
          <input type="checkbox" checked={card.show_pro_public} onChange={(e) => saveCard({ ...card, show_pro_public: e.target.checked })} className="mt-0.5 h-5 w-5 shrink-0 accent-marigold" />
          <span><span className="font-medium text-bone">Show my title, company and LinkedIn on my public profile</span>
            <span className="block text-xs text-muted">Off by default. Your email is never shown.</span></span>
        </label>
        {msg && <p role="status" className="mt-2 text-sm text-green-700">{msg}</p>}
      </section>

      {people !== null && people.length > 3 && (
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people, companies or events" aria-label="Search people" className="mt-5 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900" />
      )}
      {people === null ? <ListSkeleton rows={4} /> : people.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-muted">No connections yet. When an event has networking turned on, join its list or scan someone's code to connect.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {shown.map((p) => (
            <li key={p.email} className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-surface p-3">
              {p.photo ? <img src={p.photo} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" /> : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-700">{(p.full_name || p.email).charAt(0).toUpperCase()}</span>}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-bone">{p.full_name || p.email}</p>
                <p className="truncate text-sm text-muted">{[p.title, p.company].filter(Boolean).join(' · ')}</p>
                <p className="truncate text-xs text-muted">Met at <Link to={`/events/${p.event_id}`} className="text-marigold">{p.event_title || 'an event'}</Link> · {new Date(p.connected_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}{p.events_together > 1 ? ` · ${p.events_together} events together` : ''}</p>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <a href={`mailto:${p.email}`} className="font-medium text-marigold">✉️ {p.email}</a>
                  {p.linkedin && <a href={p.linkedin} target="_blank" rel="noopener noreferrer" className="font-medium text-marigold">LinkedIn ↗</a>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
