import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { ConfirmDialog } from '../admin/shared';

export interface Attachment { type: 'image' | 'file'; url: string; name?: string; size?: number; width?: number; height?: number }
interface Msg { id: string; sender_email: string; body: string; created_at: string; deleted_at: string | null; attachments?: Attachment[] | null; mentions?: string[] | null; pinned_at?: string | null }
export interface ChatMember { email: string; name: string; photo: string | null }
const PAGE = 50;
const MAX_FILES = 6;
const FILE_TYPES = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv';

function timeLabel(iso: string) {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}
const fmtSize = (n?: number) => (!n ? '' : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

// Shrink photos before upload (longest side 1600px, JPEG) so chats stay fast and storage stays small.
async function shrinkImage(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  if (file.type === 'image/gif') return { blob: file, width: 0, height: 0 };
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b ?? file), 'image/jpeg', 0.82));
    return { blob, width: w, height: h };
  } finally { URL.revokeObjectURL(url); }
}

// One chat, used by organization team chats and artist group chats. New messages appear live.
// Photos (shrunk automatically) and files (PDFs, docs, up to 10 MB), pinned messages, @mentions,
// delete your own messages; moderators can pin and remove any message.
export default function ChatRoom({ table, scopeColumn, scopeId, members, canModerate, placeholder, onRead, reportable = false }: {
  table: 'group_messages' | 'org_messages'; scopeColumn: 'group_id' | 'org_id'; scopeId: string; members: ChatMember[];
  canModerate: boolean; placeholder: string; onRead?: () => void; reportable?: boolean;
}) {
  const { user } = useAuth();
  const me = (user?.email ?? '').toLowerCase();
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [names, setNames] = useState<Map<string, { name: string; photo: string | null }>>(new Map());
  const [hasMore, setHasMore] = useState(false);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | { kind: 'delete' | 'report'; msg: Msg }>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [viewer, setViewer] = useState<string | null>(null);
  const [mentionQ, setMentionQ] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stick = useRef(true);

  const nameOf = useCallback((email: string) => names.get(email.toLowerCase()) ?? members.find((m) => m.email === email.toLowerCase()) ?? { name: 'TapIN member', photo: null }, [names, members]);
  const loadNames = useCallback(async (emails: string[]) => {
    const missing = [...new Set(emails.map((e) => e.toLowerCase()))].filter((e) => !names.has(e) && !members.some((m) => m.email === e));
    if (!missing.length) return;
    const { data } = await supabase.from('public_profiles').select('email, full_name, profile_photo').in('email', missing);
    setNames((prev) => { const n = new Map(prev); (data ?? []).forEach((p) => n.set(String(p.email).toLowerCase(), { name: p.full_name || 'TapIN member', photo: p.profile_photo })); return n; });
  }, [names, members]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from(table).select('*').eq(scopeColumn, scopeId).order('created_at', { ascending: false }).limit(PAGE);
      const list = ((data ?? []) as Msg[]).reverse();
      setMsgs(list); setHasMore((data ?? []).length === PAGE);
      loadNames(list.map((m) => m.sender_email));
      onRead?.();
    })();
  }, [table, scopeColumn, scopeId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const channel = supabase.channel(`${table}-${scopeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, filter: `${scopeColumn}=eq.${scopeId}` }, (payload) => {
        const m = payload.new as Msg;
        if (!m?.id) return;
        setMsgs((prev) => (prev ?? []).some((x) => x.id === m.id) ? (prev ?? []).map((x) => (x.id === m.id ? m : x)) : [...(prev ?? []), m]);
        loadNames([m.sender_email]);
        onRead?.();
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [table, scopeColumn, scopeId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (stick.current) bottomRef.current?.scrollIntoView({ block: 'end' }); }, [msgs?.length]);

  async function loadOlder() {
    if (!msgs?.length) return;
    stick.current = false;
    const { data } = await supabase.from(table).select('*').eq(scopeColumn, scopeId).lt('created_at', msgs[0].created_at).order('created_at', { ascending: false }).limit(PAGE);
    const older = ((data ?? []) as Msg[]).reverse();
    setMsgs((prev) => [...older, ...(prev ?? [])]); setHasMore((data ?? []).length === PAGE);
    loadNames(older.map((m) => m.sender_email));
  }

  function pick(list: FileList | null) {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      if (next.length >= MAX_FILES) { setError(`Up to ${MAX_FILES} attachments per message.`); break; }
      if (!f.type.startsWith('image/') && f.size > 10 * 1024 * 1024) { setError(`${f.name} is over 10 MB.`); continue; }
      if (f.type.startsWith('image/') && f.size > 20 * 1024 * 1024) { setError(`${f.name} is too large.`); continue; }
      next.push(f);
    }
    setFiles(next);
  }

  // @mentions: typing "@" suggests teammates; picked names are stored as mentions so they're notified.
  function onType(v: string) {
    setText(v);
    const m = v.slice(0, inputRef.current?.selectionStart ?? v.length).match(/@([\w.-]{0,30})$/);
    setMentionQ(m ? m[1].toLowerCase() : null);
  }
  const suggestions = useMemo(() => (mentionQ === null ? [] : members.filter((m) => m.email !== me && (m.name.toLowerCase().includes(mentionQ) || m.email.startsWith(mentionQ))).slice(0, 5)), [mentionQ, members, me]);
  function insertMention(m: ChatMember) {
    const el = inputRef.current; const pos = el?.selectionStart ?? text.length;
    const before = text.slice(0, pos).replace(/@([\w.-]{0,30})$/, `@${m.name.split(' ')[0]} `);
    setText(before + text.slice(pos)); setMentionQ(null);
    setTimeout(() => el?.focus(), 0);
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if ((!body && !files.length) || !user?.id || !user.email) return;
    setSending(true); setError(null); stick.current = true;
    const attachments: Attachment[] = [];
    for (const f of files) {
      const isImg = f.type.startsWith('image/');
      const ext = isImg ? (f.type === 'image/gif' ? 'gif' : 'jpg') : (f.name.split('.').pop() || 'file').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `${user.id}/chat/${crypto.randomUUID()}.${ext}`;
      let blob: Blob = f, width = 0, height = 0;
      if (isImg) ({ blob, width, height } = await shrinkImage(f));
      const { error: upErr } = await supabase.storage.from('user-uploads').upload(path, blob, { contentType: isImg ? (f.type === 'image/gif' ? 'image/gif' : 'image/jpeg') : f.type || 'application/octet-stream' });
      if (upErr) { setSending(false); return setError(`Couldn't upload ${f.name}.`); }
      const url = supabase.storage.from('user-uploads').getPublicUrl(path).data.publicUrl;
      attachments.push(isImg ? { type: 'image', url, width, height } : { type: 'file', url, name: f.name.slice(0, 120), size: f.size });
    }
    const mentions = members.filter((m) => m.email !== me && new RegExp(`@${m.name.split(' ')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(body)).map((m) => m.email);
    const row = { [scopeColumn]: scopeId, sender_email: user.email, body: body.slice(0, table === 'group_messages' ? 2000 : 4000), attachments, mentions };
    const { data, error: err } = await supabase.from(table).insert(row).select('*').single();
    setSending(false);
    if (err || !data) return setError("Couldn't send. Please try again.");
    setText(''); setFiles([]);
    setMsgs((prev) => ((prev ?? []).some((x) => x.id === data.id) ? prev : [...(prev ?? []), data as Msg]));
  }
  async function del(m: Msg) {
    const { error: err } = await supabase.from(table).update({ deleted_at: new Date().toISOString() }).eq('id', m.id);
    if (err) return setError("Couldn't delete that message.");
    setMsgs((prev) => (prev ?? []).map((x) => (x.id === m.id ? { ...x, deleted_at: new Date().toISOString() } : x)));
  }
  async function togglePin(m: Msg) {
    const pinned = !m.pinned_at;
    const { error: err } = await supabase.from(table).update({ pinned_at: pinned ? new Date().toISOString() : null, pinned_by: pinned ? me : null }).eq('id', m.id);
    if (err) return setError("Couldn't pin that message.");
    setMsgs((prev) => (prev ?? []).map((x) => (x.id === m.id ? { ...x, pinned_at: pinned ? new Date().toISOString() : null } : x)));
  }
  async function report(m: Msg) {
    const { error: err } = await supabase.from('post_reports').insert({ group_message_id: m.id, reporter_email: user?.email, reason: 'Reported from group chat' });
    setNotice(err ? "Couldn't send the report. Please try again." : 'Thanks. TapIN will review this message.');
  }
  const renderBody = (body: string) => body.split(/(@[\w.-]+)/g).map((part, i) =>
    part.startsWith('@') && members.some((m) => `@${m.name.split(' ')[0]}`.toLowerCase() === part.toLowerCase()) ? <strong key={i} className="text-indigo-700">{part}</strong> : <span key={i}>{part}</span>);

  const pinned = (msgs ?? []).filter((m) => m.pinned_at && !m.deleted_at);
  if (msgs === null) return <div className="mt-4 space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-2xl bg-gray-100" />)}</div>;
  return (
    <div className="flex flex-col">
      {pinned.length > 0 && (
        <div className="sticky top-[calc(4rem+env(safe-area-inset-top,0px))] z-10 mt-2 rounded-2xl border border-amber-200 bg-amber-50 p-2.5 md:top-2">
          {pinned.slice(-3).map((m) => (
            <button key={m.id} onClick={() => document.getElementById(`msg-${m.id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })} className="block w-full truncate py-0.5 text-left text-sm text-amber-900">
              📌 <strong>{nameOf(m.sender_email).name.split(' ')[0]}:</strong> {m.body || (m.attachments?.length ? '📎 Attachment' : '')}
            </button>
          ))}
        </div>
      )}
      {hasMore && <button onClick={loadOlder} className="mx-auto mt-3 text-sm font-medium text-marigold">Load earlier messages</button>}
      {msgs.length === 0 && <p className="mt-10 text-center text-sm text-muted">No messages yet. Say hi 👋</p>}
      <ul className="mt-3 flex flex-col gap-3">
        {msgs.map((m) => {
          const mine = m.sender_email.toLowerCase() === me;
          const who = nameOf(m.sender_email);
          const atts = m.attachments ?? [];
          return (
            <li key={m.id} id={`msg-${m.id}`} className={`flex gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
              {!mine && (who.photo ? <img src={who.photo} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" /> : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600">{who.name.charAt(0)}</span>)}
              <div className={`max-w-[80%] ${mine ? 'items-end text-right' : ''} flex flex-col`}>
                <p className="text-[11px] text-muted">{mine ? 'You' : who.name} · {timeLabel(m.created_at)}{m.pinned_at && !m.deleted_at ? ' · 📌' : ''}</p>
                {m.deleted_at ? <p className="mt-0.5 rounded-2xl bg-gray-100 px-3 py-2 text-sm italic text-gray-500">Message deleted</p> : (
                  <div className="relative mt-0.5">
                    {atts.filter((a) => a.type === 'image').length > 0 && (
                      <div className={`grid gap-1 ${atts.filter((a) => a.type === 'image').length > 1 ? 'grid-cols-2' : ''}`}>
                        {atts.filter((a) => a.type === 'image').map((a) => (
                          <button key={a.url} type="button" onClick={() => setViewer(a.url)} className="overflow-hidden rounded-xl"><img src={a.url} alt="" loading="lazy" className="max-h-64 w-full object-cover" /></button>
                        ))}
                      </div>
                    )}
                    {atts.filter((a) => a.type === 'file').map((a) => (
                      <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-left text-sm">
                        <span className="text-xl" aria-hidden="true">📄</span><span className="min-w-0"><span className="block truncate font-medium text-gray-900">{a.name || 'File'}</span><span className="text-xs text-gray-500">{fmtSize(a.size)}</span></span>
                      </a>
                    ))}
                    {m.body && <p className={`mt-1 whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-left text-sm ${mine ? 'bg-marigold text-white' : 'bg-surface text-bone ring-1 ring-gray-200'}`}>{mine ? m.body : renderBody(m.body)}</p>}
                    <button onClick={() => setMenuFor(menuFor === m.id ? null : m.id)} aria-label="Message options" className={`absolute top-0 ${mine ? '-left-7' : '-right-7'} px-1 text-gray-400`}>⋯</button>
                    {menuFor === m.id && (
                      <div className={`absolute z-20 mt-1 w-40 rounded-xl border border-gray-200 bg-white p-1 text-left shadow-lg ${mine ? 'right-0' : 'left-0'}`} onMouseLeave={() => setMenuFor(null)}>
                        {canModerate && <button onClick={() => { setMenuFor(null); togglePin(m); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">{m.pinned_at ? 'Unpin' : '📌 Pin'}</button>}
                        {m.body && <button onClick={() => { setMenuFor(null); navigator.clipboard?.writeText(m.body); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">Copy text</button>}
                        {(mine || canModerate) && <button onClick={() => { setMenuFor(null); setConfirm({ kind: 'delete', msg: m }); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50">Delete</button>}
                        {!mine && reportable && <button onClick={() => { setMenuFor(null); setConfirm({ kind: 'report', msg: m }); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">Report</button>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <div ref={bottomRef} />
      {notice && <p role="status" className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}

      <form onSubmit={send} className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] mt-4 rounded-2xl border border-gray-200 bg-surface p-2 shadow-sm md:bottom-4">
        {suggestions.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {suggestions.map((s) => <button key={s.email} type="button" onClick={() => insertMention(s)} className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-800">@{s.name}</button>)}
          </div>
        )}
        {files.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {files.map((f, i) => (
              <span key={i} className="relative">
                {f.type.startsWith('image/') ? <img src={URL.createObjectURL(f)} alt="" className="h-14 w-14 rounded-lg object-cover" /> : <span className="flex h-14 max-w-[9rem] items-center gap-1 truncate rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-700">📄 {f.name}</span>}
                <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label="Remove attachment" className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-800 text-xs text-white">×</button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <label className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-xl text-gray-500 hover:bg-gray-100" title="Add photos or files" aria-label="Add photos or files">
            📎<input type="file" multiple accept={`image/*,${FILE_TYPES}`} className="sr-only" onChange={(e) => { pick(e.target.files); e.target.value = ''; }} />
          </label>
          <textarea ref={inputRef} value={text} onChange={(e) => onType(e.target.value)} rows={1} maxLength={4000} placeholder={placeholder}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(min-width: 768px)').matches) { e.preventDefault(); (e.currentTarget.form as HTMLFormElement)?.requestSubmit(); } }}
            className="min-h-[40px] flex-1 resize-none rounded-xl border-0 bg-transparent px-2 py-2 text-base text-bone focus:outline-none" />
          <button type="submit" disabled={sending || (!text.trim() && !files.length)} className="h-10 shrink-0 rounded-xl bg-marigold px-4 text-sm font-semibold text-white disabled:opacity-50">{sending ? '…' : 'Send'}</button>
        </div>
      </form>

      {viewer && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/90 p-4" onClick={() => setViewer(null)} role="dialog" aria-label="Photo">
          <img src={viewer} alt="" className="max-h-[85dvh] max-w-full rounded-lg object-contain" />
          <button onClick={() => setViewer(null)} className="absolute right-4 top-[calc(1rem+env(safe-area-inset-top,0px))] rounded-full bg-white/15 px-3 py-1.5 text-white" aria-label="Close">✕</button>
        </div>
      )}
      {confirm && (
        <ConfirmDialog title={confirm.kind === 'delete' ? 'Delete this message?' : 'Report this message?'} body={confirm.kind === 'delete' ? 'It will show as "Message deleted" for everyone.' : 'TapIN will review it.'}
          confirmLabel={confirm.kind === 'delete' ? 'Delete' : 'Report'} danger={confirm.kind === 'delete'}
          onClose={() => setConfirm(null)} onConfirm={async () => { const c = confirm; setConfirm(null); if (c.kind === 'delete') await del(c.msg); else await report(c.msg); }} />
      )}
    </div>
  );
}
