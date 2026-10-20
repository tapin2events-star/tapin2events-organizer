import { useEffect } from 'react';
import { useSetup } from './setup';

// Display preferences: text size (scales the whole app) and Simple mode. Cached on the device so the right size
// shows immediately on the next visit, and saved to the account so it follows the person to other devices.
export type TextSize = 'normal' | 'large' | 'xlarge';
const SIZES: Record<TextSize, string> = { normal: '', large: '112.5%', xlarge: '125%' };
export function applyTextSize(size: TextSize | null | undefined) {
  const v = SIZES[(size ?? 'normal') as TextSize] ?? '';
  document.documentElement.style.fontSize = v;
  try { localStorage.setItem('tapin_text_size', size ?? 'normal'); } catch { /* ignore */ }
}
export function applyCachedDisplay() {
  try { applyTextSize((localStorage.getItem('tapin_text_size') as TextSize) || 'normal'); } catch { /* ignore */ }
}
// Simple mode is cached on the device too, so pages don't show extras for a moment and then hide them
// while the account's settings load.
const cachedSimple = () => { try { return localStorage.getItem('tapin_simple_mode') === '1'; } catch { return false; } };
export function useDisplayPrefs() {
  const s = useSetup();
  useEffect(() => { if (s?.text_size) applyTextSize(s.text_size); }, [s?.text_size]);
  const loaded = !!s && typeof s.simple_mode === 'boolean';
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem('tapin_simple_mode', s!.simple_mode ? '1' : '0'); } catch { /* ignore */ }
  }, [loaded, s?.simple_mode]); // eslint-disable-line react-hooks/exhaustive-deps
  return { simple: loaded ? !!s!.simple_mode : cachedSimple(), textSize: (s?.text_size ?? 'normal') as TextSize };
}
