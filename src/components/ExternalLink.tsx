import type { CSSProperties, ReactNode } from 'react';
import { normalizeUrl, openExternal } from '../lib/externalLink';

// A link to an outside website that opens in TapIN's website viewer (Ctrl/Cmd-click or middle-click still opens a
// normal new tab, and long-press can still copy the address).
export default function ExternalLink({ href, title, className, style, tooltip, children }: { href: string; title?: string; className?: string; style?: CSSProperties; tooltip?: string; children: ReactNode }) {
  const url = normalizeUrl(href);
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={className} style={style} title={tooltip}
      onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); openExternal(url, title); }}>
      {children}
    </a>
  );
}
