import { useRef, useState } from 'react';
import { webSafeImage } from '../lib/webImage';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import PhotoCropper, { type CropShape } from './PhotoCropper';

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_CROP_INPUT_BYTES = 20 * 1024 * 1024; // originals can be bigger when they're cropped (the saved photo is small)

interface ImageUploadProps {
  currentUrl: string | null;
  onUploaded: (url: string) => void;
  /** Groups uploads by feature, e.g. 'resources', 'events'. Combined with
   *  the uploader's own id to form the storage path. */
  pathPrefix: string;
  label?: string;
  /** Adjust photo: position and zoom inside a circle (profile photos), square (logos) or wide frame (covers). */
  crop?: CropShape;
}

export default function ImageUpload({ currentUrl, onUploaded, pathPrefix, label = 'Photo', crop }: ImageUploadProps) {
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    let file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file || !user?.id) return;

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    try { file = await webSafeImage(file); } catch (e) { setError((e as Error).message); return; }
    if (crop) {
      // Adjust first; the cropped photo is what's uploaded.
      if (file.size > MAX_CROP_INPUT_BYTES) { setError('Image must be under 20MB.'); return; }
      setError(null);
      setCropSrc(URL.createObjectURL(file));
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError('Image must be under 5MB.');
      return;
    }

    await upload(file, file.name.split('.').pop() || 'jpg', file.type);
  }

  async function upload(file: Blob, ext: string, type: string) {
    if (!user?.id) return;
    setUploading(true);
    setError(null);

    const path = `${user.id}/${pathPrefix}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('user-uploads')
      .upload(path, file, { contentType: type, upsert: false });

    setUploading(false);
    if (uploadError) {
      setError('Upload failed. Please try again.');
      return;
    }

    const { data } = supabase.storage.from('user-uploads').getPublicUrl(path);
    onUploaded(data.publicUrl);
  }

  async function saveCrop(blob: Blob) {
    if (cropSrc?.startsWith('blob:')) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    await upload(blob, 'jpg', 'image/jpeg');
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-gray-700">{label}</p>
      <div className="flex items-center gap-4">
        {currentUrl ? (
          <img src={currentUrl} alt="" className={`${crop === 'cover' ? 'h-20 w-36' : 'h-20 w-20'} ${crop === 'round' ? 'rounded-full' : 'rounded-lg'} object-cover`} />
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
          {crop && currentUrl && !uploading && (
            <button type="button" onClick={() => setCropSrc(currentUrl)} className="ml-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-marigold hover:text-marigold">Adjust photo</button>
          )}
          <input ref={inputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          <p className="mt-1 text-xs text-gray-400">JPG or PNG, up to 5MB</p>
        </div>
      </div>
      {error && <p className="text-xs text-magenta">{error}</p>}
      {cropSrc && <PhotoCropper src={cropSrc} shape={crop} onCancel={() => { if (cropSrc.startsWith('blob:')) URL.revokeObjectURL(cropSrc); setCropSrc(null); }} onDone={saveCrop} />}
    </div>
  );
}
