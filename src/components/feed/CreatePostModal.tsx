import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { POST_CATEGORIES as CATEGORIES } from '../../lib/postOptions';
import { useEscapeKey } from '../../lib/useEscapeKey';
import TagCreatorsField from './TagCreatorsField';
import type { TaggedPerson } from '../../lib/postTags';

interface EventOption {
  id: string;
  title: string;
}

export default function CreatePostModal({ onClose, onPosted }: { onClose: () => void; onPosted: () => void }) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [customThumbnail, setCustomThumbnail] = useState<File | null>(null);
  const [customThumbnailPreview, setCustomThumbnailPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [posterType, setPosterType] = useState<'organizer' | 'resource' | null>(null);
  const [category, setCategory] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [taggedPeople, setTaggedPeople] = useState<TaggedPerson[]>([]);
  const [eventSearch, setEventSearch] = useState('');
  const [eventOptions, setEventOptions] = useState<EventOption[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventOption | null>(null);
  const [myEvents, setMyEvents] = useState<EventOption[]>([]);
  // Groups this person belongs to, so the video can also show on a group's page.
  const [myGroups, setMyGroups] = useState<{ group_id: string; name: string }[]>([]);
  const [groupId, setGroupId] = useState('');
  const [stage, setStage] = useState<'pick' | 'uploading' | 'processing' | 'error'>('pick');
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  // Tapping outside or pressing Escape closes, but never mid-upload, and
  // asks first if a video or caption would be lost.
  function requestClose() {
    if (stage === 'uploading' || stage === 'processing') return;
    if ((file || caption.trim()) && !window.confirm('Discard this post?')) return;
    onClose();
  }
  useEscapeKey(requestClose);

  useEffect(() => {
    supabase.rpc('my_groups').then(({ data }) => {
      setMyGroups(((data ?? []) as { group_id: string; name: string; status: string }[]).filter((g) => g.status === 'active'));
    });
  }, []);

  useEffect(() => {
    if (eventSearch.trim().length < 2 || selectedEvent) {
      setEventOptions([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from('events')
        .select('id, title')
        .eq('status', 'published')
        .ilike('title', `%${eventSearch.trim()}%`)
        .limit(6);
      setEventOptions(data ?? []);
    }, 300);
    return () => clearTimeout(timeout);
  }, [eventSearch, selectedEvent]);

  useEffect(() => {
    setSelectedEvent(null);
    setEventSearch('');
    if (posterType === 'organizer' && user?.email) {
      supabase
        .from('events')
        .select('id, title')
        .eq('organizer_email', user.email)
        .order('created_at', { ascending: false })
        .then(({ data }) => setMyEvents(data ?? []));
    }
  }, [posterType, user?.email]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
  }

  function handleThumbnailSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setCustomThumbnail(selected);
    setCustomThumbnailPreview(URL.createObjectURL(selected));
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

    // Step 2b: if a custom thumbnail was provided, upload it in parallel --
    // otherwise Gumlet's auto-generated one (from status polling) is used.
    let customThumbnailUrl: string | null = null;
    if (customThumbnail) {
      const path = `${user.id}/post-thumbnail-${Date.now()}-${customThumbnail.name}`;
      const { error: thumbUploadError } = await supabase.storage.from('user-uploads').upload(path, customThumbnail, { upsert: true });
      if (!thumbUploadError) {
        const { data: publicUrlData } = supabase.storage.from('user-uploads').getPublicUrl(path);
        customThumbnailUrl = publicUrlData.publicUrl;
      }
    }

    // Step 3: Gumlet needs a little time to transcode -- poll until ready.
    setStage('processing');
    const assetId = uploadData.asset_id;
    let playbackUrl: string | null = null;
    let generatedThumbnailUrl: string | null = null;
    for (let attempt = 0; attempt < 60; attempt++) {
      await new Promise((r) => setTimeout(r, 3000));
      const { data: statusData } = await supabase.functions.invoke('check-gumlet-asset-status', { body: { asset_id: assetId } });
      if (statusData?.status === 'ready') {
        playbackUrl = statusData.playback_url;
        generatedThumbnailUrl = statusData.thumbnail_url;
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

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    // Step 4: the post only becomes visible in the feed once we have a
    // real, working playback URL -- never before.
    const { data: created, error: insertError } = await supabase.from('posts').insert({
      author_email: user.email,
      poster_type: posterType,
      caption: caption.trim() || null,
      video_url: playbackUrl,
      gumlet_asset_id: assetId,
      thumbnail_url: customThumbnailUrl ?? generatedThumbnailUrl,
      category: category || null,
      tags: tags.length > 0 ? tags : null,
      event_id: selectedEvent?.id ?? null,
      group_id: groupId || null,
    }).select('id').single();
    if (insertError || !created) {
      setError('Your video processed successfully, but saving the post failed. Please try again.');
      setStage('error');
      return;
    }

    // Tag creators one by one, so one person who can't be tagged doesn't
    // stop the others. The post itself is already live either way.
    if (taggedPeople.length > 0) {
      const results = await Promise.all(taggedPeople.map((p) => supabase.from('post_tags').insert({ post_id: created.id, tagged_email: p.email })));
      results.forEach((r, i) => r.error && console.error('Could not tag', taggedPeople[i].email, r.error.message));
    }

    onPosted();
  }

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/60 p-4" onClick={requestClose}>
      <div className="w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-2xl bg-surface p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-display text-lg font-bold text-bone">Create New Post</p>
            <p className="text-xs text-muted">Share your event highlights, performances, or business updates</p>
          </div>
          <button onClick={onClose} className="shrink-0 text-muted">✕</button>
        </div>

        {stage === 'pick' && (
          <div className="mt-4 flex flex-col gap-4">
            <div>
              <p className="mb-1 text-sm font-medium text-bone">Video <span className="text-magenta">*</span></p>
              {previewUrl ? (
                <>
                  <video src={previewUrl} className="max-h-64 w-full rounded-xl bg-black object-contain" controls />
                  <button onClick={() => fileInputRef.current?.click()} className="mt-1 text-sm text-marigold">Choose a different video</button>
                </>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-xl border border-gray-300 text-sm font-medium text-bone"
                >
                  🎥 Upload Video
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileSelect} className="hidden" />
            </div>

            <div>
              <p className="mb-1 text-sm font-medium text-bone">Thumbnail <span className="text-muted font-normal">(Optional)</span></p>
              <p className="mb-1 text-xs text-muted">Custom thumbnail or auto-generated</p>
              {customThumbnailPreview ? (
                <div className="flex items-center gap-2">
                  <img src={customThumbnailPreview} alt="" className="h-14 w-14 rounded-lg object-cover" />
                  <button onClick={() => thumbnailInputRef.current?.click()} className="text-sm text-marigold">Change</button>
                </div>
              ) : (
                <button
                  onClick={() => thumbnailInputRef.current?.click()}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-gray-300 text-sm font-medium text-bone"
                >
                  🖼️ Upload Thumbnail
                </button>
              )}
              <input ref={thumbnailInputRef} type="file" accept="image/*" onChange={handleThumbnailSelect} className="hidden" />
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-bone">Caption <span className="text-magenta">*</span></span>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Tell your story…"
                rows={3}
                className="rounded-lg border border-gray-300 bg-surface2 px-3 py-2 text-sm text-bone outline-none focus-visible:border-marigold"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-bone">Category</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="rounded-lg border border-gray-300 bg-surface2 px-3 py-2 text-sm text-bone outline-none focus-visible:border-marigold"
              >
                <option value="">Select category</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-bone">Tags</span>
              <input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="music, live, concert (comma separated)"
                className="rounded-lg border border-gray-300 bg-surface2 px-3 py-2 text-sm text-bone outline-none focus-visible:border-marigold"
              />
            </label>

            <TagCreatorsField
              value={taggedPeople}
              onChange={setTaggedPeople}
              selfEmail={user?.email}
              inputClassName="rounded-lg border border-gray-300 bg-surface2 px-3 py-2 text-sm text-bone outline-none focus-visible:border-marigold"
            />

            {myGroups.length > 0 && (
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-bone">Also show on a group's page <span className="text-muted font-normal">(Optional)</span></span>
                <select value={groupId} onChange={(e) => setGroupId(e.target.value)}
                  className="rounded-lg border border-gray-300 bg-surface2 px-3 py-2 text-sm text-bone outline-none focus-visible:border-marigold">
                  <option value="">No, just my profile</option>
                  {myGroups.map((g) => <option key={g.group_id} value={g.group_id}>{g.name}</option>)}
                </select>
              </label>
            )}

            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-bone">Tag an Event <span className="text-muted font-normal">(Optional)</span></span>
              {posterType === 'organizer' ? (
                myEvents.length > 0 ? (
                  <select
                    value={selectedEvent?.id ?? ''}
                    onChange={(e) => setSelectedEvent(myEvents.find((ev) => ev.id === e.target.value) ?? null)}
                    className="rounded-lg border border-gray-300 bg-surface2 px-3 py-2 text-sm text-bone outline-none focus-visible:border-marigold"
                  >
                    <option value="">Select one of your events</option>
                    {myEvents.map((ev) => (
                      <option key={ev.id} value={ev.id}>{ev.title}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-muted">You don't have any events to tag yet.</p>
                )
              ) : selectedEvent ? (
                <div className="flex items-center justify-between rounded-lg border border-marigold bg-marigold/10 px-3 py-2 text-sm text-marigold">
                  {selectedEvent.title}
                  <button onClick={() => { setSelectedEvent(null); setEventSearch(''); }}>✕</button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    value={eventSearch}
                    onChange={(e) => setEventSearch(e.target.value)}
                    placeholder="Search for an event…"
                    className="w-full rounded-lg border border-gray-300 bg-surface2 px-3 py-2 text-sm text-bone outline-none focus-visible:border-marigold"
                  />
                  {eventOptions.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-surface shadow-lg">
                      {eventOptions.map((ev) => (
                        <button
                          key={ev.id}
                          onClick={() => { setSelectedEvent(ev); setEventOptions([]); }}
                          className="block w-full px-3 py-2 text-left text-sm text-bone hover:bg-gray-50"
                        >
                          {ev.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-bone">Posting as <span className="text-muted font-normal">(Optional)</span></span>
              <div className="flex gap-2">
                {(['organizer', 'resource'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setPosterType((current) => (current === t ? null : t))}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium capitalize ${
                      posterType === t ? 'bg-marigold text-white' : 'bg-gray-100 text-muted'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handlePost}
              disabled={!file || !caption.trim()}
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
