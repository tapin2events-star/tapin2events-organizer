import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

interface HlsVideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  src: string;
  videoRef?: (el: HTMLVideoElement | null) => void;
  shouldLoad: boolean;
  shouldPlay: boolean;
}

// Apple's own WebKit engine (every browser on iPhone/iPad, plus desktop
// Safari) plays HLS natively and reliably -- and its autoplay rules are
// built around that native path. hls.js 1.7 can also run on iOS via
// Managed Media Source, but routing iPhones through it broke autoplay, so
// native is preferred there. Everywhere else, hls.js is used: desktop
// Chrome's newer built-in HLS reports canPlayType() as supported but
// failed on these streams (confirmed: MediaError code 4).
function prefersNativeHls(video: HTMLVideoElement): boolean {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isDesktopSafari = /^((?!chrome|chromium|crios|fxios|edg|android).)*safari/i.test(ua);
  return (isIOS || isDesktopSafari) && !!video.canPlayType('application/vnd.apple.mpegurl');
}

export default function HlsVideo({ src, videoRef, shouldLoad, shouldPlay, muted, ...rest }: HlsVideoProps) {
  const internalRef = useRef<HTMLVideoElement | null>(null);
  const [needsTap, setNeedsTap] = useState(false);

  // React sets the `muted` *property* but never writes the `muted`
  // *attribute* to the DOM (a long-standing React quirk). Safari's autoplay
  // policy looks at the attribute / defaultMuted, so without this a fresh
  // page load (no prior tap) gets treated as "may have sound" and blocked.
  // Declared first so it runs before the load/play effects in each commit.
  useEffect(() => {
    const video = internalRef.current;
    if (!video) return;
    video.defaultMuted = !!muted;
    video.muted = !!muted;
    if (muted) video.setAttribute('muted', '');
    else video.removeAttribute('muted');
  }, [muted]);

  useEffect(() => {
    const video = internalRef.current;
    if (!video || !shouldLoad) return;

    if (prefersNativeHls(video)) {
      video.src = src;
      return;
    }

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        console.error('[HlsVideo] hls.js fatal error:', { type: data.type, details: data.details, src });
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      return () => hls.destroy();
    }

    // Last resort for a browser with neither -- just try it directly.
    video.src = src;
  }, [src, shouldLoad]);

  useEffect(() => {
    const video = internalRef.current;
    if (!video) return;
    const onError = () => console.error('[HlsVideo] native <video> error:', video.error, 'src:', src);
    const onPlaying = () => setNeedsTap(false);
    video.addEventListener('error', onError);
    video.addEventListener('playing', onPlaying);
    return () => {
      video.removeEventListener('error', onError);
      video.removeEventListener('playing', onPlaying);
    };
  }, [src]);

  // Autoplay: try as soon as the video can actually play, retrying on the
  // next `canplay` if a load interrupted the attempt (AbortError). If the
  // browser outright refuses (NotAllowedError), show a clear play button
  // instead of leaving what looks like a frozen frame.
  useEffect(() => {
    const video = internalRef.current;
    if (!video) return;

    if (!shouldPlay) {
      video.pause();
      setNeedsTap(false);
      return;
    }
    if (!shouldLoad) return;

    let cancelled = false;
    const attempt = () => {
      if (cancelled) return;
      const playPromise = video.play();
      if (!playPromise) return;
      playPromise
        .then(() => {
          if (cancelled) return;
          setNeedsTap(false);
          video.removeEventListener('canplay', attempt);
        })
        .catch((err) => {
          if (cancelled) return;
          if (err?.name === 'NotAllowedError') setNeedsTap(true);
          else if (err?.name !== 'AbortError') console.error('[HlsVideo] play() rejected:', err?.name, err?.message);
          // AbortError = a newer load interrupted this attempt; the next
          // `canplay` event retries automatically.
        });
    };

    // Call play() immediately rather than waiting for readiness: iOS Safari
    // won't download any video data until play() is called, so waiting for
    // `canplay` first deadlocks (the video waits for play, play waits for the
    // video). If an immediate attempt gets interrupted by a load (hls.js on
    // desktop), the `canplay` listener retries once the video is ready.
    video.addEventListener('canplay', attempt);
    attempt();

    return () => {
      cancelled = true;
      video.removeEventListener('canplay', attempt);
    };
  }, [shouldPlay, shouldLoad, src]);

  return (
    <>
      <video
        ref={(el) => {
          internalRef.current = el;
          videoRef?.(el);
        }}
        muted={muted}
        {...rest}
      />
      {needsTap && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/50 text-white">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          </div>
        </div>
      )}
    </>
  );
}
