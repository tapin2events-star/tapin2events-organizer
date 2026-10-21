import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { isAndroid, isAppMode, isIOS, isInAppBrowser } from '../lib/displayMode';

// "Get the TapIN app" bar for phones where Apple's built-in Safari banner doesn't appear:
// Android, Chrome/Firefox/Edge on iPhone, and in-app browsers (Facebook, Instagram...). Shown signed in or out.
// Hidden in the TapIN app itself, on Home Screen installs, on white-label and embed pages, and for 14 days after closing.
const KEY = 'tapin_get_app_closed';
const IOS = 'https://apps.apple.com/us/app/tapin2events/id6474884074';
const ANDROID = 'https://play.google.com/store/apps/details?id=net.tapin2events.app';

function shouldShow() {
  if (typeof navigator === 'undefined' || isAppMode()) return false;
  try { const t = Number(localStorage.getItem(KEY) || 0); if (t && Date.now() - t < 14 * 86400000) return false; } catch { /* private mode */ }
  const ua = navigator.userAgent;
  const android = isAndroid();
  const ios = isIOS();
  const realSafari = ios && /Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua) && !isInAppBrowser();
  return android || (ios && !realSafari);
}

export default function GetAppBanner({ hidden = false }: { hidden?: boolean }) {
  const [show, setShow] = useState(shouldShow);
  const loc = useLocation();
  if (!show || hidden || /^\/(embed|meetings\/[^/]+\/minutes|welcome)/.test(loc.pathname)) return null;
  const android = isAndroid();
  const close = () => { try { localStorage.setItem(KEY, String(Date.now())); } catch { /* ignore */ } setShow(false); };
  return (
    <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-3 py-2" role="region" aria-label="Get the TapIN app">
      <button onClick={close} aria-label="Close" className="shrink-0 px-1 text-lg leading-none text-gray-400">×</button>
      <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" className="h-9 w-9 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-900">TapIN2Events</p>
        <p className="truncate text-xs text-gray-500">Free on {android ? 'Google Play' : 'the App Store'}</p>
      </div>
      <a href={android ? ANDROID : IOS} target="_blank" rel="noopener" className="shrink-0 rounded-full bg-[#0F1B3D] px-4 py-1.5 text-sm font-semibold text-white">Get the app</a>
    </div>
  );
}
