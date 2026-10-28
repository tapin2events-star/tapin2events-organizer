// A CD printed with the cover art. It spins while playing (CSS animation, paused otherwise).
export default function CdDisc({ cover, spinning, size = 160, label }: { cover?: string | null; spinning: boolean; size?: number; label?: string }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-hidden={label ? undefined : true} role={label ? 'img' : undefined} aria-label={label}>
      <div className={`h-full w-full overflow-hidden rounded-full shadow-[0_6px_24px_rgba(0,0,0,0.25)] ring-4 ring-gray-900/80 ${spinning ? 'animate-[spin_4s_linear_infinite]' : ''}`}
        style={{ background: cover ? undefined : 'conic-gradient(from 0deg, #4F46E5, #14B8A6, #F59E0B, #4F46E5)' }}>
        {cover && <img src={cover} alt="" className="h-full w-full object-cover" draggable={false} />}
        <div className="pointer-events-none absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,rgba(255,255,255,0.18),rgba(255,255,255,0)_30%,rgba(255,255,255,0.14)_55%,rgba(255,255,255,0)_80%,rgba(255,255,255,0.18))]" />
      </div>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gray-100 ring-2 ring-gray-300" style={{ width: size * 0.2, height: size * 0.2 }} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" style={{ width: size * 0.09, height: size * 0.09 }} />
    </div>
  );
}
