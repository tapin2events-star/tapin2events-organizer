import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabase } from './supabaseClient';

// The app-wide music player: one audio source, a queue (an album, a single, or an artist's songs), and the mini player
// that keeps playing while you browse. Plays are counted once per song per session.
export interface PlayerTrack { id: string; title: string; url: string; duration_sec?: number | null; artist: string; artistId?: string; cover?: string | null; albumId?: string | null; albumTitle?: string | null }
interface PlayerState { queue: PlayerTrack[]; index: number; playing: boolean; progress: number; duration: number; current: PlayerTrack | null }
interface PlayerApi extends PlayerState {
  play: (queue: PlayerTrack[], index?: number) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (fraction: number) => void;
  close: () => void;
}
const Ctx = createContext<PlayerApi | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const counted = useRef<Set<string>>(new Set());
  const [queue, setQueue] = useState<PlayerTrack[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const current = queue[index] ?? null;

  const el = () => {
    if (!audio.current) {
      const a = new Audio();
      a.preload = 'metadata';
      a.ontimeupdate = () => { setProgress(a.currentTime); setDuration(a.duration || 0); };
      a.onloadedmetadata = () => setDuration(a.duration || 0);
      a.onplay = () => setPlaying(true);
      a.onpause = () => setPlaying(false);
      audio.current = a;
    }
    return audio.current;
  };
  const load = useCallback((t: PlayerTrack) => {
    const a = el();
    if (a.src !== t.url) { a.src = t.url; setProgress(0); setDuration(t.duration_sec ?? 0); }
    a.play().then(() => {
      if (!counted.current.has(t.id)) { counted.current.add(t.id); supabase.rpc('record_track_play', { p_track_id: t.id }); }
    }).catch(() => setPlaying(false));
  }, []);

  const play = useCallback((q: PlayerTrack[], i = 0) => { if (!q.length) return; setQueue(q); setIndex(i); load(q[i]); }, [load]);
  const toggle = useCallback(() => { const a = el(); if (!current) return; if (a.paused) { if (!a.src) load(current); else a.play().catch(() => undefined); } else a.pause(); }, [current, load]);
  const next = useCallback(() => { if (index + 1 < queue.length) { setIndex(index + 1); load(queue[index + 1]); } else { el().pause(); el().currentTime = 0; setProgress(0); } }, [index, queue, load]);
  const prev = useCallback(() => { const a = el(); if (a.currentTime > 3 || index === 0) { a.currentTime = 0; setProgress(0); return; } setIndex(index - 1); load(queue[index - 1]); }, [index, queue, load]);
  const seek = useCallback((f: number) => { const a = el(); if (a.duration) a.currentTime = Math.max(0, Math.min(1, f)) * a.duration; }, []);
  const close = useCallback(() => { const a = el(); a.pause(); a.removeAttribute('src'); a.load(); setQueue([]); setIndex(0); setProgress(0); setDuration(0); setPlaying(false); }, []);
  // Go to the next song when one ends (reads the latest queue/index).
  useEffect(() => { const a = el(); a.onended = () => next(); }, [next]);
  // Lock-screen / headphone controls where supported.
  useEffect(() => {
    if (!('mediaSession' in navigator) || !current) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: current.title, artist: current.artist, album: current.albumTitle ?? '', artwork: current.cover ? [{ src: current.cover }] : [] });
      navigator.mediaSession.setActionHandler('play', () => el().play());
      navigator.mediaSession.setActionHandler('pause', () => el().pause());
      navigator.mediaSession.setActionHandler('nexttrack', next);
      navigator.mediaSession.setActionHandler('previoustrack', prev);
    } catch { /* unsupported */ }
  }, [current, next, prev]);

  const value = useMemo<PlayerApi>(() => ({ queue, index, playing, progress, duration, current, play, toggle, next, prev, seek, close }), [queue, index, playing, progress, duration, current, play, toggle, next, prev, seek, close]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function usePlayer() { const c = useContext(Ctx); if (!c) throw new Error('usePlayer outside PlayerProvider'); return c; }
export const fmtTime = (s: number) => (Number.isFinite(s) && s > 0 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00');
