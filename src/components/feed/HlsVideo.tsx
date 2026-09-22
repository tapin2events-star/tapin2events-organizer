import { useEffect, useRef } from 'react';
import Hls from 'hls.js';

interface HlsVideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  src: string;
  videoRef?: (el: HTMLVideoElement | null) => void;
  shouldLoad: boolean;
  shouldPlay: boolean;
}

// Safari plays HLS (.m3u8) natively; every other browser needs hls.js to
// demux and feed it into a plain <video> tag via MediaSource.
//
// `shouldLoad` gates when the source actually attaches. A feed with many
// posts mounts many HlsVideo instances at once -- eagerly initializing
// hls.js (and its MediaSource) for every single one, including ones far
// off-screen, creates real resource contention that browsers (Chrome
// especially) don't handle gracefully, silently failing playback. Instead
// this only loads once the post has actually scrolled into view.
export default function HlsVideo({ src, videoRef, shouldLoad, shouldPlay, muted, ...rest }: HlsVideoProps) {
  const internalRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = internalRef.current;
    if (!video || !shouldLoad) return;

    // hls.js's own docs recommend checking its own support FIRST, falling
    // back to native canPlayType only if hls.js isn't available at all.
    // canPlayType('application/vnd.apple.mpegurl') is documented to be
    // unreliable across browsers for this MIME type -- checking it first
    // (as this code previously did) let some non-Safari browsers take the
    // native-playback branch incorrectly, setting the raw .m3u8 as `src`
    // directly, which they can't actually play (MEDIA_ERR_SRC_NOT_SUPPORTED).
    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.on(Hls.Events.ERROR, (_event, data) => {
        console.error('[HlsVideo] hls.js error:', {
          type: data.type,
          details: data.details,
          fatal: data.fatal,
          response: data.response,
          reason: data.reason,
          src,
        });
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      return () => hls.destroy();
    }

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      return;
    }

    // Last-resort fallback for a browser with neither -- just try it directly.
    video.src = src;
  }, [src, shouldLoad]);

  useEffect(() => {
    const video = internalRef.current;
    if (!video) return;
    const onError = () => {
      console.error('[HlsVideo] native <video> error:', video.error, 'src:', src);
    };
    video.addEventListener('error', onError);
    return () => video.removeEventListener('error', onError);
  }, [src]);

  // Autoplay needs to wait until the video can actually play -- calling
  // play() the instant a post scrolls into view (before hls.js has
  // finished parsing the manifest) gets interrupted by hls.js's own
  // subsequent load, producing an AbortError and silently failing. A
  // manual tap works because by then the video has caught up; autoplay
  // doesn't have that luxury, so this waits for readiness explicitly.
  useEffect(() => {
    const video = internalRef.current;
    if (!video) return;

    if (!shouldPlay) {
      video.pause();
      return;
    }

    if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      video.muted = !!muted;
      video.play().catch((err) => console.error('[HlsVideo] play() rejected:', err?.name, err?.message));
      return;
    }

    const onCanPlay = () => {
      video.muted = !!muted;
      video.play().catch((err) => console.error('[HlsVideo] play() rejected (after canplay):', err?.name, err?.message));
    };
    video.addEventListener('canplay', onCanPlay);
    return () => video.removeEventListener('canplay', onCanPlay);
  }, [shouldPlay, src, muted]);

  return (
    <video
      ref={(el) => {
        internalRef.current = el;
        videoRef?.(el);
      }}
      muted={muted}
      {...rest}
    />
  );
}
