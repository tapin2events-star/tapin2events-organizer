import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { parseMediaLink } from '../../lib/mediaEmbeds';
import type { ResourceAlbum, ResourceMedia } from '../../lib/types';
import MediaPlayer from './MediaPlayer';

interface FeedPost {
  id: string;
  thumbnail_url: string | null;
  caption: string | null;
}

const FEED_PREVIEW = 6;

// Public "Media" section on a resource profile: music and video players from
// links, the creator's TapIN feed videos, and photo albums.
export default function ResourceMediaSection({ resourceId, resourceEmail }: { resourceId: string; resourceEmail: string }) {
  const [items, setItems] = useState<ResourceMedia[]>([]);
  const [albums, setAlbums] = useState<ResourceAlbum[]>([]);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [openAlbum, setOpenAlbum] = useState<{ title: string; photos: ResourceMedia[] } | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('resource_media').select('*').eq('resource_id', resourceId).order('display_order', { ascending: true }),
      supabase.from('resource_albums').select('*').eq('resource_id', resourceId).order('display_order', { ascending: true }),
      supabase.from('posts').select('id, thumbnail_url, caption').eq('author_email', resourceEmail).eq('status', 'active').order('created_at', { ascending: false }).limit(FEED_PREVIEW + 1),
    ]).then(([{ data: m }, { data: a }, { data: p }]) => {
      setItems((m ?? []) as ResourceMedia[]);
      setAlbums((a ?? []) as ResourceAlbum[]);
      setPosts((p ?? []) as FeedPost[]);
    });
  }, [resourceId, resourceEmail]);

  const embeds = items
    .filter((i) => i.media_type === 'embed')
    .map((i) => ({ item: i, parsed: parseMediaLink(i.media_url) }))
    .filter((e): e is { item: ResourceMedia; parsed: NonNullable<ReturnType<typeof parseMediaLink>> } => !!e.parsed);
  const audio = embeds.filter((e) => e.parsed.kind === 'audio');
  const video = embeds.filter((e) => e.parsed.kind === 'video');
  const photos = items.filter((i) => i.media_type === 'photo');
  const albumCards = [
    ...albums.map((a) => ({ key: a.id, title: a.title, photos: photos.filter((p) => p.album_id === a.id) })),
    // Photos not in any album (e.g. from the older single portfolio).
    { key: 'loose', title: 'Photos', photos: photos.filter((p) => !p.album_id) },
  ].filter((a) => a.photos.length > 0);

  useEffect(() => {
    if (!openAlbum) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenAlbum(null);
      if (e.key === 'ArrowRight') setPhotoIndex((i) => Math.min(i + 1, openAlbum.photos.length - 1));
      if (e.key === 'ArrowLeft') setPhotoIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openAlbum]);

  if (audio.length === 0 && video.length === 0 && posts.length === 0 && albumCards.length === 0) return null;

  const heading = (text: string) => <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">{text}</h3>;
  const current = openAlbum?.photos[photoIndex];

  return (
    <div className="mt-6 flex flex-col gap-6 border-t border-gray-200 pt-6">
      <h2 className="font-display text-lg font-semibold text-gray-900">Media</h2>

      {audio.length > 0 && (
        <div>
          {heading('Listen')}
          <div className="flex flex-col gap-3">
            {audio.map((e) => <MediaPlayer key={e.item.id} embed={e.parsed} url={e.item.media_url} title={e.item.caption} />)}
          </div>
        </div>
      )}

      {video.length > 0 && (
        <div>
          {heading('Watch')}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {video.map((e) => <MediaPlayer key={e.item.id} embed={e.parsed} url={e.item.media_url} title={e.item.caption} />)}
          </div>
        </div>
      )}

      {posts.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between">
            {heading('Videos on TapIN')}
            {posts.length > FEED_PREVIEW && (
              <Link to={`/creator/${encodeURIComponent(resourceEmail)}`} className="text-sm font-medium text-marigold">See all &rarr;</Link>
            )}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {posts.slice(0, FEED_PREVIEW).map((p) => (
              <Link key={p.id} to={`/feed?post=${p.id}`} className="relative block aspect-[9/16] overflow-hidden rounded-lg bg-gray-100">
                {p.thumbnail_url ? <img src={p.thumbnail_url} alt={p.caption ?? ''} className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-2xl">🎥</span>}
                <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 text-xs text-white">▶</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {albumCards.length > 0 && (
        <div>
          {heading('Photos')}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {albumCards.map((a) => (
              <button key={a.key} type="button" onClick={() => { setOpenAlbum({ title: a.title, photos: a.photos }); setPhotoIndex(0); }} className="text-left">
                <img src={a.photos[0].media_url} alt="" className="aspect-square w-full rounded-xl object-cover" />
                <p className="mt-1 truncate text-sm font-medium text-gray-900">{a.title}</p>
                <p className="text-xs text-gray-500">{a.photos.length} photo{a.photos.length === 1 ? '' : 's'}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {openAlbum && current && (
        <div className="fixed inset-0 z-[1100] flex flex-col bg-black" onClick={() => setOpenAlbum(null)}>
          <div className="flex items-center justify-between px-4 py-3 text-white" onClick={(e) => e.stopPropagation()}>
            <p className="truncate font-semibold">{openAlbum.title} <span className="font-normal text-white/60">· {photoIndex + 1} of {openAlbum.photos.length}</span></p>
            <button type="button" onClick={() => setOpenAlbum(null)} aria-label="Close" className="text-2xl leading-none">✕</button>
          </div>
          <div
            className="relative flex min-h-0 flex-1 items-center justify-center px-2"
            onClick={(e) => e.stopPropagation()}
            // Swipe left/right on phones to move between photos.
            onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
            onTouchEnd={(e) => {
              if (touchX.current === null) return;
              const dx = e.changedTouches[0].clientX - touchX.current;
              if (dx < -50) setPhotoIndex((i) => Math.min(i + 1, openAlbum.photos.length - 1));
              if (dx > 50) setPhotoIndex((i) => Math.max(i - 1, 0));
              touchX.current = null;
            }}
          >
            <img src={current.media_url} alt={current.caption ?? ''} className="max-h-full max-w-full object-contain" />
            {photoIndex > 0 && (
              <button type="button" onClick={() => setPhotoIndex((i) => i - 1)} aria-label="Previous photo" className="absolute left-2 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-2xl text-white hover:bg-white/25">‹</button>
            )}
            {photoIndex < openAlbum.photos.length - 1 && (
              <button type="button" onClick={() => setPhotoIndex((i) => i + 1)} aria-label="Next photo" className="absolute right-2 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-2xl text-white hover:bg-white/25">›</button>
            )}
          </div>
          <p className="min-h-[3rem] px-4 py-3 text-center text-sm text-white/80" onClick={(e) => e.stopPropagation()}>{current.caption}</p>
        </div>
      )}
    </div>
  );
}
