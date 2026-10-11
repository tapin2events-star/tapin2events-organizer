// A branded cover for events without a photo: the category's colors, an icon,
// and (optionally) the title, instead of an empty box.
const THEMES: Record<string, { from: string; to: string; icon: string }> = {
  Music: { from: '#4F46E5', to: '#9333EA', icon: 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm12-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z' },
  'Arts & Culture': { from: '#DB2777', to: '#F59E0B', icon: 'M12 3a9 9 0 1 0 0 18c1.1 0 1.5-.8 1.5-1.5 0-.4-.2-.8-.4-1.1-.2-.3-.4-.6-.4-1 0-.8.7-1.4 1.5-1.4H16a5 5 0 0 0 5-5c0-4.4-4-8-9-8ZM7.5 12a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z' },
  Community: { from: '#0D9488', to: '#22C55E', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm14 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
  Nightlife: { from: '#1E1B4B', to: '#7C3AED', icon: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z' },
  'Food & Drink': { from: '#EA580C', to: '#F59E0B', icon: 'M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8Zm4-7v3m4-3v3m4-3v3' },
  Business: { from: '#1D4ED8', to: '#0EA5E9', icon: 'M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2ZM16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16' },
  'Sports & Fitness': { from: '#16A34A', to: '#0EA5E9', icon: 'M22 12h-4l-3 9L9 3l-3 9H2' },
  Other: { from: '#4F46E5', to: '#14B8A6', icon: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z' },
};

export default function EventCover({ category, title, className = '', size = 'md', showTitle = false }: {
  category?: string | null; title?: string | null; className?: string; size?: 'sm' | 'md' | 'lg'; showTitle?: boolean;
}) {
  const t = THEMES[category ?? ''] ?? THEMES.Other;
  const icon = size === 'sm' ? 22 : size === 'lg' ? 64 : 44;
  return (
    <div className={`relative flex items-center justify-center overflow-hidden ${className}`} style={{ backgroundImage: `linear-gradient(135deg, ${t.from}, ${t.to})` }} aria-hidden="true">
      {/* soft shapes for depth */}
      <span className="absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/10" />
      <span className="absolute -bottom-12 -left-6 h-36 w-36 rounded-full bg-black/10" />
      <div className="relative flex flex-col items-center gap-2 px-4 text-center">
        <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke="white" strokeOpacity="0.9" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={t.icon} /></svg>
        {showTitle && title && <p className="line-clamp-2 max-w-[90%] font-display text-base font-bold leading-snug text-white/95 drop-shadow">{title}</p>}
      </div>
    </div>
  );
}
