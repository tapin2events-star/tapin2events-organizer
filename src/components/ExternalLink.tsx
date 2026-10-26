import type { CSSProperties, ReactNode } from 'react';
import { normalizeUrl } from '../lib/externalLink';

// A plain link to an outside website (opens in a new tab / the app's normal handling).
export default function ExternalLink({ href, className, style, tooltip, children }: { href: string; title?: string; className?: string; style?: CSSProperties; tooltip?: string; children: ReactNode }) {
  return <a href={normalizeUrl(href)} target="_blank" rel="noopener noreferrer" className={className} style={style} title={tooltip}>{children}</a>;
}
