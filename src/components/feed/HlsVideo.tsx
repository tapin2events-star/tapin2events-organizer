import { useEffect, useRef } from 'react';
import Hls from 'hls.js';

interface HlsVideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  src: string;
  videoRef?: (el: HTMLVideoElement | null) => void;
}

// Safari plays HLS (.m3u8) natively; every other browser needs hls.js to
// demux and feed it into a plain <video> tag via MediaSource.
export default function HlsVideo({ src, videoRef, ...rest }: HlsVideoProps) {
  const internalRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = internalRef.current;
    if (!video) return;

    const canPlayNatively = video.canPlayType('application/vnd.apple.mpegurl');
    if (canPlayNatively) {
      video.src = src;
      return;
    }

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
      return () => hls.destroy();
    }

    // Last-resort fallback for a browser with neither -- just try it directly.
    video.src = src;
  }, [src]);

  return (
    <video
      ref={(el) => {
        internalRef.current = el;
        videoRef?.(el);
      }}
      {...rest}
    />
  );
}
