import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { uploadImage } from '../../lib/business';
import { toast, toastError } from '../../lib/toast';
import HlsVideo from '../feed/HlsVideo';
import Sheet from '../scouting/Sheet';

// Organization albums (Preview): collections of photos and videos (videos from the organization's Feed posts),
// optionally tied to one of its events. Public section on the organization page + a manager for the team.
export interface Album { id: string; title: string; description: string | null; event_id: string | null; event_title: string | null; cover: string | null; photos: number; videos: number }
interface Item { id: string; kind: 'photo' | 'video'; url: string; caption: string | null; post_id: string | null; video_url: string | null; thumbnail: string | null }
const count = (a: Album) => [a.photos ? `${a.photos} photo${a.photos === 1 ? '' : 's'}` : '', a.videos ? `${a.videos} video${a.videos === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ') || 'Empty';

// ---------- Public: the organization page's Albums section ----------
export function OrgAlbumsSection({ orgId }: { orgId: string }) {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [open, setOpen] = useState<Album | null>(null);
  useEffect(() => { supabase.rpc('org_albums_public', { p_org_id: orgId }).then(({ data }) => setAlbums(((data ?? []) as Album[]).filter((a) => a.photos + a.videos > 0))); }, [orgId]);
  if (albums.length === 0) return null;
  return (
    <section className="pb-10">
      <h2 className="text-xl font-bold">Albums</h2>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {albums.map((a) => (
          <button key={a.id} onClick={() => setOpen(a)} className="group text-left">
            <span className="block overflow-hidden rounded-2xl bg-gray-100">
              {a.cover ? <img src={a.cover} alt="" className="aspect-square w-full object-cover transition group-hover:scale-105" loading="lazy" /> : <span className="flex aspect-square w-full items-center justify-center text-3xl">🖼️</span>}
            </span>
            <span className="mt-1.5 block truncate text-sm font-semibold">{a.title}</span>
            <span className="block truncate text-xs opacity-70">{a.event_title ? `${a.event_title} · ` : ''}{count(a)}</span>
          </button>
        ))}
      </div>
      {open && <AlbumViewer album={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

function AlbumViewer({ album, onClose }: { album: Album; onClose: () => void }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [cur, setCur] = useState<number | null>(null);
  useEffect(() => { supabase.rpc('org_album_items', { p_album_id: album.id }).then(({ data }) => setItems((data ?? []) as Item[])); }, [album.id]);
  const it = cur === null || !items ? null : items[cur];
  const step = (d: number) => setCur((c) => (c === null || !items ? c : (c + d + items.length) % items.length));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') (cur === null ? onClose() : setCur(null)); if (cur !== null && e.key === 'ArrowRight') step(1); if (cur !== null && e.key === 'ArrowLeft') step(-1); };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="fixed inset-0 z-[1100] overflow-y-auto bg-white text-gray-900" role="dialog" aria-label={album.title}>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white/95 px-4 py-3 backdrop-blur" style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}>
        <div className="min-w-0"><p className="truncate font-bold">{album.title}</p><p className="truncate text-xs text-gray-500">{album.event_title ? `${album.event_title} · ` : ''}{count(album)}</p></div>
        <button onClick={onClose} className="rounded-full bg-gray-100 px-3 py-1.5 text-sm font-medium" aria-label="Close album">✕</button>
      </div>
      <div className="mx-auto max-w-5xl p-3">
        {album.description && <p className="mb-3 text-sm text-gray-600">{album.description}</p>}
        {items === null ? <p className="p-6 text-center text-sm text-gray-500">Loading…</p> : (
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2">
            {items.map((m, i) => (
              <button key={m.id} onClick={() => setCur(i)} className="relative overflow-hidden rounded-xl bg-gray-100" aria-label={m.caption || (m.kind === 'video' ? 'Video' : `Photo ${i + 1}`)}>
                <img src={m.kind === 'video' ? (m.thumbnail || m.url) : m.url} alt={m.caption ?? ''} className="aspect-square w-full object-cover" loading="lazy" />
                {m.kind === 'video' && <span className="absolute inset-0 flex items-center justify-center"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white">▶</span></span>}
              </button>
            ))}
          </div>
        )}
      </div>
      {it && (
        <div className="fixed inset-0 z-[1101] flex flex-col items-center justify-center bg-black/95 p-4" onClick={() => setCur(null)}>
          <div onClick={(e) => e.stopPropagation()} className="flex max-h-[80dvh] max-w-full items-center justify-center">
            {it.kind === 'video' && it.video_url
              ? <HlsVideo key={it.id} src={it.video_url} shouldLoad shouldPlay muted={false} controls playsInline poster={it.thumbnail ?? undefined} className="max-h-[80dvh] max-w-full rounded-lg" />
              : <img src={it.url} alt={it.caption ?? ''} className="max-h-[80dvh] max-w-full rounded-lg object-contain" />}
          </div>
          {it.caption && <p className="mt-3 max-w-xl text-center text-sm text-white/90">{it.caption}</p>}
          {items && items.length > 1 && (
            <div className="mt-4 flex gap-3" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => step(-1)} className="rounded-full bg-white/15 px-4 py-2 text-white" aria-label="Previous">←</button>
              <span className="self-center text-sm text-white/70">{(cur ?? 0) + 1} / {items.length}</span>
              <button onClick={() => step(1)} className="rounded-full bg-white/15 px-4 py-2 text-white" aria-label="Next">→</button>
            </div>
          )}
          <button onClick={() => setCur(null)} className="absolute right-4 top-[calc(1rem+env(safe-area-inset-top,0px))] rounded-full bg-white/15 px-3 py-1.5 text-white" aria-label="Close">✕</button>
        </div>
      )}
    </div>
  );
}

// ---------- Manage: Organization > Photos > Albums ----------
export function OrgAlbumsManager({ orgId }: { orgId: string }) {
  const [albums, setAlbums] = useState<Album[] | null>(null);
  const [editing, setEditing] = useState<Album | 'new' | null>(null);
  const load = useCallback(() => { supabase.rpc('org_albums_public', { p_org_id: orgId }).then(({ data }) => setAlbums((data ?? []) as Album[])); }, [orgId]);
  useEffect(() => { load(); }, [load]);
  return (
    <section className="mb-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-bone">Albums <span className="ml-1 rounded-full bg-indigo-100 px-2 py-0.5 align-middle text-[10px] font-bold text-marigold">PREVIEW</span></h3>
          <p className="text-sm text-muted">Group photos and videos into collections, like one per event. They show in an Albums section on your page.</p>
        </div>
        <button onClick={() => setEditing('new')} className="shrink-0 rounded-xl bg-marigold px-3 py-2 text-sm font-semibold text-white">+ New album</button>
      </div>
      {albums && albums.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {albums.map((a) => (
            <button key={a.id} onClick={() => setEditing(a)} className="text-left">
              <span className="block overflow-hidden rounded-xl bg-gray-100">{a.cover ? <img src={a.cover} alt="" className="aspect-square w-full object-cover" /> : <span className="flex aspect-square w-full items-center justify-center text-2xl">🖼️</span>}</span>
              <span className="mt-1 block truncate text-sm font-semibold text-bone">{a.title}</span>
              <span className="block truncate text-xs text-muted">{count(a)}</span>
            </button>
          ))}
        </div>
      )}
      {editing && <AlbumEditor orgId={orgId} album={editing === 'new' ? null : editing} onClose={() => { setEditing(null); load(); }} />}
    </section>
  );
}

function AlbumEditor({ orgId, album, onClose }: { orgId: string; album: Album | null; onClose: () => void }) {
  const { user } = useAuth();
  const [id, setId] = useState<string | null>(album?.id ?? null);
  const [title, setTitle] = useState(album?.title ?? '');
  const [desc, setDesc] = useState(album?.description ?? '');
  const [eventId, setEventId] = useState(album?.event_id ?? '');
  const [cover, setCover] = useState<string | null>(album?.cover ?? null);
  const [events, setEvents] = useState<{ id: string; title: string }[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [videos, setVideos] = useState<{ id: string; thumbnail: string | null; caption: string | null }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const loadItems = useCallback(() => { if (id) supabase.rpc('org_album_items', { p_album_id: id }).then(({ data }) => setItems((data ?? []) as Item[])); }, [id]);
  useEffect(() => { loadItems(); }, [loadItems]);
  useEffect(() => { supabase.from('events').select('id, title').eq('organization_id', orgId).order('start_date', { ascending: false }).limit(50).then(({ data }) => setEvents((data ?? []) as typeof events)); }, [orgId]);

  async function saveDetails(): Promise<string | null> {
    if (!title.trim()) { toastError('Give the album a title.'); return null; }
    const row = { org_id: orgId, title: title.trim().slice(0, 80), description: desc.trim().slice(0, 500) || null, event_id: eventId || null, cover_url: cover, created_by: user?.email ?? null };
    if (id) {
      const { error } = await supabase.from('org_albums').update(row).eq('id', id);
      if (error) { toastError(); return null; }
      toast('✓ Album saved'); return id;
    }
    const { data, error } = await supabase.from('org_albums').insert(row).select('id').single();
    if (error || !data) { toastError(); return null; }
    setId((data as { id: string }).id); toast('✓ Album created'); return (data as { id: string }).id;
  }
  async function addPhotos(files: FileList | null) {
    if (!files?.length || !user?.id) return;
    const aid = id ?? await saveDetails(); if (!aid) return;
    setBusy(true);
    let order = items.length;
    let added = 0;
    for (const f of Array.from(files).slice(0, 50)) {
      const r = await uploadImage(user.id, f, 'org-album');
      if (r.error || !r.url) { toastError(r.error ?? "Couldn't upload a photo."); continue; }
      const { error } = await supabase.from('organization_media').insert({ org_id: orgId, album_id: aid, kind: 'photo', url: r.url, sort_order: ++order, created_by: user.email });
      if (error) { toastError(error.message); break; }
      added++;
    }
    setBusy(false);
    if (added) toast(`✓ ${added} photo${added === 1 ? '' : 's'} added`);
    loadItems();
  }
  async function addVideo(v: { id: string; thumbnail: string | null }) {
    const aid = id ?? await saveDetails(); if (!aid) return;
    const { error } = await supabase.from('organization_media').insert({ org_id: orgId, album_id: aid, kind: 'video', post_id: v.id, url: v.thumbnail || 'video', sort_order: items.length + 1, created_by: user?.email ?? null });
    if (error) toastError(error.message); else toast('✓ Video added');
    loadItems();
  }
  async function caption(m: Item) {
    const text = window.prompt('Caption', m.caption ?? '');
    if (text === null) return;
    const { error } = await supabase.from('organization_media').update({ caption: text.trim().slice(0, 200) || null }).eq('id', m.id);
    if (error) toastError(); else toast('✓ Caption saved');
    loadItems();
  }
  async function remove(m: Item) {
    if (!window.confirm(m.kind === 'video' ? 'Remove this video from the album? (The Feed post stays.)' : 'Remove this photo from the album?')) return;
    const { error } = await supabase.from('organization_media').delete().eq('id', m.id);
    if (error) toastError(); else toast(m.kind === 'video' ? 'Video removed' : 'Photo removed');
    if (cover === m.url) setCover(null);
    loadItems();
  }
  async function move(i: number, d: -1 | 1) {
    const j = i + d; if (j < 0 || j >= items.length) return;
    const list = [...items]; [list[i], list[j]] = [list[j], list[i]]; setItems(list);
    await Promise.all(list.map((m, k) => supabase.from('organization_media').update({ sort_order: k + 1 }).eq('id', m.id)));
    toast('✓ Order saved');
  }
  async function makeCover(m: Item) {
    const url = m.kind === 'video' ? (m.thumbnail || m.url) : m.url;
    setCover(url);
    if (id) { const { error } = await supabase.from('org_albums').update({ cover_url: url }).eq('id', id); if (error) toastError(); else toast('✓ Cover set'); }
  }
  async function deleteAlbum() {
    if (!id || !window.confirm(`Delete "${title}"? Its photos and videos are removed from your page (Feed posts stay).`)) return;
    await supabase.from('organization_media').delete().eq('album_id', id);
    const { error } = await supabase.from('org_albums').delete().eq('id', id);
    if (error) toastError(); else { toast('Album deleted'); onClose(); }
  }
  const field = 'mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 sm:text-sm';
  return (
    <Sheet title={album ? 'Edit album' : 'New album'} onClose={onClose} wide>
      <label className="block text-xs font-medium text-gray-500">Title<input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="Through Her Voice 2026" className={field} /></label>
      <label className="mt-3 block text-xs font-medium text-gray-500">Description (optional)<textarea value={desc} maxLength={500} rows={2} onChange={(e) => setDesc(e.target.value)} className={field} /></label>
      <label className="mt-3 block text-xs font-medium text-gray-500">Event (optional)
        <select value={eventId} onChange={(e) => setEventId(e.target.value)} className={field}><option value="">None</option>{events.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}</select>
      </label>
      <button onClick={saveDetails} className="mt-3 rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800">{id ? 'Save details' : 'Create album'}</button>

      <div className="mt-5 flex flex-wrap gap-2">
        <button onClick={() => fileRef.current?.click()} disabled={busy} className="rounded-xl bg-marigold px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Uploading…' : '+ Add photos'}</button>
        <button onClick={() => { if (videos === null) supabase.rpc('org_section_candidates', { p_org_id: orgId }).then(({ data }) => setVideos(((data as { videos?: typeof videos } | null)?.videos ?? []) as NonNullable<typeof videos>)); else setVideos(null); }} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800">+ Add videos from your Feed</button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} />
      </div>
      {videos && (
        videos.length === 0 ? <p className="mt-2 text-sm text-gray-500">No Feed videos from your team or featured people yet.</p> : (
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {videos.map((v) => {
              const added = items.some((m) => m.post_id === v.id);
              return (
                <button key={v.id} disabled={added} onClick={() => addVideo(v)} className="relative overflow-hidden rounded-lg bg-gray-100 disabled:opacity-40" aria-label={`Add video${v.caption ? `: ${v.caption}` : ''}`}>
                  {v.thumbnail ? <img src={v.thumbnail} alt="" className="aspect-square w-full object-cover" /> : <span className="flex aspect-square w-full items-center justify-center">🎬</span>}
                  <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 text-[10px] font-semibold text-white">{added ? 'Added' : '+ Add'}</span>
                </button>
              );
            })}
          </div>
        )
      )}
      {items.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {items.map((m, i) => (
            <li key={m.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="relative">
                <img src={m.kind === 'video' ? (m.thumbnail || m.url) : m.url} alt="" className="aspect-square w-full object-cover" />
                {m.kind === 'video' && <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 text-[10px] font-semibold text-white">Video</span>}
                {cover && cover === (m.kind === 'video' ? (m.thumbnail || m.url) : m.url) && <span className="absolute right-1 top-1 rounded bg-marigold px-1.5 text-[10px] font-semibold text-white">Cover</span>}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-x-2 px-2 py-1 text-[11px]">
                <button onClick={() => caption(m)} className="font-medium text-marigold">{m.caption ? 'Caption ✓' : 'Caption'}</button>
                <button onClick={() => makeCover(m)} className="text-gray-600">Cover</button>
                <span className="flex">
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="px-1 text-gray-500 disabled:opacity-30" aria-label="Move earlier">←</button>
                  <button onClick={() => move(i, 1)} disabled={i === items.length - 1} className="px-1 text-gray-500 disabled:opacity-30" aria-label="Move later">→</button>
                  <button onClick={() => remove(m)} className="px-1 text-gray-400 hover:text-red-600" aria-label="Remove">✕</button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {id && <button onClick={deleteAlbum} className="mt-6 text-sm text-red-600">Delete album</button>}
    </Sheet>
  );
}
