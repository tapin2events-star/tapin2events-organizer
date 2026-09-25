import type { ParsedEmbed } from '../../lib/mediaEmbeds';

// One music or video player. `embed.embedUrl` is always built by
// parseMediaLink from a recognized platform's own embed format.
export default function MediaPlayer({ embed, url, title }: { embed: ParsedEmbed; url: string; title?: string | null }) {
  if (!embed.embedUrl) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 hover:border-marigold">
        <span className="min-w-0">
          <span className="block truncate font-medium text-gray-900">{title || `Listen on ${embed.label}`}</span>
          <span className="text-xs text-gray-500">{embed.label}</span>
        </span>
        <span className="shrink-0 text-sm font-semibold text-marigold">Listen &rarr;</span>
      </a>
    );
  }
  const frame = (className: string, style?: React.CSSProperties) => (
    <iframe
      src={embed.embedUrl!}
      title={title || `${embed.label} player`}
      loading="lazy"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
      className={className}
      style={style}
    />
  );
  return (
    <div>
      {title && <p className="mb-1.5 text-sm font-medium text-gray-900">{title}</p>}
      {embed.kind === 'audio'
        ? frame('w-full rounded-xl border-0', { height: embed.height })
        : embed.aspect === 'tall'
          ? <div className="mx-auto w-full max-w-[325px]">{frame('aspect-[9/16] w-full rounded-xl border-0 bg-black')}</div>
          : frame('aspect-video w-full rounded-xl border-0 bg-black')}
    </div>
  );
}
