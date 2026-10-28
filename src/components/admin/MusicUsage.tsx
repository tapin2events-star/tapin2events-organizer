import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

// Admin: music storage used on Cloudflare R2 (the free tier covers 10 GB a month).
export default function MusicUsage() {
  const [u, setU] = useState<{ tracks: number; bytes: number; profiles: number } | null>(null);
  useEffect(() => { supabase.rpc('admin_music_usage').then(({ data }) => setU((data ?? null) as typeof u)); }, []);
  if (!u) return null;
  const gb = u.bytes / 1024 ** 3;
  const pct = Math.min(100, (gb / 10) * 100);
  return (
    <section className="rounded-2xl border border-gray-200 bg-surface p-4">
      <h3 className="font-display text-lg font-semibold text-bone">🎵 Music storage</h3>
      <p className="mt-1 text-sm text-muted">{u.tracks} song{u.tracks === 1 ? '' : 's'} on {u.profiles} profile{u.profiles === 1 ? '' : 's'} · {gb < 0.1 ? `${(u.bytes / 1024 ** 2).toFixed(1)} MB` : `${gb.toFixed(2)} GB`} of 10 GB free</p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200"><div className={`h-full ${pct > 80 ? 'bg-amber-500' : 'bg-marigold'}`} style={{ width: `${Math.max(pct, u.bytes ? 1 : 0)}%` }} /></div>
      {pct > 80 && <p className="mt-1 text-xs text-amber-800">Getting close to the free 10 GB. Beyond it, storage costs about $0.015 per GB a month; streaming stays free.</p>}
    </section>
  );
}
