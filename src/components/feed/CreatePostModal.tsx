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

export default function CreatePostModal({ onClose, onPosted, initialEvent = null }: { onClose: () => void; onPosted: () => void; initialEvent?: { id: string; title: string } | null }) {
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
  const [selectedEvent, setSelectedEvent] = useState<EventOption | null>(() => (initialEvent ? ({ ...initialEvent } as EventOption) : null));
  const [myEvents, setMyEvents] = useState<EventOption[]>([]);
  // Groups this person belongs to, so the video can also show on a group's page.
  const [myGroups, setMyGroups] = useState<{ group_id: string; name: string }[]>([]);
  const [groupId, setGroupId] = useState('');
  const [stage, setStage] = useState<'pick' | 'uploading' | 'processing' | 'error'>('pick');
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  // Tapping outside or pressing Escape closes, but never mid-upload, and
  // asks first if a video or caption would be lost.
  function requestClose() {
    if (stage === 'uploading') return;
    if (stage === 'processing') { onPosted(); return; }
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

  // Clear the tagged event only when someone switches who they're posting as, not when the window first opens
  // (so an event passed in, like from an event's "Share a clip", stays tagged).
  const prevPosterType = useRef(posterType);
  useEffect(() => {
    if (prevPosterType.current !== posterType) {
      prevPosterType.current = posterType;
      setSelectedEvent(null);
      setEventSearch('');
    }
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

  // Keep the screen on while uploading so the phone doesn't auto-lock mid-upload.
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);
  async function keepAwake(on: boolean) {
    try {
      if (on) wakeLock.current = await (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request('screen') ?? null;
      else { await wakeLock.current?.release(); wakeLock.current = null; }
    } catch { /* not supported: fine */ }
  }
  // Warn before leaving the page mid-upload.
  useEffect(() => {
    if (stage !== 'uploading') return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [stage]);

  // One upload attempt to Gumlet's signed URL, with progress.
  function putFile(url: string, f: File) {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url);
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100)); };
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(Object.assign(new Error('Upload failed'), { status: xhr.status })));
      xhr.onerror = () => reject(Object.assign(new Error('Upload failed'), { status: 0 }));
      xhr.send(f);
    });
  }
  // If the upload is interrupted (phone locked, app switched, connection dropped), wait until TapIN is
  // back on screen and try again, up to 3 times. A fresh upload link is used if the old one expired.
  const waitUntilVisible = () => new Promise<void>((res) => {
    if (!document.hidden) return res();
    const on = () => { if (!document.hidden) { document.removeEventListener('visibilitychange', on); res(); } };
    document.addEventListener('visibilitychange', on);
  });

  async function handlePost() {
    if (!file || !user?.email) return;
    setStage('uploading');
    setError(null);
    setUploadNote(null);
    await keepAwake(true);

    // Step 1: a signed Gumlet upload link from our backend (the API key never touches the browser).
    const getLink = async () => {
      const { data, error: e } = await supabase.functions.invoke('create-gumlet-upload', { body: {} });
      return e || !data?.upload_url ? null : (data as { upload_url: string; asset_id: string });
    };
    let link = await getLink();
    if (!link) { await keepAwake(false); setError('Could not start the upload. Please try again.'); setStage('error'); return; }

    // Step 2: upload, retrying automatically after interruptions.
    let uploaded = false;
    for (let attempt = 1; attempt <= 4 && !uploaded; attempt++) {
      try {
        await putFile(link.upload_url, file);
        uploaded = true;
      } catch (e) {
        if (attempt === 4) break;
        const status = (e as { status?: number }).status ?? 0;
        setUploadNote(document.hidden ? 'Paused while TapIN was in the background. It will continue when you come back.' : 'Connection interrupted. Retrying…');
        await waitUntilVisible();
        await new Promise((r) => setTimeout(r, 1500));
        if (status === 403 || status === 400) { const fresh = await getLink(); if (fresh) link = fresh; }
        setUploadNote('Resuming upload…');
        setUploadProgress(0);
      }
    }
    await keepAwake(false);
    if (!uploaded) { setError('The upload kept getting interrupted. Check your connection and try again.'); setStage('error'); return; }

    // Optional custom thumbnail.
    let customThumbnailUrl: string | null = null;
    if (customThumbnail) {
      const path = `${user.id}/post-thumbnail-${Date.now()}-${customThumbnail.name}`;
      const { error: thumbUploadError } = await supabase.storage.from('user-uploads').upload(path, customThumbnail, { upsert: true });
      if (!thumbUploadError) customThumbnailUrl = supabase.storage.from('user-uploads').getPublicUrl(path).data.publicUrl;
    }

    // Step 3: save the post as "processing". TapIN finishes it on the server and publishes it when the
    // video is ready, so you can lock your phone or leave. You'll get a notification when it's live.
    const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
    const { data: created, error: insertError } = await supabase.from('posts').insert({
      author_email: user.email,
      poster_type: posterType,
      caption: caption.trim() || null,
      video_url: null,
      status: 'processing',
      processing_started_at: new Date().toISOString(),
      gumlet_asset_id: link.asset_id,
      thumbnail_url: customThumbnailUrl,
      category: category || null,
      tags: tags.length > 0 ? tags : null,
      event_id: selectedEvent?.id ?? null,
      group_id: groupId || null,
    }).select('id').single();
    if (insertError || !created) {
      setError('Your video uploaded, but saving the post failed. Please try again.');
      setStage('error');
      return;
    }
    if (taggedPeople.length > 0) {
      const results = await Promise.all(taggedPeople.map((p) => supabase.from('post_tags').insert({ post_id: created.id, tagged_email: p.email })));
      results.forEach((r, i) => r.error && console.error('Could not tag', taggedPeople[i].email, r.error.message));
    }
    setStage('processing');
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
            <p className="text-sm font-medium text-bone">Uploading… {uploadProgress}%</p>
            <div className="h-2 w-full rounded-full bg-gray-100">
              <div className="h-2 rounded-full bg-marigold transition-all" style={{ width: `${uploadProgress}%` }} />
            </div>
            <p className="text-xs text-muted">{uploadNote ?? 'Keep TapIN open until the upload finishes. After that, you can close it.'}</p>
          </div>
        )}

        {stage === 'processing' && (
          <div className="mt-6 flex flex-col items-center gap-2 py-6 text-center">
            <p className="text-3xl" aria-hidden="true">🎬</p>
            <p className="text-sm font-semibold text-bone">Uploaded! Your video is processing.</p>
            <p className="text-xs text-muted">It usually takes a minute or two. You can close this or lock your phone. We'll post it automatically and let you know when it's live.</p>
            <button onClick={() => onPosted()} className="mt-2 rounded-xl bg-marigold px-5 py-2.5 text-sm font-semibold text-white">Done</button>
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
