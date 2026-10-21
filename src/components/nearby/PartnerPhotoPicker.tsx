import { useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { webSafeImage } from '../../lib/webImage';
import PhotoCropper from '../PhotoCropper';

// A local business adds its own photo from its invite page (no account; the private invite link is the permission).
// Shown on its perk (event page and tickets) and on its spot in Make a night of it.
const toDataUrl = (b: Blob) => new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(new Error("Couldn't read the photo.")); r.readAsDataURL(b); });

export default function PartnerPhotoPicker({ token, url, onChange }: { token: string; url: string | null | undefined; onChange: (url: string | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function send(body: Record<string, unknown>) {
    setBusy(true); setErr(null);
    const { data, error } = await supabase.functions.invoke('partner-photo', { body: { token, ...body } });
    let msg: string | null = data?.error ?? null;
    if (!msg && error) { try { msg = (await (error as { context?: Response }).context?.json())?.error ?? 'Something went wrong.'; } catch { msg = 'Something went wrong.'; } }
    setBusy(false);
    if (msg) setErr(msg); else onChange(data?.photo_url ?? null);
  }
  return (
    <div className="mt-4 rounded-xl border border-dashed border-gray-300 p-3">
      <div className="flex items-center gap-3">
        {url ? <img src={url} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" /> : <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xl" aria-hidden="true">📷</div>}
        <div className="min-w-0 text-sm">
          <p className="font-medium text-gray-800">{url ? 'Your photo' : 'Add a photo of your business'} <span className="font-normal text-gray-400">(optional)</span></p>
          <p className="text-xs text-gray-500">Shown with your perk on the event page and guests&apos; tickets.</p>
          <div className="mt-1 flex gap-3">
            <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="text-sm font-semibold text-[#0F1B3D] underline disabled:opacity-50">{busy ? 'Saving…' : url ? 'Change' : 'Choose photo'}</button>
            {url && !busy && <button type="button" onClick={() => send({ remove: true })} className="text-sm text-gray-500">Remove</button>}
          </div>
        </div>
      </div>
      {err && <p role="alert" className="mt-2 text-xs text-red-600">{err}</p>}
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={async (e) => {
        const f = e.target.files?.[0]; e.target.value = '';
        if (!f) return;
        try { const safe = await webSafeImage(f); setSrc(URL.createObjectURL(safe)); } catch (x) { setErr((x as Error).message); }
      }} />
      {src && <PhotoCropper src={src} shape="square" onCancel={() => { URL.revokeObjectURL(src); setSrc(null); }} onDone={async (blob) => {
        URL.revokeObjectURL(src); setSrc(null);
        try { await send({ image: await toDataUrl(blob) }); } catch (x) { setErr((x as Error).message); }
      }} />}
    </div>
  );
}
