import { visibleLinks, type LinkKey, type SocialLinks } from '../lib/socialLinks';

// Simple white glyphs drawn on each platform's color.
function Glyph({ k }: { k: LinkKey }) {
  const common = { width: 20, height: 20, viewBox: '0 0 24 24', 'aria-hidden': true } as const;
  switch (k) {
    case 'instagram':
      return (
        <svg {...common} fill="none" stroke="white" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="white" stroke="none" /></svg>
      );
    case 'facebook':
      return <svg {...common} fill="white"><path d="M14 8.5V6.8c0-.8.2-1.3 1.4-1.3H17V2.3C16.7 2.2 15.6 2 14.4 2 11.8 2 10 3.6 10 6.5v2H7.3v3.6H10V22h4v-9.9h2.9l.4-3.6H14Z" /></svg>;
    case 'tiktok':
      return <svg {...common} fill="white"><path d="M16.6 2h-3.3v13.2a2.9 2.9 0 1 1-2.1-2.8V9a6.3 6.3 0 1 0 5.4 6.2V8.6a7.9 7.9 0 0 0 4.4 1.4V6.7a4.5 4.5 0 0 1-4.4-4.7Z" /></svg>;
    case 'youtube':
      return <svg {...common} fill="white"><path d="M8.5 6.2v11.6l9.6-5.8-9.6-5.8Z" /></svg>;
    case 'x':
      return <svg {...common} fill="white"><path d="M17.5 3h3.1l-6.8 7.8 8 10.2h-6.3l-4.9-6.4L5 21H1.9l7.3-8.3L1.5 3h6.4l4.4 5.9L17.5 3Zm-1.1 16.2h1.7L7.2 4.7H5.4l11 14.5Z" /></svg>;
    default:
      return (
        <svg {...common} fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z" /></svg>
      );
  }
}

// "Follow along" links on event pages (and resource profiles). Each shows the
// platform and where it leads ("@handle", "Event on Facebook", "site.com").
export default function EventLinks({ links, title = 'Follow along', subtitle }: { links: SocialLinks; title?: string; subtitle?: string }) {
  const items = visibleLinks(links);
  if (items.length === 0) return null;
  return (
    <div>
      <h2 className="font-display text-xl font-bold text-gray-900">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map(({ platform, url, label }) => (
          <a
            key={platform.key}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 transition hover:border-marigold hover:shadow-sm"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: platform.color }}>
              <Glyph k={platform.key} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-gray-900">{platform.label}</span>
              <span className="block truncate text-sm text-gray-500">{label}</span>
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-gray-400 group-hover:text-marigold" aria-hidden>
              <path d="M7 17 17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        ))}
      </div>
    </div>
  );
}
