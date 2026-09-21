import { useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';

export default function CreatePostModal({ onClose, onPosted }: { onClose: () => void; onPosted: () => void }) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [posterType, setPosterType] = useState<'organizer' | 'resource'>('organizer');
  const [stage, setStage] = useState<'pick' | 'uploading' | 'processing' | 'error'>('pick');
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
  }

  async function handlePost() {
    if (!file || !user?.email) return;
    setStage('uploading');
    setError(null);

    // Step 1: ask our own backend for a signed Gumlet upload URL -- the
    // Gumlet API key never touches the browser.
    const { data: uploadData, error: uploadInitError } = await supabase.functions.invoke('create-gumlet-upload', { body: {} });
    if (uploadInitError || !uploadData?.upload_url) {
      setError('Could not start the upload. Please try again.');
      setStage('error');
      return;
    }

    // Step 2: upload the actual file straight to Gumlet's storage.
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadData.upload_url);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('Upload failed')));
        xhr.onerror = () => reject(new Error('Upload failed'));
        xhr.send(file);
      });
    } catch {
      setError('The video upload failed partway through. Please try again.');
      setStage('error');
      return;
    }

    // Step 3: Gumlet needs a little time to transcode -- poll until ready.
    setStage('processing');
    const assetId = uploadData.asset_id;
    let playbackUrl: string | null = null;
    let thumbnailUrl: string | null = null;
    for (let attempt = 0; attempt < 60; attempt++) {
      await new Promise((r) => setTimeout(r, 3000));
      const { data: statusData } = await supabase.functions.invoke('check-gumlet-asset-status', { body: { asset_id: assetId } });
      if (statusData?.status === 'ready') {
        playbackUrl = statusData.playback_url;
        thumbnailUrl = statusData.thumbnail_url;
        break;
      }
      if (statusData?.status === 'error' || statusData?.status === 'errored') {
        setError('Gumlet had trouble processing this video. Please try a different file.');
        setStage('error');
        return;
      }
    }

    if (!playbackUrl) {
      setError('This video is taking longer than expected to process. It may still finish in the background -- check back shortly.');
      setStage('error');
      return;
    }

    // Step 4: the post only becomes visible in the feed once we have a
    // real, working playback URL -- never before.
    const { error: insertError } = await supabase.from('posts').insert({
      author_email: user.email,
      poster_type: posterType,
      caption: caption.trim() || null,
      video_url: playbackUrl,
      gumlet_asset_id: assetId,
      thumbnail_url: thumbnailUrl,
    });
    if (insertError) {
      setError('Your video processed successfully, but saving the post failed. Please try again.');
      setStage('error');
      return;
    }

    onPosted();
  }

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-surface p-5">
        <div className="flex items-center justify-between">
          <p className="font-display text-lg font-bold text-bone">New Post</p>
          <button onClick={onClose} className="text-muted">✕</button>
        </div>

        {stage === 'pick' && (
          <div className="mt-4 flex flex-col gap-3">
            {previewUrl ? (
              <video src={previewUrl} className="max-h-64 w-full rounded-xl bg-black object-contain" controls />
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 text-muted"
              >
                <span className="text-3xl">🎥</span>
                Choose a video
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileSelect} className="hidden" />
            {previewUrl && (
              <button onClick={() => fileInputRef.current?.click()} className="text-sm text-marigold">Choose a different video</button>
            )}

            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write a caption…"
              rows={3}
              className="rounded-lg border border-gray-300 bg-surface2 px-3 py-2 text-sm text-bone outline-none focus-visible:border-marigold"
            />

            <div className="flex gap-2">
              {(['organizer', 'resource'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setPosterType(t)}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium capitalize ${
                    posterType === t ? 'bg-marigold text-white' : 'bg-gray-100 text-muted'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <button
              onClick={handlePost}
              disabled={!file}
              className="rounded-lg bg-marigold px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Post
            </button>
          </div>
        )}

        {stage === 'uploading' && (
          <div className="mt-6 flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm text-muted">Uploading… {uploadProgress}%</p>
            <div className="h-2 w-full rounded-full bg-gray-100">
              <div className="h-2 rounded-full bg-marigold transition-all" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        )}

        {stage === 'processing' && (
          <div className="mt-6 flex flex-col items-center gap-2 py-6 text-center">
            <p className="text-sm font-medium text-bone">Processing your video…</p>
            <p className="text-xs text-muted">This can take a minute or two depending on length.</p>
          </div>
        )}

        {stage === 'error' && (
          <div className="mt-6 flex flex-col items-center gap-3 py-4 text-center">
            <p className="text-sm text-magenta">{error}</p>
            <button onClick={() => setStage('pick')} className="text-sm font-medium text-marigold">Try again</button>
          </div>
        )}
      </div>
    </div>
  );
}
