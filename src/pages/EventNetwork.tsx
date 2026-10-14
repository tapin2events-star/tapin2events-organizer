import { useCallback, useEffect, useState } from 'react';
import FeatureFeedback from '../components/feedback/FeatureFeedback';
import NetCard from '../components/networking/NetCard';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import QrScanButtons from '../components/networking/QrScanButtons';
import Sheet from '../components/scouting/Sheet';
import { supabase } from '../lib/supabaseClient';
import BackButton from '../components/BackButton';
import { ListSkeleton } from '../components/ui/Skeleton';

const LOOKING = ['Hiring', 'A new role', 'Partners', 'Clients', 'Mentors', 'Investors', 'Just networking'];
interface CardInfo { title: string | null; company: string | null; looking_for: string[]; intro: string | null; linkedin: string | null }
interface Status { enabled: boolean; can_join: boolean; can_manage: boolean; members: number; requests: number; me: (CardInfo & { qr_token: string }) | null; defaults: CardInfo | null }
interface Scanned { full_name: string | null; photo: string | null; title: string | null; company: string | null; looking_for: string[]; intro: string | null; is_me: boolean; connected: boolean }
interface Member { member_key: string; full_name: string | null; photo: string | null; title: string | null; company: string | null; looking_for: string[]; intro: string | null; connection: 'none' | 'sent' | 'received' | 'connected'; connection_id: string | null; match_score: number; match_reason: string | null }
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
  const { id, token } = useParams();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const connectEmail = search.get('connect');
  const [connectTo, setConnectTo] = useState<Member | null>(null);
  const [myName, setMyName] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [scanned, setScanned] = useState<Scanned | null | undefined>(undefined);
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
    supabase.auth.getUser().then(({ data: u }) => { if (u.user) supabase.from('profiles').select('full_name').eq('id', u.user.id).maybeSingle().then(({ data: p }) => setMyName((p as { full_name: string | null } | null)?.full_name ?? null)); });
    setStatus((s ?? null) as Status | null);
  }, [id]);
  useEffect(() => { loadStatus(); }, [loadStatus]);
  // Opened from someone's QR code: show their card with a one-tap connect.
  useEffect(() => {
    if (!token) { setScanned(undefined); return; }
    supabase.rpc('networking_card', { p_event_id: id, p_token: token }).then(({ data }) => setScanned((data ?? null) as Scanned | null));
  }, [id, token]);
  async function connectScanned() {
    const { error } = await supabase.rpc('connect_by_qr', { p_event_id: id, p_token: token });
    if (error) return flash(errText(error, "Couldn't connect."));
    flash(`You're connected with ${scanned?.full_name || 'them'}! Their contact info is in My connections.`);
    navigate(`/events/${id}/network`, { replace: true });
    setView('connections'); loadStatus();
  }

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

  async function joinWithSaved() {
    const { error } = await supabase.rpc('join_networking_with_saved_card', { p_event_id: id });
    if (error) return flash(errText(error, "Couldn't join."));
    flash("You're on the list!");
    await loadStatus();
    afterJoin();
  }
  // Came here from scanning someone's personal QR ("Join & connect"): connect once you're on the list.
  async function afterJoin() {
    if (connectEmail) {
      const { error } = await supabase.rpc('connect_in_person', { p_event_id: id, p_email: connectEmail });
      if (!error) { flash("You're on the list and connected! Their contact info is in Connections."); setView('connections'); navigate(`/events/${id}/network`, { replace: true }); }
    }
  }
  useEffect(() => {
    if (connectEmail && status?.me) afterJoin();
  }, [connectEmail, !!status?.me]); // eslint-disable-line react-hooks/exhaustive-deps
  async function removeConnection(c: Contact) {
    if (!window.confirm(`Remove ${c.full_name || c.email} from your connections? You'll stop seeing each other's contact info.`)) return;
    await supabase.rpc('remove_connection', { p_event_id: id, p_other_email: c.email });
    setContacts((list) => (list ?? []).filter((x) => x.email !== c.email));
  }
  async function connect(m: Member, note: string) {
    setConnectTo(null);
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
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">🤝 Networking</p>
      <h1 className="font-display text-2xl font-extrabold text-bone sm:text-3xl">Meet people going to {title || 'this event'}</h1>
      <p className="mt-1 text-sm text-muted">{status.members} {status.members === 1 ? 'person has' : 'people have'} joined. Contact info is shared only when you both connect.</p>
      {(status.can_join || joined) && <div className="mt-4"><QrScanButtons name={myName} /></div>}
      {msg && <p role="status" className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">{msg}</p>}
      {token && scanned !== undefined && (
        <div className="mt-4">
          {scanned === null ? <p className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-muted">This code isn't valid for this event, or you're not going.</p> : (
            <div className="mx-auto max-w-sm">
              <NetCard seed={token} name={scanned.full_name} photo={scanned.photo} title={scanned.title} company={scanned.company} lookingFor={scanned.looking_for} intro={scanned.intro} highlight>
                {scanned.is_me ? <p className="text-sm text-muted">That's your own code. Show it to someone so they can scan it.</p>
                  : scanned.connected ? <p className="text-sm font-semibold text-green-700">✓ You're already connected.</p>
                  : joined ? <button onClick={connectScanned} className="w-full rounded-xl bg-marigold py-3 text-sm font-bold text-white">🤝 Connect now</button>
                  : <p className="text-sm text-gray-700">Join the list below, then you'll be connected.</p>}
              </NetCard>
            </div>
          )}
        </div>
      )}

      {!joined && !status.can_join && !status.can_manage ? (
        <div className="mt-6 rounded-2xl border border-gray-200 bg-surface p-5 text-sm text-muted">
          Networking is for people going to this event. <Link to={`/events/${id}`} className="font-medium text-marigold">Get your ticket</Link> to join.
        </div>
      ) : !joined && view !== 'card' ? (
        <div className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5">
          <p className="font-semibold text-bone">Join the networking list</p>
          <p className="mt-1 text-sm text-muted">{connectEmail ? 'Join to connect with the person you scanned. ' : ''}Only people who join can browse the list, and you can leave anytime.</p>
          {status.defaults && (status.defaults.title || status.defaults.company) ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button onClick={joinWithSaved} className="rounded-xl bg-marigold px-4 py-2.5 text-sm font-semibold text-white">Join as {[status.defaults.title, status.defaults.company].filter(Boolean).join(' at ')}</button>
              <button onClick={() => setView('card')} className="rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600">Edit first</button>
            </div>
          ) : <button onClick={() => setView('card')} className="mt-3 rounded-xl bg-marigold px-4 py-2.5 text-sm font-semibold text-white">Create my card</button>}
          {status.can_manage && <button onClick={() => setView('people')} className="ml-2 mt-3 rounded-xl px-3 py-2.5 text-sm text-gray-600">Browse as organizer</button>}
        </div>
      ) : null}

      {(joined || status.can_manage) && view !== 'card' && (
        <div className="mt-5 flex gap-1.5 overflow-x-auto" role="tablist">
          {(['people', 'connections'] as const).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${view === v ? 'bg-[#0F1B3D] text-white' : 'border border-gray-200 bg-white text-gray-700'}`}>
              {v === 'people' ? `People${status.requests ? ` · ${status.requests} new` : ''}` : 'Connections'}
            </button>
          ))}
          {joined && <button onClick={() => setView('card')} className="ml-auto shrink-0 whitespace-nowrap px-2 py-2 text-sm font-medium text-marigold">Edit my card</button>}
        </div>
      )}

      {view === 'card' && <CardForm eventId={id!} me={status.me ?? status.defaults} isNew={!status.me} onSaved={async (left) => {
        flash(left ? 'You left the networking list.' : 'Your card is saved.'); setView('people'); await loadStatus();
        if (!left && token && scanned && !scanned.is_me && !scanned.connected) connectScanned();
        if (!left) afterJoin();
      }} onCancel={() => setView('people')} />}

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
            <>
              {joined && !q && !looking && (() => {
                const suggested = people.filter((m) => m.match_score > 0 && m.connection === 'none').sort((a, b) => b.match_score - a.match_score).slice(0, 6);
                return suggested.length > 0 && (
                  <section className="mt-5">
                    <h2 className="font-display text-base font-bold text-bone">✨ Suggested for you</h2>
                    <div className="-mx-4 mt-2 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:-mx-0 sm:px-0">
                      {suggested.map((m) => (
                        <NetCard key={m.member_key} compact seed={m.member_key} name={m.full_name} photo={m.photo} title={m.title} company={m.company} lookingFor={m.looking_for} intro={m.intro} reason={m.match_reason}>
                          <button onClick={() => setConnectTo(m)} className="w-full rounded-xl bg-marigold py-2.5 text-sm font-semibold text-white">Connect</button>
                        </NetCard>
                      ))}
                    </div>
                  </section>
                );
              })()}
              <h2 className="mt-5 font-display text-base font-bold text-bone">{q || looking ? 'Results' : 'Everyone'}</h2>
              <ul className="mt-2 grid gap-3 sm:grid-cols-2">
                {people.map((m) => (
                  <li key={m.member_key}>
                    <NetCard seed={m.member_key} name={m.full_name} photo={m.photo} title={m.title} company={m.company} lookingFor={m.looking_for} intro={m.intro}
                      reason={joined && m.connection === 'none' ? m.match_reason : null} highlight={m.connection === 'received'}>
                      {m.connection === 'received' && <p className="mb-2 text-xs font-semibold text-indigo-700">Wants to connect with you</p>}
                      {joined ? (
                        <div className="flex gap-2">
                          {m.connection === 'none' && <button onClick={() => setConnectTo(m)} className="flex-1 rounded-xl bg-marigold py-2.5 text-sm font-semibold text-white">Connect</button>}
                          {m.connection === 'sent' && <span className="flex-1 rounded-xl bg-gray-100 py-2.5 text-center text-sm text-gray-600">Requested</span>}
                          {m.connection === 'received' && <>
                            <button onClick={() => respond(m, false)} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-600">Decline</button>
                            <button onClick={() => respond(m, true)} className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white">Accept</button>
                          </>}
                          {m.connection === 'connected' && <button onClick={() => setView('connections')} className="flex-1 rounded-xl bg-green-50 py-2.5 text-sm font-semibold text-green-800">✓ Connected</button>}
                        </div>
                      ) : null}
                    </NetCard>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {connectTo && <ConnectSheet member={connectTo} onSend={(note) => connect(connectTo, note)} onClose={() => setConnectTo(null)} />}

      {view === 'connections' && (contacts?.length ?? 0) > 0 && <FeatureFeedback feature="networking" label="attendee networking" className="mt-4" />}
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
                    <button onClick={() => removeConnection(c)} className="text-gray-400 hover:text-red-600">Remove</button>
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

function CardForm({ eventId, me, isNew, onSaved, onCancel }: { eventId: string; me: CardInfo | null; isNew: boolean; onSaved: (left: boolean) => void; onCancel: () => void }) {
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
      <p className="font-semibold text-bone">{!isNew ? 'Your networking card' : 'Create your card'}</p>
      <p className="text-xs text-muted">Your name and photo come from your TapIN profile. Your email stays private until you connect.{isNew && me ? ' Filled in from your last card.' : ''} Saving also updates your card for future events.</p>
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
        <button onClick={save} disabled={busy} className="rounded-xl bg-marigold px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : !isNew ? 'Save' : 'Join the list'}</button>
        <button onClick={onCancel} className="rounded-xl px-3 py-2.5 text-sm text-gray-500">Cancel</button>
        {!isNew && <button onClick={leave} className="ml-auto text-sm text-gray-400 hover:text-red-600">Leave the list</button>}
      </div>
    </div>
  );
}

// Connect with a quick note (tap a suggestion or write your own).
function ConnectSheet({ member, onSend, onClose }: { member: Member; onSend: (note: string) => void; onClose: () => void }) {
  const first = member.full_name?.split(' ')[0] || 'them';
  const suggestions = ['Great to meet you!', 'Would love to connect.', ...(member.looking_for.includes('Partners') ? ["Let's talk partnerships."] : []), ...(member.looking_for.includes('Hiring') ? ["I'd love to hear about your openings."] : []), ...(member.looking_for.includes('Clients') ? ['I may be able to help with what you do.'] : [])];
  const [note, setNote] = useState('');
  return (
    <Sheet title={`Connect with ${first}`} onClose={onClose}>
      <div className="flex items-center gap-3">
        <Avatar name={member.full_name} photo={member.photo} />
        <div className="min-w-0"><p className="truncate font-semibold text-gray-900">{member.full_name || 'TapIN member'}</p><p className="truncate text-sm text-gray-500">{[member.title, member.company].filter(Boolean).join(' · ')}</p></div>
      </div>
      <p className="mt-4 text-xs font-medium text-gray-500">Add a note (optional)</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {suggestions.map((t) => <button key={t} type="button" onClick={() => setNote(t)} className={`rounded-full px-3 py-1.5 text-sm ${note === t ? 'bg-marigold font-semibold text-white' : 'border border-gray-300 bg-white text-gray-700'}`}>{t}</button>)}
      </div>
      <textarea rows={2} maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Or write your own" className="mt-2 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900" />
      <button onClick={() => onSend(note)} className="mt-4 w-full rounded-xl bg-marigold py-3 text-sm font-bold text-white">Send request</button>
      <p className="mt-2 text-center text-xs text-gray-500">Your contact info is shared only if {first} accepts.</p>
    </Sheet>
  );
}
