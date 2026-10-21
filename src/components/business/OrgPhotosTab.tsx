import { useCallback, useEffect, useState } from 'react';
import { toast, toastSaved, toastError } from '../../lib/toast';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { uploadImage } from '../../lib/business';

const LIMIT = 24;
interface Photo { id: string; url: string; caption: string | null; sort_order: number }

// Organization > Photos (Owners, Admins, Editors): a free gallery of up to 24 photos on the public page.
export default function OrgPhotosTab({ orgId }: { orgId: string }) {
  const { user } = useAuth();
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    const { data } = await supabase.from('organization_media').select('id, url, caption, sort_order').eq('org_id', orgId).order('sort_order').order('created_at');
    setPhotos((data ?? []) as Photo[]);
  }, [orgId]);
  useEffect(() => { load(); }, [load]);

  async function add(files: FileList | null) {
    if (!files?.length || !user?.id) return;
    setBusy(true); setErr(null);
    const room = LIMIT - (photos?.length ?? 0);
    const list = Array.from(files).slice(0, Math.max(0, room));
    if (files.length > list.length) setErr(`Only ${room} more photo${room === 1 ? '' : 's'} fit (up to ${LIMIT}).`);
    let order = (photos ?? []).reduce((m, p) => Math.max(m, p.sort_order), 0);
    for (const f of list) {
      const r = await uploadImage(user.id, f, 'org-photo');
      if (r.error || !r.url) { setErr(r.error ?? 'Upload failed.'); continue; }
      order += 1;
      const { error } = await supabase.from('organization_media').insert({ org_id: orgId, url: r.url, sort_order: order, created_by: user.email });
      if (error) toastError("Couldn't add the photo."); else toast('✓ Photo added');
      if (error) { setErr(error.message.includes('24') ? `You can add up to ${LIMIT} photos.` : "Couldn't save a photo."); break; }
    }
    setBusy(false);
    load();
  }
  async function caption(p: Photo, text: string) {
    const { error: cErr } = await supabase.from('organization_media').update({ caption: text.trim().slice(0, 200) || null }).eq('id', p.id);
    if (cErr) toastError(); else toastSaved('Caption');
  }
  async function remove(p: Photo) {
    if (!window.confirm('Remove this photo?')) return;
    const { error: dErr } = await supabase.from('organization_media').delete().eq('id', p.id);
    if (dErr) toastError("Couldn't remove the photo."); else toast('Photo removed');
    load();
  }
  async function move(i: number, dir: -1 | 1) {
    if (!photos) return;
    const j = i + dir;
    if (j < 0 || j >= photos.length) return;
    const a = photos[i], b = photos[j];
    await Promise.all([
      supabase.from('organization_media').update({ sort_order: b.sort_order === a.sort_order ? a.sort_order + dir : b.sort_order }).eq('id', a.id),
      supabase.from('organization_media').update({ sort_order: a.sort_order }).eq('id', b.id),
    ]);
    toastSaved('Order');
    load();
  }

  const full = (photos?.length ?? 0) >= LIMIT;
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">Photos show in a gallery on your public page: past events, your team, your space. {photos ? `${photos.length} of ${LIMIT}` : ''}</p>
        <label className={`inline-flex min-h-[44px] cursor-pointer items-center rounded-xl px-4 text-sm font-semibold text-white ${full || busy ? 'pointer-events-none bg-gray-300' : 'bg-marigold'}`}>
          {busy ? 'Uploading…' : '+ Add photos'}
          <input type="file" accept="image/*" multiple className="sr-only" disabled={full || busy} onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
        </label>
      </div>
      {err && <p role="alert" className="mt-2 text-sm text-red-600">{err}</p>}
      {photos === null ? <div className="mt-4 h-32 animate-pulse rounded-2xl bg-gray-100" /> : photos.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-muted">No photos yet. Add a few from past events to bring your page to life.</p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((p, i) => (
            <li key={p.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
              <img src={p.url} alt={p.caption ?? ''} className="aspect-square w-full object-cover" />
              <div className="p-2">
                <input defaultValue={p.caption ?? ''} onBlur={(e) => caption(p, e.target.value)} placeholder="Caption (optional)" maxLength={200} className="w-full min-w-0 rounded-lg border border-gray-200 px-2 py-1.5 text-sm" />
                <div className="mt-1.5 flex items-center justify-between text-xs">
                  <span className="flex gap-1">
                    <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move earlier" className="rounded px-2 py-1 text-gray-600 disabled:opacity-30">←</button>
                    <button onClick={() => move(i, 1)} disabled={i === photos.length - 1} aria-label="Move later" className="rounded px-2 py-1 text-gray-600 disabled:opacity-30">→</button>
                  </span>
                  <button onClick={() => remove(p)} className="px-2 py-1 text-gray-400 hover:text-red-600">Remove</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-muted">Video uploads and a featured highlight reel are coming with the Business plan.</p>
    </div>
  );
}
