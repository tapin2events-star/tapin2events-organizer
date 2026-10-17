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
export function useDisplayPrefs() {
  const s = useSetup();
  useEffect(() => { if (s?.text_size) applyTextSize(s.text_size); }, [s?.text_size]);
  return { simple: !!s?.simple_mode, textSize: (s?.text_size ?? 'normal') as TextSize };
}
