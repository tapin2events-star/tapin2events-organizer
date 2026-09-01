import { useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

interface ImageUploadProps {
  currentUrl: string | null;
  onUploaded: (url: string) => void;
  /** Groups uploads by feature, e.g. 'resources', 'events'. Combined with
   *  the uploader's own id to form the storage path. */
  pathPrefix: string;
  label?: string;
}

export default function ImageUpload({ currentUrl, onUploaded, pathPrefix, label = 'Photo' }: ImageUploadProps) {
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
    onUploaded(data.publicUrl);
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-gray-700">{label}</p>
      <div className="flex items-center gap-4">
        {currentUrl ? (
          <img src={currentUrl} alt="" className="h-20 w-20 rounded-lg object-cover" />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-400">
            No photo
          </div>
        )}
        <div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-marigold hover:text-marigold disabled:opacity-50"
          >
            {uploading ? 'Uploading…' : currentUrl ? 'Change photo' : 'Upload photo'}
          </button>
          <input ref={inputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          <p className="mt-1 text-xs text-gray-400">JPG or PNG, up to 5MB</p>
        </div>
      </div>
      {error && <p className="text-xs text-magenta">{error}</p>}
    </div>
  );
}
