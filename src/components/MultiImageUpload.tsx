import { useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_PHOTOS = 6;

interface MultiImageUploadProps {
  urls: string[];
  onChange: (urls: string[]) => void;
  pathPrefix: string;
  label?: string;
}

export default function MultiImageUpload({ urls, onChange, pathPrefix, label = 'Photos' }: MultiImageUploadProps) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file || !user?.id) return;

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError('Image must be under 5MB.');
      return;
    }
    if (urls.length >= MAX_PHOTOS) {
      setError(`You can add up to ${MAX_PHOTOS} photos.`);
      return;
    }

    setUploading(true);
    setError(null);

    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${user.id}/${pathPrefix}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('user-uploads')
      .upload(path, file, { contentType: file.type, upsert: false });

    setUploading(false);
    if (uploadError) {
      setError('Upload failed. Please try again.');
      return;
    }

    const { data } = supabase.storage.from('user-uploads').getPublicUrl(path);
    onChange([...urls, data.publicUrl]);
  }

  function removePhoto(index: number) {
    onChange(urls.filter((_, i) => i !== index));
  }

  function makeCover(index: number) {
    if (index === 0) return;
    const next = [...urls];
    const [picked] = next.splice(index, 1);
    next.unshift(picked);
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-gray-700">{label} <span className="font-normal text-gray-400">(first photo is the cover)</span></p>
      <div className="flex flex-wrap gap-3">
        {urls.map((url, i) => (
          <div key={url} className="group relative">
            <img src={url} alt="" className={`h-20 w-20 rounded-lg object-cover ${i === 0 ? 'ring-2 ring-marigold' : ''}`} />
            <button
              type="button"
              onClick={() => removePhoto(i)}
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-magenta text-xs text-white opacity-0 group-hover:opacity-100"
            >
              ✕
            </button>
            {i !== 0 && (
              <button
                type="button"
                onClick={() => makeCover(i)}
                className="absolute inset-x-0 bottom-0 rounded-b-lg bg-black/60 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100"
              >
                Make cover
              </button>
            )}
          </div>
        ))}
        {urls.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 text-xs text-gray-400 hover:border-marigold hover:text-marigold disabled:opacity-50"
          >
            {uploading ? '…' : '+ Add'}
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
      <p className="text-xs text-gray-400">JPG or PNG, up to 5MB each, {MAX_PHOTOS} max</p>
      {error && <p className="text-xs text-magenta">{error}</p>}
    </div>
  );
}
