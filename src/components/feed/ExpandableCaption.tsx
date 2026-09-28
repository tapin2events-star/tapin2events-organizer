import { useLayoutEffect, useRef, useState } from 'react';

// A post caption that shows two lines, with "See more" when it's longer. The
// full text opens in its own scrollable panel (so a long caption never covers
// the whole video), with "See less" to close it.
export default function ExpandableCaption({ text, className = '' }: { text: string; className?: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  // Is the collapsed text cut off? Re-checked when the text or the width changes.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    const check = () => setOverflowing(el.scrollHeight - el.clientHeight > 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, expanded]);

  return (
    <div className={className}>
      {expanded ? (
        <>
          <div className="max-h-[30dvh] overflow-y-auto overscroll-contain rounded-xl bg-black/60 p-3 backdrop-blur-sm">
            <p className="whitespace-pre-line break-words text-sm leading-relaxed">{text}</p>
          </div>
          <button type="button" onClick={() => setExpanded(false)} className="-mb-1 py-2 text-sm font-semibold text-white underline">
            See less
          </button>
        </>
      ) : (
        <>
          <p
            ref={ref}
            className="whitespace-pre-line break-words text-sm"
            style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {text}
          </p>
          {overflowing && (
            <button type="button" onClick={() => setExpanded(true)} className="-mb-1 py-2 text-sm font-semibold text-white/90 underline">
              See more
            </button>
          )}
        </>
      )}
    </div>
  );
}
