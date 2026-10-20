import { useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { uploadImage } from '../../lib/business';
import PhotoCropper from '../PhotoCropper';

// A small image field: shows the current image, uploads a new one, or removes it.
export default function ImagePicker({ value, onChange, label, shape = 'square', hint, crop = false }: { value: string | null; onChange: (url: string | null) => void; label: string; shape?: 'square' | 'wide' | 'round'; hint?: string; crop?: boolean }) {
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropName, setCropName] = useState('photo');
  const { user } = useAuth();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wide = shape === 'wide';
  const box = wide ? 'h-32 w-full sm:h-24 sm:w-64' : shape === 'round' ? 'h-20 w-20 rounded-full' : 'h-20 w-20';
  return (
    <div className={`min-w-0 ${wide ? 'w-full sm:w-auto' : ''}`}>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <div className={`mt-1 flex gap-3 ${wide ? 'flex-col items-stretch sm:flex-row sm:items-center' : 'items-center'}`}>
        <button type="button" onClick={() => ref.current?.click()} className={`flex shrink-0 items-center justify-center overflow-hidden ${shape === 'round' ? 'rounded-full' : 'rounded-xl'} border border-dashed border-gray-300 bg-gray-50 ${box}`}>
          {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <span className="text-xs text-gray-400">{busy ? 'Uploading…' : '+ Add'}</span>}
        </button>
        <div className="min-w-0 text-xs text-gray-500">
          <button type="button" onClick={() => ref.current?.click()} className="font-medium text-marigold">{value ? 'Change' : 'Upload'}</button>
          {value && crop && !/\.svg(\?|$)/i.test(value) && <> · <button type="button" onClick={() => setCropSrc(value)} className="font-medium text-marigold">Adjust</button></>}
          {value && <> · <button type="button" onClick={() => onChange(null)} className="text-gray-400 hover:text-red-600">Remove</button></>}
          {hint && <p className="mt-0.5 text-gray-400">{hint}</p>}
          {error && <p className="mt-0.5 text-red-600">{error}</p>}
        </div>
      </div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={async (e) => {
        const f = e.target.files?.[0]; e.target.value = '';
        if (!f || !user?.id) return;
        // Adjust photo first (SVG logos skip it; they scale perfectly as they are).
        if (crop && !/svg/i.test(f.type)) {
          try { const { webSafeImage } = await import('../../lib/webImage'); const safe = await webSafeImage(f); setCropName(safe.name); setCropSrc(URL.createObjectURL(safe)); } catch (err) { setError((err as Error).message); }
          return;
        }
        setBusy(true); setError(null);
        const r = await uploadImage(user.id, f, label.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
        setBusy(false);
        if (r.error) setError(r.error); else onChange(r.url ?? null);
      }} />
      {cropSrc && <PhotoCropper src={cropSrc} shape={shape === 'wide' ? 'cover' : shape === 'round' ? 'round' : 'square'} png={shape === 'square'}
        onCancel={() => { if (cropSrc.startsWith('blob:')) URL.revokeObjectURL(cropSrc); setCropSrc(null); }}
        onDone={async (blob) => {
          if (cropSrc.startsWith('blob:')) URL.revokeObjectURL(cropSrc);
          setCropSrc(null);
          if (!user?.id) return;
          setBusy(true); setError(null);
          const png = shape === 'square';
          const file = new File([blob], cropName.replace(/\.[a-z0-9]+$/i, '') + (png ? '.png' : '.jpg'), { type: png ? 'image/png' : 'image/jpeg' });
          const r = await uploadImage(user.id, file, label.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
          setBusy(false);
          if (r.error) setError(r.error); else onChange(r.url ?? null);
        }} />}
    </div>
  );
}
