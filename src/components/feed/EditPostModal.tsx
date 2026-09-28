import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { POST_CATEGORIES } from '../../lib/postOptions';
import { useEscapeKey } from '../../lib/useEscapeKey';
import { loadTags, type TaggedPerson } from '../../lib/postTags';
import TagCreatorsField from './TagCreatorsField';

interface EventOption {
  id: string;
  title: string;
}

// Edit a post's caption, posting role, tagged event, category, and tags. The
// video itself (and its likes, comments, and tips) is untouched. The database
// only allows authors to change these fields.
export default function EditPostModal({ postId, onClose, onSaved }: { postId: string; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [caption, setCaption] = useState('');
  const [posterType, setPosterType] = useState<'organizer' | 'resource' | null>(null);
  const [category, setCategory] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [tagged, setTagged] = useState<TaggedPerson[]>([]);
  const [initialTagged, setInitialTagged] = useState<TaggedPerson[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventOption | null>(null);
  const [changingEvent, setChangingEvent] = useState(false);
  const [eventSearch, setEventSearch] = useState('');
  const [eventOptions, setEventOptions] = useState<EventOption[]>([]);
  const [myEvents, setMyEvents] = useState<EventOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEscapeKey(onClose);

  useEffect(() => {
    (async () => {
      const { data: post } = await supabase.from('posts').select('caption, poster_type, category, tags, event_id').eq('id', postId).single();
      if (post) {
        setCaption(post.caption ?? '');
        setPosterType(post.poster_type ?? null);
        setCategory(post.category ?? '');
        setTagsInput(((post.tags as string[] | null) ?? []).join(', '));
        if (post.event_id) {
          const { data: ev } = await supabase.from('events').select('id, title').eq('id', post.event_id).maybeSingle();
          if (ev) setSelectedEvent(ev);
        }
      }
      const tagMap = await loadTags([postId]);
      setTagged(tagMap.get(postId) ?? []);
      setInitialTagged(tagMap.get(postId) ?? []);
      if (user?.email) {
        const { data: mine } = await supabase
          .from('events')
          .select('id, title')
          .eq('organizer_email', user.email)
          .eq('status', 'published')
          .order('start_date', { ascending: false })
          .limit(50);
        setMyEvents(mine ?? []);
      }
      setLoading(false);
    })();
  }, [postId, user?.email]);

  useEffect(() => {
    if (!changingEvent || eventSearch.trim().length < 2) {
      setEventOptions([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const { data } = await supabase.from('events').select('id, title').eq('status', 'published').ilike('title', `%${eventSearch.trim()}%`).limit(6);
      setEventOptions(data ?? []);
    }, 300);
    return () => clearTimeout(timeout);
  }, [eventSearch, changingEvent]);

  function pickEvent(ev: EventOption | null) {
    setSelectedEvent(ev);
    setChangingEvent(false);
    setEventSearch('');
  }

  async function save() {
    setSaving(true);
    setError(null);
    const tags = tagsInput.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean).slice(0, 10);
    const { error: updateError } = await supabase
      .from('posts')
      .update({
        caption: caption.trim() || null,
        poster_type: posterType,
        category: category || null,
        tags: tags.length ? tags : null,
        event_id: selectedEvent?.id ?? null,
      })
      .eq('id', postId);
    if (updateError) {
      setSaving(false);
      setError("Couldn't save your changes. Please try again.");
      return;
    }

    // Tags: untag people who were removed, tag the new ones. A person who
    // opted out of this post earlier can't be tagged again.
    const before = new Set(initialTagged.map((p) => p.email));
    const now = new Set(tagged.map((p) => p.email));
    const toRemove = [...before].filter((e) => !now.has(e));
    const toAdd = tagged.filter((p) => !before.has(p.email));
    if (toRemove.length > 0) await supabase.from('post_tags').delete().eq('post_id', postId).eq('status', 'active').in('tagged_email', toRemove);
    const added = await Promise.all(toAdd.map((p) => supabase.from('post_tags').insert({ post_id: postId, tagged_email: p.email })));
    const failed = toAdd.filter((_, i) => added[i].error);
    setSaving(false);
    onSaved();
    if (failed.length > 0) {
      // Everything else was saved; keep the editor open so this isn't missed.
      const failedEmails = new Set(failed.map((p) => p.email));
      setTagged((prev) => prev.filter((p) => !failedEmails.has(p.email)));
      setInitialTagged(tagged.filter((p) => !failedEmails.has(p.email)));
      setError(`Your changes were saved, but ${failed.map((p) => p.name).join(', ')} couldn't be tagged. They may have opted out of this post.`);
      return;
    }
    onClose();
  }

  const field = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 outline-none focus:border-marigold';

  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="font-display text-lg font-bold text-bone">Edit post</p>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-bone">✕</button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-muted">Loading…</p>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            <label className="block">
              <span className="text-sm font-medium text-bone">Caption</span>
              <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={3} maxLength={2200} className={`${field} mt-1`} />
            </label>

            <div>
              <span className="text-sm font-medium text-bone">Posting as <span className="font-normal text-muted">(Optional)</span></span>
              <div className="mt-1 flex gap-2">
                {(['organizer', 'resource'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setPosterType(posterType === t ? null : t)}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium capitalize ${posterType === t ? 'bg-marigold text-white' : 'bg-gray-100 text-muted'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {posterType === 'resource' && <p className="mt-1 text-xs text-muted">Shows on your resource profile, with a Book button on the video.</p>}
            </div>

            <div>
              <span className="text-sm font-medium text-bone">Tagged event <span className="font-normal text-muted">(Optional)</span></span>
              {!changingEvent ? (
                <div className="mt-1 flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate rounded-lg bg-surface2 px-3 py-2 text-sm text-bone">{selectedEvent ? `📅 ${selectedEvent.title}` : 'No event tagged'}</span>
                  <button type="button" onClick={() => setChangingEvent(true)} className="shrink-0 text-sm font-medium text-marigold">{selectedEvent ? 'Change' : 'Add'}</button>
                  {selectedEvent && <button type="button" onClick={() => pickEvent(null)} className="shrink-0 text-sm text-muted hover:text-magenta">Remove</button>}
                </div>
              ) : (
                <div className="mt-1 flex flex-col gap-2">
                  {myEvents.length > 0 && (
                    <select
                      value=""
                      onChange={(e) => {
                        const ev = myEvents.find((m) => m.id === e.target.value);
                        if (ev) pickEvent(ev);
                      }}
                      className={field}
                    >
                      <option value="">Pick one of your events…</option>
                      {myEvents.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                    </select>
                  )}
                  <input value={eventSearch} onChange={(e) => setEventSearch(e.target.value)} placeholder="Or search any event by name" className={field} />
                  {eventOptions.map((ev) => (
                    <button key={ev.id} type="button" onClick={() => pickEvent(ev)} className="rounded-lg border border-gray-200 px-3 py-2 text-left text-sm text-bone hover:border-marigold">
                      📅 {ev.title}
                    </button>
                  ))}
                  <button type="button" onClick={() => setChangingEvent(false)} className="self-start text-sm text-muted">Cancel</button>
                </div>
              )}
            </div>

            <label className="block">
              <span className="text-sm font-medium text-bone">Category</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${field} mt-1`}>
                <option value="">None</option>
                {POST_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-bone">Tags <span className="font-normal text-muted">(comma separated)</span></span>
              <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="poetry, live music" className={`${field} mt-1`} />
            </label>

            <TagCreatorsField value={tagged} onChange={setTagged} selfEmail={user?.email} inputClassName={field} />

            {error && <p className="text-sm text-magenta">{error}</p>}
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 py-2.5 text-sm font-semibold text-bone">Cancel</button>
              <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-marigold py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
