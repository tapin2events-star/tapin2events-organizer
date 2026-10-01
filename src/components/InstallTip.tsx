import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { isIOS, isInAppBrowser, isPhoneSized, isStandalone } from '../lib/displayMode';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const KEY = 'tapin_install_tip';
const LATER_DAYS = 14;
// Never interrupt someone mid-checkout, signing in, or watching the feed.
const QUIET_PATHS = /^\/(login|feed|pass|checkout|organizer\/events\/[^/]+\/check-in)/;

function snoozed(): boolean {
  try {
    const v = localStorage.getItem(KEY);
    if (!v) return false;
    if (v === 'installed' || v === 'never') return true;
    return Date.now() < Number(v);
  } catch { return true; }
}
function snooze(value: string) { try { localStorage.setItem(KEY, value); } catch { /* ignore */ } }

// A one-time suggestion, on phones in a browser, to add TapIN to the Home Screen.
// Android/Chrome gets a real "Install" button; iPhone gets two-step instructions.
export default function InstallTip() {
  const { pathname } = useLocation();
  const [show, setShow] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const ios = typeof navigator !== 'undefined' && isIOS();

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as BeforeInstallPromptEvent); };
    const onInstalled = () => { snooze('installed'); setShow(false); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  useEffect(() => {
    if (isStandalone() || !isPhoneSized() || isInAppBrowser() || snoozed()) return;
    // Give people a moment with the app first.
    const t = window.setTimeout(() => setShow(true), 20000);
    return () => window.clearTimeout(t);
  }, []);

  if (!show || QUIET_PATHS.test(pathname)) return null;
  // On Android without an install prompt and not iPhone, there's nothing useful to offer.
  if (!ios && !deferred) return null;

  function later() { snooze(String(Date.now() + LATER_DAYS * 86400000)); setShow(false); }
  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    snooze(outcome === 'accepted' ? 'installed' : String(Date.now() + LATER_DAYS * 86400000));
    setDeferred(null);
    setShow(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Add TapIN to your Home Screen"
      className="fixed inset-x-3 z-[1150] mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl md:hidden"
      style={{ bottom: 'calc(5.75rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="flex items-start gap-3">
        <img src="/apple-touch-icon.png" alt="" className="h-12 w-12 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900">Get the TapIN app</p>
          <p className="mt-0.5 text-sm text-gray-600">Add TapIN to your Home Screen. It opens full screen, like a regular app.</p>
        </div>
        <button onClick={later} aria-label="Not now" className="-mr-1 -mt-1 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">✕</button>
      </div>
      {ios ? (
        <ol className="mt-3 space-y-1.5 rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
          <li className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-marigold text-xs font-bold text-white">1</span>
            <span>Tap the <strong>Share</strong> button
              <svg className="mx-1 inline-block align-[-3px] text-blue-600" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v13M7 8l5-5 5 5M5 12v8h14v-8" /></svg>
              in Safari{/* Safari's ••• menu on newer iPhones */} (or <strong>•••</strong> then Share)</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-marigold text-xs font-bold text-white">2</span>
            <span>Choose <strong>Add to Home Screen</strong></span>
          </li>
        </ol>
      ) : (
        <button onClick={install} className="mt-3 w-full rounded-xl bg-marigold py-3 text-sm font-semibold text-white hover:bg-marigold/90">Install TapIN</button>
      )}
      <button onClick={() => { snooze('never'); setShow(false); }} className="mt-2 w-full text-center text-xs text-gray-400 hover:text-gray-600">Don't show this again</button>
    </div>
  );
}
