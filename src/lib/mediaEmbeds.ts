// Turns a music/video link into an embeddable player. For safety, a player
// URL is only ever built from a recognized platform's own embed format using
// an ID extracted from the link -- never by embedding an arbitrary URL.

export type EmbedPlatform = 'spotify' | 'apple' | 'soundcloud' | 'youtube' | 'vimeo' | 'tiktok' | 'bandcamp';

export interface ParsedEmbed {
  platform: EmbedPlatform;
  label: string; // e.g. "Spotify"
  kind: 'audio' | 'video';
  embedUrl: string | null; // null = show as a link button (Bandcamp)
  height?: number; // fixed height for audio players
  aspect?: 'wide' | 'tall'; // for video players
}

const LABELS: Record<EmbedPlatform, string> = {
  spotify: 'Spotify',
  apple: 'Apple Music',
  soundcloud: 'SoundCloud',
  youtube: 'YouTube',
  vimeo: 'Vimeo',
  tiktok: 'TikTok',
  bandcamp: 'Bandcamp',
};

export const SUPPORTED_PLATFORMS = 'Spotify, Apple Music, SoundCloud, Bandcamp, YouTube, Vimeo, or TikTok';

export function parseMediaLink(raw: string): ParsedEmbed | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.)/, '');
  const path = url.pathname;
  const make = (platform: EmbedPlatform, rest: Omit<ParsedEmbed, 'platform' | 'label'>): ParsedEmbed => ({ platform, label: LABELS[platform], ...rest });

  if (host === 'open.spotify.com') {
    const m = path.match(/^\/(?:intl-[a-z-]+\/)?(track|album|playlist|artist|episode|show)\/([A-Za-z0-9]{10,40})/);
    if (!m) return null;
    const [, type, id] = m;
    return make('spotify', { kind: 'audio', embedUrl: `https://open.spotify.com/embed/${type}/${id}`, height: type === 'track' || type === 'episode' ? 152 : 352 });
  }

  if (host === 'music.apple.com') {
    const m = path.match(/^\/[a-z]{2}\/(album|playlist|song|station|artist)\/[A-Za-z0-9\-._~%]+(?:\/[A-Za-z0-9\-._~%]+)?\/?$/);
    if (!m) return null;
    const songId = url.searchParams.get('i');
    const query = songId && /^\d+$/.test(songId) ? `?i=${songId}` : '';
    const isSong = m[1] === 'song' || !!query;
    return make('apple', { kind: 'audio', embedUrl: `https://embed.music.apple.com${path}${query}`, height: isSong ? 175 : 450 });
  }

  if (host === 'soundcloud.com' || host === 'on.soundcloud.com') {
    if (!/^\/[A-Za-z0-9\-_/]+$/.test(path) || path === '/') return null;
    const clean = `https://${host}${path}`;
    const isSet = path.includes('/sets/');
    return make('soundcloud', {
      kind: 'audio',
      embedUrl: `https://w.soundcloud.com/player/?url=${encodeURIComponent(clean)}&color=%234f46e5&visual=false&show_comments=false`,
      height: isSet ? 450 : 166,
    });
  }

  if (host.endsWith('.bandcamp.com') && /^[a-z0-9-]+\.bandcamp\.com$/.test(host)) {
    // Bandcamp's player needs an internal ID that isn't in the page URL.
    return make('bandcamp', { kind: 'audio', embedUrl: null });
  }

  if (host === 'youtube.com' || host === 'music.youtube.com' || host === 'youtu.be') {
    const list = url.searchParams.get('list');
    let id: string | null = null;
    if (host === 'youtu.be') id = path.slice(1).split('/')[0];
    else if (path === '/watch') id = url.searchParams.get('v');
    else {
      const m = path.match(/^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})/);
      if (m) id = m[1];
    }
    if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) {
      const isShort = path.startsWith('/shorts/');
      return make('youtube', { kind: 'video', embedUrl: `https://www.youtube-nocookie.com/embed/${id}`, aspect: isShort ? 'tall' : 'wide' });
    }
    if (list && /^[A-Za-z0-9_-]{10,64}$/.test(list)) {
      return make('youtube', { kind: 'video', embedUrl: `https://www.youtube-nocookie.com/embed/videoseries?list=${list}`, aspect: 'wide' });
    }
    return null;
  }

  if (host === 'vimeo.com') {
    const m = path.match(/^\/(\d{5,12})/);
    if (!m) return null;
    return make('vimeo', { kind: 'video', embedUrl: `https://player.vimeo.com/video/${m[1]}`, aspect: 'wide' });
  }

  if (host === 'tiktok.com') {
    const m = path.match(/^\/@[A-Za-z0-9._-]+\/video\/(\d{10,25})/);
    if (!m) return null;
    return make('tiktok', { kind: 'video', embedUrl: `https://www.tiktok.com/embed/v2/${m[1]}`, aspect: 'tall' });
  }

  return null;
}
