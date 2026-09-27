// Social / website links for events: which platforms are supported, turning
// whatever an organizer typed ("@handle", "instagram.com/x", a full URL) into
// a working https link, and a short label to show ("@handle", "site.com").

export type LinkKey = 'instagram' | 'tiktok' | 'facebook' | 'youtube' | 'x' | 'website';

export interface Platform {
  key: LinkKey;
  label: string;
  color: string; // icon background
  handleBase?: string; // how to build a profile URL from a bare @handle
  placeholder: string;
}

export const PLATFORMS: Platform[] = [
  { key: 'instagram', label: 'Instagram', color: 'linear-gradient(45deg, #F58529, #DD2A7B, #8134AF)', handleBase: 'https://www.instagram.com/', placeholder: '@yourhandle or link' },
  { key: 'tiktok', label: 'TikTok', color: '#111111', handleBase: 'https://www.tiktok.com/@', placeholder: '@yourhandle or link' },
  { key: 'facebook', label: 'Facebook', color: '#1877F2', handleBase: 'https://www.facebook.com/', placeholder: 'facebook.com/yourpage' },
  { key: 'youtube', label: 'YouTube', color: '#FF0000', handleBase: 'https://www.youtube.com/@', placeholder: '@yourchannel or link' },
  { key: 'x', label: 'X (Twitter)', color: '#111111', handleBase: 'https://x.com/', placeholder: '@yourhandle or link' },
  { key: 'website', label: 'Website', color: '#4F46E5', placeholder: 'yourwebsite.com' },
];

export type SocialLinks = Partial<Record<LinkKey, string | null>> | null | undefined;

/** Turns what someone typed into a safe https link, or null if it isn't usable. */
export function normalizeLink(key: LinkKey, raw: string | null | undefined): string | null {
  let v = (raw ?? '').trim();
  if (!v) return null;
  // Any scheme other than http(s) (javascript:, data:, mailto:) is refused.
  if (/^[a-z][a-z0-9+.-]*:/i.test(v) && !/^https?:\/\//i.test(v)) return null;
  const platform = PLATFORMS.find((p) => p.key === key);
  const isHandle = v.startsWith('@') || (!v.includes('/') && !v.includes('.'));
  if (isHandle && platform?.handleBase) {
    const handle = v.replace(/^@+/, '');
    if (!/^[A-Za-z0-9._-]{1,100}$/.test(handle)) return null;
    v = platform.handleBase + handle;
  } else if (!/^https?:\/\//i.test(v)) {
    v = 'https://' + v.replace(/^\/+/, '');
  }
  try {
    const url = new URL(v);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (!url.hostname.includes('.')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

const SHORTENERS = ['bit.ly', 'linktr.ee', 'tinyurl.com', 'lnk.bio', 'beacons.ai', 'rebrand.ly', 'linkin.bio'];

/** A short, recognizable label: "@handle" for profiles, "Event on Facebook", or a domain. */
export function linkLabel(key: LinkKey, url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^(www\.|m\.|web\.)/, '');
    const segments = u.pathname.split('/').filter(Boolean);
    const first = segments[0]?.replace(/^@/, '');
    if (key === 'website') {
      // Shortener links only make sense with their path; otherwise the domain reads best.
      if (SHORTENERS.includes(host) && segments.length) {
        const label = host + '/' + segments.join('/');
        return label.length > 36 ? label.slice(0, 35) + '…' : label;
      }
      return host;
    }
    if (key === 'facebook') {
      if (first === 'events') return 'Event on Facebook';
      if (first === 'groups') return 'Facebook group';
      if (!first || ['share', 'sharer', 'sharer.php', 'profile.php', 'pages', 'permalink.php', 'story.php', 'watch', 'reel'].includes(first)) return 'Open in Facebook';
      return first;
    }
    if (key === 'youtube' && (!first || ['channel', 'c', 'user', 'watch', 'playlist', 'shorts', 'live'].includes(first))) return 'Watch on YouTube';
    if (!first || ['p', 'reel', 'reels', 'stories', 'video', 'status', 'share', 'explore'].includes(first)) return 'Open in ' + (PLATFORMS.find((p) => p.key === key)?.label ?? host);
    return '@' + first;
  } catch {
    return url;
  }
}

/** The links to show, in display order, already made safe. */
export function visibleLinks(links: SocialLinks): { platform: Platform; url: string; label: string }[] {
  if (!links) return [];
  // Older events stored X under "twitter".
  const raw = links as Record<string, string | null | undefined>;
  return PLATFORMS.flatMap((platform) => {
    const value = platform.key === 'x' ? raw.x ?? raw.twitter : raw[platform.key];
    const url = normalizeLink(platform.key, value);
    return url ? [{ platform, url, label: linkLabel(platform.key, url) }] : [];
  });
}
