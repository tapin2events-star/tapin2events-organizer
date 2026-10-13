import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import BackButton from '../components/BackButton';
import { ListSkeleton } from '../components/ui/Skeleton';

const LOOKING = ['Hiring', 'A new role', 'Partners', 'Clients', 'Mentors', 'Investors', 'Just networking'];
interface Status { enabled: boolean; can_join: boolean; can_manage: boolean; members: number; requests: number; me: { title: string | null; company: string | null; looking_for: string[]; intro: string | null; linkedin: string | null } | null }
interface Member { member_key: string; full_name: string | null; photo: string | null; title: string | null; company: string | null; looking_for: string[]; intro: string | null; connection: 'none' | 'sent' | 'received' | 'connected'; connection_id: string | null }
interface Contact { full_name: string | null; photo: string | null; email: string; title: string | null; company: string | null; linkedin: string | null }
const field = 'mt-1 block w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900';
const errText = (e: { message?: string } | null, fallback: string) => (e?.message && !/function|permission denied|violates/i.test(e.message) ? e.message : fallback);

function Avatar({ name, photo, size = 'h-12 w-12' }: { name: string | null; photo: string | null; size?: string }) {
  return photo ? <img src={photo} alt="" className={`${size} shrink-0 rounded-full object-cover`} />
    : <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-700`}>{(name || '?').charAt(0).toUpperCase()}</span>;
}

// Attendee networking (Preview): opt in with a card, browse people going (give to get), send connection
// requests; contact info is shared only between accepted connections.
export default function EventNetwork() {
  const { id } = useParams();
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<Status | null | undefined>(undefined);
  const [view, setView] = useState<'people' | 'connections' | 'card'>('people');
  const [people, setPeople] = useState<Member[] | null>(null);
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [q, setQ] = useState('');
  const [looking, setLooking] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(null), 3000); };

  const loadStatus = useCallback(async () => {
    const [{ data: s }, { data: ev }] = await Promise.all([
      supabase.rpc('networking_status', { p_event_id: id }),
      supabase.from('events').select('title').eq('id', id!).maybeSingle(),
    ]);
    setTitle((ev as { title: string } | null)?.title ?? '');
    setStatus((s ?? null) as Status | null);
  }, [id]);
  useEffect(() => { loadStatus(); }, [loadStatus]);

  const loadPeople = useCallback(async () => {
    const { data } = await supabase.rpc('networking_directory', { p_event_id: id, p_query: q.trim() || null, p_looking: looking });
    setPeople((data ?? []) as Member[]);
  }, [id, q, looking]);
  useEffect(() => {
    if (!status?.me && !status?.can_manage) return;
    const t = setTimeout(loadPeople, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [status?.me, status?.can_manage, loadPeople, q]);
  useEffect(() => {
    if (view !== 'connections') return;
    supabase.rpc('my_connections', { p_event_id: id }).then(({ data }) => setContacts((data ?? []) as Contact[]));
  }, [view, id]);

  async function connect(m: Member) {
    const note = window.prompt(`Add a short note to ${m.full_name?.split(' ')[0] || 'them'} (optional):`, '') ?? null;
    if (note === null) return;
    const { error } = await supabase.rpc('request_connection', { p_event_id: id, p_member_key: m.member_key, p_message: note });
    if (error) return flash(errText(error, "Couldn't send the request."));
    flash(m.connection === 'received' ? `You're connected with ${m.full_name || 'them'}!` : 'Request sent.');
    loadPeople();
  }
  async function respond(m: Member, accept: boolean) {
    if (!m.connection_id) return;
    const { error } = await supabase.rpc('respond_connection', { p_connection_id: m.connection_id, p_accept: accept });
    if (error) return flash(errText(error, "Couldn't update the request."));
    flash(accept ? `You're connected with ${m.full_name || 'them'}! Their contact info is in My connections.` : 'Request declined.');
    loadPeople(); loadStatus();
  }

  if (status === undefined) return <div className="mx-auto max-w-3xl"><ListSkeleton rows={5} /></div>;
  if (!status || !status.enabled) return (
    <div className="mx-auto max-w-3xl">
      <BackButton fallback={`/events/${id}`} fallbackLabel="Event" />
      <p className="mt-4 text-muted">Networking isn't turned on for this event.</p>
    </div>
  );

  const joined = !!status.me;
  return (
    <div className="mx-auto max-w-3xl">
      <BackButton fallback={`/events/${id}`} fallbackLabel="Event" />
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">🤝 Networking · Preview</p>
      <h1 className="font-display text-2xl font-extrabold text-bone sm:text-3xl">Meet people going to {title || 'this event'}</h1>
      <p className="mt-1 text-sm text-muted">{status.members} {status.members === 1 ? 'person has' : 'people have'} joined. Contact info is shared only when you both connect.</p>
      {msg && <p role="status" className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">{msg}</p>}

      {!joined && !status.can_join && !status.can_manage ? (
        <div className="mt-6 rounded-2xl border border-gray-200 bg-surface p-5 text-sm text-muted">
          Networking is for people going to this event. <Link to={`/events/${id}`} className="font-medium text-marigold">Get your ticket</Link> to join.
        </div>
      ) : !joined && view !== 'card' ? (
        <div className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5">
          <p className="font-semibold text-bone">Join the networking list</p>
          <p className="mt-1 text-sm text-muted">Add a quick card so others know who you are and what you're looking for. Only people who join can browse the list, and you can leave anytime.</p>
          <button onClick={() => setView('card')} className="mt-3 rounded-xl bg-marigold px-4 py-2.5 text-sm font-semibold text-white">Create my card</button>
          {status.can_manage && <button onClick={() => setView('people')} className="ml-2 mt-3 rounded-xl px-3 py-2.5 text-sm text-gray-600">Browse as organizer</button>}
        </div>
      ) : null}

      {(joined || status.can_manage) && view !== 'card' && (
        <div className="mt-5 flex gap-1.5 overflow-x-auto" role="tablist">
          {(['people', 'connections'] as const).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${view === v ? 'bg-[#0F1B3D] text-white' : 'border border-gray-200 bg-white text-gray-700'}`}>
              {v === 'people' ? `People${status.requests ? ` · ${status.requests} new` : ''}` : 'My connections'}
            </button>
          ))}
          {joined && <button onClick={() => setView('card')} className="whitespace-nowrap rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700">My card</button>}
        </div>
      )}

      {view === 'card' && <CardForm eventId={id!} me={status.me} onSaved={(left) => { flash(left ? 'You left the networking list.' : 'Your card is saved.'); setView('people'); loadStatus(); }} onCancel={() => setView('people')} />}

      {view === 'people' && (joined || status.can_manage) && (
        <>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, company or title" aria-label="Search people"
            className="mt-4 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900" />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {LOOKING.map((l) => (
              <button key={l} onClick={() => setLooking(looking === l ? null : l)} aria-pressed={looking === l}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${looking === l ? 'bg-marigold text-white' : 'border border-gray-200 bg-white text-gray-700'}`}>{l}</button>
            ))}
          </div>
          {people === null ? <ListSkeleton rows={4} className="mt-4" /> : people.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-muted">{q || looking ? 'No one matches.' : 'No one else has joined yet. Check back closer to the event!'}</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {people.map((m) => (
                <li key={m.member_key} className={`rounded-2xl border bg-surface p-3 ${m.connection === 'received' ? 'border-indigo-300' : 'border-gray-200'}`}>
                  <div className="flex items-start gap-3">
                    <Avatar name={m.full_name} photo={m.photo} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-bone">{m.full_name || 'TapIN member'}</p>
                      <p className="truncate text-sm text-muted">{[m.title, m.company].filter(Boolean).join(' · ')}</p>
                      {m.intro && <p className="mt-1 text-sm text-bone">{m.intro}</p>}
                      {m.looking_for.length > 0 && <p className="mt-1.5 flex flex-wrap gap-1">{m.looking_for.map((l) => <span key={l} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">{l}</span>)}</p>}
                    </div>
                  </div>
                  {joined && (
                    <div className="mt-2 flex flex-wrap justify-end gap-2">
                      {m.connection === 'none' && <button onClick={() => connect(m)} className="rounded-xl bg-marigold px-4 py-2 text-sm font-semibold text-white">Connect</button>}
                      {m.connection === 'sent' && <span className="rounded-xl bg-gray-100 px-4 py-2 text-sm text-gray-600">Requested</span>}
                      {m.connection === 'received' && <>
                        <button onClick={() => respond(m, false)} className="rounded-xl px-3 py-2 text-sm text-gray-500">Decline</button>
                        <button onClick={() => respond(m, true)} className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white">Accept</button>
                      </>}
                      {m.connection === 'connected' && <button onClick={() => setView('connections')} className="rounded-xl bg-green-50 px-4 py-2 text-sm font-semibold text-green-800">✓ Connected</button>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {view === 'connections' && (
        contacts === null ? <ListSkeleton rows={3} className="mt-4" /> : contacts.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-muted">No connections yet. When someone accepts your request (or you accept theirs), their contact info shows up here.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {contacts.map((c) => (
              <li key={c.email} className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-surface p-3">
                <Avatar name={c.full_name} photo={c.photo} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-bone">{c.full_name || c.email}</p>
                  <p className="truncate text-sm text-muted">{[c.title, c.company].filter(Boolean).join(' · ')}</p>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <a href={`mailto:${c.email}`} className="font-medium text-marigold">✉️ {c.email}</a>
                    {c.linkedin && <a href={c.linkedin} target="_blank" rel="noopener noreferrer" className="font-medium text-marigold">LinkedIn ↗</a>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}

function CardForm({ eventId, me, onSaved, onCancel }: { eventId: string; me: Status['me']; onSaved: (left: boolean) => void; onCancel: () => void }) {
  const [f, setF] = useState({ title: me?.title ?? '', company: me?.company ?? '', intro: me?.intro ?? '', linkedin: me?.linkedin ?? '' });
  const [looking, setLooking] = useState<string[]>(me?.looking_for ?? []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function save() {
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc('save_networking_profile', { p_event_id: eventId, p: { ...f, looking_for: looking } });
    setBusy(false);
    if (error) return setErr(errText(error, "Couldn't save your card."));
    onSaved(false);
  }
  async function leave() {
    if (!window.confirm('Leave the networking list for this event? Your card will be removed.')) return;
    await supabase.rpc('leave_networking', { p_event_id: eventId });
    onSaved(true);
  }
  return (
    <div className="mt-5 rounded-2xl border border-gray-200 bg-surface p-4">
      <p className="font-semibold text-bone">{me ? 'Your networking card' : 'Create your card'}</p>
      <p className="text-xs text-muted">Your name and photo come from your TapIN profile. Your email stays private until you connect.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block min-w-0 text-xs font-medium text-gray-500">Title<input value={f.title} maxLength={100} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Marketing Director" className={field} /></label>
        <label className="block min-w-0 text-xs font-medium text-gray-500">Company<input value={f.company} maxLength={100} onChange={(e) => setF({ ...f, company: e.target.value })} placeholder="Acme" className={field} /></label>
      </div>
      <p className="mt-3 text-xs font-medium text-gray-500">I'm looking for</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {LOOKING.map((l) => (
          <button key={l} type="button" onClick={() => setLooking(looking.includes(l) ? looking.filter((x) => x !== l) : [...looking, l])} aria-pressed={looking.includes(l)}
            className={`min-h-[36px] rounded-full px-3 text-sm ${looking.includes(l) ? 'bg-marigold font-semibold text-white' : 'border border-gray-300 bg-white text-gray-700'}`}>{l}</button>
        ))}
      </div>
      <label className="mt-3 block text-xs font-medium text-gray-500">Short intro (optional)<textarea rows={2} maxLength={280} value={f.intro} onChange={(e) => setF({ ...f, intro: e.target.value })} placeholder="What you do, or what you'd love to talk about" className={field} /></label>
      <label className="mt-3 block text-xs font-medium text-gray-500">LinkedIn (optional, shared only with connections)<input value={f.linkedin} onChange={(e) => setF({ ...f, linkedin: e.target.value })} placeholder="linkedin.com/in/yourname" inputMode="url" className={field} /></label>
      {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button onClick={save} disabled={busy} className="rounded-xl bg-marigold px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : me ? 'Save' : 'Join the list'}</button>
        <button onClick={onCancel} className="rounded-xl px-3 py-2.5 text-sm text-gray-500">Cancel</button>
        {me && <button onClick={leave} className="ml-auto text-sm text-gray-400 hover:text-red-600">Leave the list</button>}
      </div>
    </div>
  );
}
