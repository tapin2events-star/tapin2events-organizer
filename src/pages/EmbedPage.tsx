import { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import OrgPublic from './business/OrgPublic';

// Website embed: an organization's full page on its own website (<div class="tapin-events" data-org="slug" data-view="page">).
// Sizes itself to fit (tells the page around it how tall it is), and every link opens on TapIN in a new tab, so visitors
// never get stuck inside the frame.
export default function EmbedPage() {
  const { slug } = useParams<{ slug: string }>();
  const frame = new URLSearchParams(window.location.search).get('frame') ?? '';
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!root.current) return;
    const send = () => window.parent?.postMessage({ tapinEmbed: true, frame, height: root.current?.scrollHeight ?? 0 }, '*');
    const ro = new ResizeObserver(send); ro.observe(root.current); send();
    return () => ro.disconnect();
  }, [frame]);
  return (
    <div ref={root} className="overflow-x-clip px-4 pt-4"
      onClickCapture={(e) => {
        const a = (e.target as HTMLElement).closest('a');
        if (!a || !a.href || a.target === '_blank') return;
        e.preventDefault(); e.stopPropagation();
        const url = new URL(a.href, window.location.href);
        window.open(url.origin === window.location.origin ? `https://app.tapin2events.com${url.pathname}${url.search}${url.hash}` : url.href, '_blank', 'noopener');
      }}>
      {slug && <OrgPublic slugOverride={slug} embedded />}
    </div>
  );
}
