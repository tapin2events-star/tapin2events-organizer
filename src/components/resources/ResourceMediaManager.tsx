import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { parseMediaLink, SUPPORTED_PLATFORMS } from '../../lib/mediaEmbeds';
import type { ResourceAlbum, ResourceMedia } from '../../lib/types';
import MediaPlayer from './MediaPlayer';

const MAX_LINKS = 12;
const MAX_ALBUMS = 10;
const MAX_PHOTOS_PER_ALBUM = 60;
const STORAGE_MARKER = '/storage/v1/object/public/user-uploads/';

// Shrinks a photo before upload (max 2000px, JPEG) so a 12 MB phone photo
// becomes a few hundred KB: faster pages and far less storage.
async function resizeImage(file: File, maxDim = 2000): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', 0.85));
}

function storagePath(url: string) {
  const i = url.indexOf(STORAGE_MARKER);
  return i >= 0 ? decodeURIComponent(url.slice(i + STORAGE_MARKER.length)) : null;
}

export default function ResourceMediaManager({ resourceId }: { resourceId: string }) {
  const { user } = useAuth();
  const [items, setItems] = useState<ResourceMedia[]>([]);
  const [albums, setAlbums] = useState<ResourceAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [newAlbumTitle, setNewAlbumTitle] = useState('');
  const [albumError, setAlbumError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<{ albumId: string; done: number; total: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function load() {
    const [{ data: m }, { data: a }] = await Promise.all([
      supabase.from('resource_media').select('*').eq('resource_id', resourceId).order('display_order', { ascending: true }),
      supabase.from('resource_albums').select('*').eq('resource_id', resourceId).order('display_order', { ascending: true }),
    ]);
    setItems((m ?? []) as ResourceMedia[]);
    setAlbums((a ?? []) as ResourceAlbum[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceId]);

  const links = items.filter((i) => i.media_type === 'embed');
  const photosIn = (albumId: string) => items.filter((i) => i.media_type === 'photo' && i.album_id === albumId);
  const nextOrder = (list: { display_order: number }[]) => (list.length ? Math.max(...list.map((x) => x.display_order)) + 1 : 0);

  // ---------- Music & video links ----------
  async function addLink() {
    setLinkError(null);
    const parsed = parseMediaLink(linkUrl);
    if (!parsed) {
      setLinkError(`That link isn't supported. Paste a link from ${SUPPORTED_PLATFORMS}.`);
      return;
    }
    if (links.length >= MAX_LINKS) {
      setLinkError(`You can add up to ${MAX_LINKS} links.`);
      return;
    }
    const url = linkUrl.trim().replace(/^http:\/\//i, 'https://');
    const { error } = await supabase.from('resource_media').insert({
      resource_id: resourceId,
      media_type: 'embed',
      media_url: url,
      caption: linkTitle.trim() || null,
      display_order: nextOrder(links),
    });
    if (error) {
      setLinkError('Could not add that link. Please try again.');
      return;
    }
    setLinkUrl('');
    setLinkTitle('');
    load();
  }

  async function moveLink(index: number, dir: -1 | 1) {
    const a = links[index];
    const b = links[index + dir];
    if (!a || !b) return;
    await Promise.all([
      supabase.from('resource_media').update({ display_order: b.display_order }).eq('id', a.id),
      supabase.from('resource_media').update({ display_order: a.display_order }).eq('id', b.id),
    ]);
    load();
  }

  async function removeItem(id: string) {
    await supabase.from('resource_media').delete().eq('id', id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  // ---------- Photo albums ----------
  async function createAlbum() {
    setAlbumError(null);
    const title = newAlbumTitle.trim();
    if (!title) return;
    if (albums.length >= MAX_ALBUMS) {
      setAlbumError(`You can have up to ${MAX_ALBUMS} albums.`);
      return;
    }
    const { error } = await supabase.from('resource_albums').insert({ resource_id: resourceId, title: title.slice(0, 60), display_order: nextOrder(albums) });
    if (error) {
      setAlbumError('Could not create that album. Please try again.');
      return;
    }
    setNewAlbumTitle('');
    load();
  }

  async function renameAlbum(album: ResourceAlbum, title: string) {
    const t = title.trim().slice(0, 60);
    if (!t || t === album.title) return;
    await supabase.from('resource_albums').update({ title: t }).eq('id', album.id);
    setAlbums((prev) => prev.map((a) => (a.id === album.id ? { ...a, title: t } : a)));
  }

  async function deleteAlbum(album: ResourceAlbum) {
    const photos = photosIn(album.id);
    if (!window.confirm(`Delete the album "${album.title}"${photos.length ? ` and its ${photos.length} photo${photos.length === 1 ? '' : 's'}` : ''}? This can't be undone.`)) return;
    const paths = photos.map((p) => storagePath(p.media_url)).filter((p): p is string => !!p);
    if (paths.length) await supabase.storage.from('user-uploads').remove(paths);
    await supabase.from('resource_albums').delete().eq('id', album.id); // photos cascade
    load();
  }

  async function addPhotos(album: ResourceAlbum, files: FileList) {
    if (!user) return;
    setUploadError(null);
    const existing = photosIn(album.id);
    const room = MAX_PHOTOS_PER_ALBUM - existing.length;
    const list = Array.from(files).filter((f) => f.type.startsWith('image/')).slice(0, Math.max(room, 0));
    if (list.length === 0) {
      setUploadError(room <= 0 ? `Albums can hold up to ${MAX_PHOTOS_PER_ALBUM} photos.` : 'Please choose image files.');
      return;
    }
    let order = nextOrder(existing);
    let failed = 0;
    setUploading({ albumId: album.id, done: 0, total: list.length });
    for (let i = 0; i < list.length; i++) {
      try {
        const blob = await resizeImage(list[i]);
        const path = `${user.id}/resource-albums/${album.id}/${Date.now()}-${i}.jpg`;
        const { error: upErr } = await supabase.storage.from('user-uploads').upload(path, blob, { contentType: 'image/jpeg' });
        if (upErr) throw upErr;
        const url = supabase.storage.from('user-uploads').getPublicUrl(path).data.publicUrl;
        const { error: insErr } = await supabase.from('resource_media').insert({ resource_id: resourceId, album_id: album.id, media_type: 'photo', media_url: url, display_order: order++ });
        if (insErr) throw insErr;
      } catch {
        failed++;
      }
      setUploading({ albumId: album.id, done: i + 1, total: list.length });
    }
    setUploading(null);
    if (failed) setUploadError(`${failed} photo${failed === 1 ? '' : 's'} couldn't be uploaded. Try a JPG or PNG.`);
    load();
  }

  async function saveCaption(photo: ResourceMedia, caption: string) {
    const c = caption.trim().slice(0, 200) || null;
    if (c === photo.caption) return;
    await supabase.from('resource_media').update({ caption: c }).eq('id', photo.id);
    setItems((prev) => prev.map((i) => (i.id === photo.id ? { ...i, caption: c } : i)));
  }

  async function makeCover(photo: ResourceMedia, albumId: string) {
    const min = Math.min(...photosIn(albumId).map((p) => p.display_order));
    await supabase.from('resource_media').update({ display_order: min - 1 }).eq('id', photo.id);
    load();
  }

  async function deletePhoto(photo: ResourceMedia) {
    const path = storagePath(photo.media_url);
    if (path) await supabase.storage.from('user-uploads').remove([path]);
    removeItem(photo.id);
  }

  if (loading) return <p className="text-gray-500">Loading…</p>;

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="font-display text-lg font-semibold text-gray-900">Music & video</h2>
        <p className="text-sm text-gray-500">
          Paste a link from {SUPPORTED_PLATFORMS}. It shows as a player on your profile, so organizers can listen or watch without leaving TapIN.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://open.spotify.com/album/…" className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-base text-gray-900" />
          <input value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} maxLength={200} placeholder="Title (optional)" className="rounded-lg border border-gray-300 px-3 py-2 text-base text-gray-900 sm:w-48" />
          <button type="button" onClick={addLink} disabled={!linkUrl.trim()} className="rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Add</button>
        </div>
        {linkError && <p className="mt-1 text-sm text-magenta">{linkError}</p>}
        {links.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {links.map((l, i) => {
              const parsed = parseMediaLink(l.media_url);
              return (
                <div key={l.id} className="rounded-xl border border-gray-200 bg-white p-3">
                  <div className="flex items-center gap-3">
                    <span className="shrink-0 rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-marigold">{parsed?.label ?? 'Link'}</span>
                    <p className="min-w-0 flex-1 truncate text-sm text-gray-900">{l.caption || l.media_url}</p>
                    <div className="flex shrink-0 items-center gap-1">
                      {parsed?.embedUrl && (
                        <button type="button" onClick={() => setPreviewId(previewId === l.id ? null : l.id)} className="rounded px-2 py-1 text-xs font-medium text-marigold hover:bg-indigo-50">
                          {previewId === l.id ? 'Hide' : 'Preview'}
                        </button>
                      )}
                      <button type="button" onClick={() => moveLink(i, -1)} disabled={i === 0} aria-label="Move up" className="rounded px-1.5 py-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30">↑</button>
                      <button type="button" onClick={() => moveLink(i, 1)} disabled={i === links.length - 1} aria-label="Move down" className="rounded px-1.5 py-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30">↓</button>
                      <button type="button" onClick={() => removeItem(l.id)} className="rounded px-2 py-1 text-xs font-medium text-magenta hover:bg-red-50">Remove</button>
                    </div>
                  </div>
                  {previewId === l.id && parsed && <div className="mt-3"><MediaPlayer embed={parsed} url={l.media_url} /></div>}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-gray-900">Photo albums</h2>
        <p className="text-sm text-gray-500">Group photos into albums, like "Live shows" or "Past events." The first photo is the album cover.</p>
        <div className="mt-3 flex gap-2">
          <input value={newAlbumTitle} onChange={(e) => setNewAlbumTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), createAlbum())} maxLength={60} placeholder="New album name" className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-base text-gray-900" />
          <button type="button" onClick={createAlbum} disabled={!newAlbumTitle.trim()} className="rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Create album</button>
        </div>
        {albumError && <p className="mt-1 text-sm text-magenta">{albumError}</p>}
        {uploadError && <p className="mt-1 text-sm text-magenta">{uploadError}</p>}

        <div className="mt-4 flex flex-col gap-4">
          {albums.map((album) => {
            const photos = photosIn(album.id);
            const busy = uploading?.albumId === album.id;
            return (
              <div key={album.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-center gap-2">
                  <input defaultValue={album.title} onBlur={(e) => renameAlbum(album, e.target.value)} maxLength={60} aria-label="Album name" className="min-w-0 flex-1 rounded-lg border border-transparent px-2 py-1 font-semibold text-gray-900 hover:border-gray-200 focus:border-marigold" />
                  <span className="shrink-0 text-xs text-gray-500">{photos.length} photo{photos.length === 1 ? '' : 's'}</span>
                  <button type="button" onClick={() => deleteAlbum(album)} className="shrink-0 rounded px-2 py-1 text-xs font-medium text-magenta hover:bg-red-50">Delete album</button>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {photos.map((p, pi) => (
                    <div key={p.id} className="group relative">
                      <img src={p.media_url} alt={p.caption ?? ''} className="aspect-square w-full rounded-lg object-cover" />
                      {pi === 0 && <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 text-[10px] font-semibold text-white">Cover</span>}
                      <div className="absolute right-1 top-1 flex gap-1">
                        {pi !== 0 && (
                          <button type="button" onClick={() => makeCover(p, album.id)} className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">Make cover</button>
                        )}
                        <button type="button" onClick={() => deletePhoto(p)} aria-label="Delete photo" className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">✕</button>
                      </div>
                      <input defaultValue={p.caption ?? ''} onBlur={(e) => saveCaption(p, e.target.value)} maxLength={200} placeholder="Caption" className="mt-1 w-full rounded border border-gray-200 px-1.5 py-1 text-xs text-gray-900" />
                    </div>
                  ))}
                  {photos.length < MAX_PHOTOS_PER_ALBUM && (
                    <label className={`flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 text-center text-xs text-gray-500 hover:border-marigold ${busy ? 'pointer-events-none opacity-60' : ''}`}>
                      <span className="text-xl">＋</span>
                      {busy ? `Uploading ${uploading!.done} of ${uploading!.total}…` : 'Add photos'}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        disabled={!!uploading}
                        onChange={(e) => {
                          const files = e.target.files;
                          if (files?.length) addPhotos(album, files);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
        <p className="font-semibold text-gray-900">Videos on TapIN</p>
        <p className="mt-0.5">Videos you post to the TapIN feed show up on your profile automatically. <Link to="/feed" className="font-medium text-marigold">Post a video &rarr;</Link></p>
      </section>
    </div>
  );
}
