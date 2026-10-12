import { useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { uploadImage } from '../../lib/business';

// A small image field: shows the current image, uploads a new one, or removes it.
export default function ImagePicker({ value, onChange, label, shape = 'square', hint }: { value: string | null; onChange: (url: string | null) => void; label: string; shape?: 'square' | 'wide' | 'round'; hint?: string }) {
  const { user } = useAuth();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = shape === 'wide' ? 'h-24 w-full sm:w-64' : shape === 'round' ? 'h-20 w-20 rounded-full' : 'h-20 w-20';
  return (
    <div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <div className="mt-1 flex items-center gap-3">
        <button type="button" onClick={() => ref.current?.click()} className={`flex shrink-0 items-center justify-center overflow-hidden ${shape === 'round' ? 'rounded-full' : 'rounded-xl'} border border-dashed border-gray-300 bg-gray-50 ${box}`}>
          {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <span className="text-xs text-gray-400">{busy ? 'Uploading…' : '+ Add'}</span>}
        </button>
        <div className="text-xs text-gray-500">
          <button type="button" onClick={() => ref.current?.click()} className="font-medium text-marigold">{value ? 'Change' : 'Upload'}</button>
          {value && <> · <button type="button" onClick={() => onChange(null)} className="text-gray-400 hover:text-red-600">Remove</button></>}
          {hint && <p className="mt-0.5 text-gray-400">{hint}</p>}
          {error && <p className="mt-0.5 text-red-600">{error}</p>}
        </div>
      </div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={async (e) => {
        const f = e.target.files?.[0]; e.target.value = '';
        if (!f || !user?.id) return;
        setBusy(true); setError(null);
        const r = await uploadImage(user.id, f, label.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
        setBusy(false);
        if (r.error) setError(r.error); else onChange(r.url ?? null);
      }} />
    </div>
  );
}
