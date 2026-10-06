import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import BackButton from '../components/BackButton';
import { ConfirmDialog } from '../components/admin/shared';
import { rpcError } from '../lib/groups';

interface Msg { id: string; sender_email: string; body: string; created_at: string; deleted_at: string | null }
const PAGE = 50;

function timeLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// Private chat for a group's members. New messages appear live.
export default function GroupChat() {
  const { id = '' } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [groupName, setGroupName] = useState('');
  const [role, setRole] = useState<string | null | undefined>(undefined);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [names, setNames] = useState<Map<string, { name: string; photo: string | null }>>(new Map());
  const [hasMore, setHasMore] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | { kind: 'delete' | 'report'; msg: Msg }>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const loadNames = useCallback(async (emails: string[]) => {
    const missing = emails.filter((e) => !names.has(e));
    if (!missing.length) return;
    const { data } = await supabase.from('public_profiles').select('email, full_name, profile_photo').in('email', [...new Set(missing)]);
    setNames((prev) => {
      const next = new Map(prev);
      (data ?? []).forEach((p) => next.set(p.email, { name: p.full_name || 'TapIN member', photo: p.profile_photo }));
      missing.forEach((e) => { if (!next.has(e)) next.set(e, { name: 'TapIN member', photo: null }); });
      return next;
    });
  }, [names]);

  useEffect(() => {
    (async () => {
      const [{ data: g }, { data: r }] = await Promise.all([
        supabase.from('resources').select('display_name').eq('id', id).maybeSingle(),
        supabase.rpc('group_role', { p_group: id }),
      ]);
      setGroupName(g?.display_name ?? 'Group');
      setRole((r as string) ?? null);
      if (!r) return;
      const { data } = await supabase.from('group_messages').select('*').eq('group_id', id).order('created_at', { ascending: false }).limit(PAGE);
      const list = ((data ?? []) as Msg[]).reverse();
      setMsgs(list);
      setHasMore((data ?? []).length === PAGE);
      loadNames(list.map((m) => m.sender_email));
    })();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live updates while the chat is open.
  useEffect(() => {
    if (!role) return;
    const channel = supabase.channel(`group-chat-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_messages', filter: `group_id=eq.${id}` }, (payload) => {
        const m = payload.new as Msg;
        if (!m?.id) return;
        setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev.map((x) => (x.id === m.id ? m : x)) : [...prev, m]));
        loadNames([m.sender_email]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, role]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (stickToBottom.current) bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [msgs.length]);

  async function loadOlder() {
    if (!msgs.length) return;
    stickToBottom.current = false;
    const { data } = await supabase.from('group_messages').select('*').eq('group_id', id).lt('created_at', msgs[0].created_at).order('created_at', { ascending: false }).limit(PAGE);
    const older = ((data ?? []) as Msg[]).reverse();
    setMsgs((prev) => [...older, ...prev]);
    setHasMore((data ?? []).length === PAGE);
    loadNames(older.map((m) => m.sender_email));
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !user?.email) return;
    setSending(true); setError(null);
    stickToBottom.current = true;
    const { data, error: err } = await supabase.from('group_messages').insert({ group_id: id, sender_email: user.email, body: body.slice(0, 2000) }).select('*').single();
    setSending(false);
    if (err || !data) return setError(rpcError(err, "Couldn't send. Please try again."));
    setText('');
    setMsgs((prev) => (prev.some((x) => x.id === data.id) ? prev : [...prev, data as Msg]));
  }

  async function del(m: Msg) {
    const { error: err } = await supabase.from('group_messages').update({ deleted_at: new Date().toISOString() }).eq('id', m.id);
    if (err) return setError("Couldn't delete that message.");
    setMsgs((prev) => prev.map((x) => (x.id === m.id ? { ...x, deleted_at: new Date().toISOString() } : x)));
  }

  async function report(m: Msg) {
    const { error: err } = await supabase.from('post_reports').insert({ group_message_id: m.id, reporter_email: user?.email, reason: 'Reported from group chat' });
    setNotice(err ? "Couldn't send the report. Please try again." : 'Thanks. TapIN will review this message.');
  }

  if (role === undefined) return <p className="text-sm text-muted">Loading…</p>;
  if (role === null) {
    return (
      <div className="mx-auto max-w-2xl">
        <BackButton fallback="/groups" fallbackLabel="Groups" />
        <p className="mt-4 rounded-xl border border-gray-200 bg-surface p-6 text-center text-sm text-muted">Only members of this group can see its chat.</p>
      </div>
    );
  }
  const isAdmin = role === 'owner' || role === 'admin';

  return (
    <div className="mx-auto flex max-w-2xl flex-col" style={{ minHeight: 'calc(100dvh - 12rem)' }}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <BackButton fallback={`/groups/${id}/manage`} fallbackLabel="Group" />
        <Link to={`/groups/${id}/manage`} className="text-xs font-medium text-marigold hover:underline">Group settings</Link>
      </div>
      <h1 className="font-display text-2xl font-extrabold text-bone">{groupName} chat</h1>
      <p className="text-xs text-muted">Only the group's members can see these messages.</p>
      {notice && <p role="status" className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</p>}

      <div className="mt-4 flex flex-1 flex-col gap-2">
        {hasMore && <button onClick={loadOlder} className="self-center rounded-full border border-gray-300 bg-white px-4 py-1.5 text-xs font-medium text-gray-700">Load earlier messages</button>}
        {msgs.length === 0 && <p className="py-10 text-center text-sm text-muted">No messages yet. Say hi to the group!</p>}
        {msgs.map((m, i) => {
          const me = m.sender_email === user?.email;
          const who = names.get(m.sender_email);
          const showName = !me && (i === 0 || msgs[i - 1].sender_email !== m.sender_email);
          return (
            <div key={m.id} className={`flex items-end gap-2 ${me ? 'justify-end' : 'justify-start'}`}>
              {!me && (showName
                ? (who?.photo ? <img src={who.photo} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" /> : <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600">{(who?.name ?? '?').charAt(0)}</span>)
                : <span className="w-7 shrink-0" />)}
              <div className={`max-w-[80%] ${me ? 'items-end' : 'items-start'} flex flex-col`}>
                {showName && <span className="mb-0.5 ml-1 text-[11px] font-medium text-muted">{who?.name ?? 'TapIN member'}</span>}
                <button type="button" onClick={() => setMenuFor(menuFor === m.id ? null : m.id)} disabled={!!m.deleted_at}
                  className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-left text-[15px] leading-snug ${m.deleted_at ? 'bg-gray-100 italic text-gray-400' : me ? 'bg-marigold text-white' : 'bg-white text-gray-900 ring-1 ring-gray-200'}`}>
                  {m.deleted_at ? 'Message deleted' : m.body}
                </button>
                <span className="mt-0.5 px-1 text-[10px] text-gray-400">{timeLabel(m.created_at)}</span>
                {menuFor === m.id && !m.deleted_at && (
                  <div className="mt-1 flex gap-2">
                    {(me || isAdmin) && <button onClick={() => { setMenuFor(null); setConfirm({ kind: 'delete', msg: m }); }} className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs text-red-600">Delete</button>}
                    {!me && <button onClick={() => { setMenuFor(null); setConfirm({ kind: 'report', msg: m }); }} className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs text-gray-700">Report</button>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] mt-4 flex items-end gap-2 rounded-2xl border border-gray-200 bg-surface p-2 shadow-sm md:bottom-4">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={2000} placeholder="Message the group"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) { e.preventDefault(); send(e as unknown as FormEvent); } }}
          className="max-h-32 min-h-[2.75rem] flex-1 resize-none rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900" aria-label="Message" />
        <button type="submit" disabled={sending || !text.trim()} className="rounded-xl bg-marigold px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{sending ? '…' : 'Send'}</button>
      </form>
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}

      {confirm?.kind === 'delete' && (
        <ConfirmDialog danger title="Delete this message?" confirmLabel="Delete" body="It will show as “Message deleted” for everyone." onClose={() => setConfirm(null)} onConfirm={async () => del(confirm.msg)} />
      )}
      {confirm?.kind === 'report' && (
        <ConfirmDialog title="Report this message?" confirmLabel="Report" body="TapIN's team will review it. The sender won't be told who reported it. You can also block them from their profile." onClose={() => setConfirm(null)} onConfirm={async () => report(confirm.msg)} />
      )}
    </div>
  );
}
