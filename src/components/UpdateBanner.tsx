import { useEffect, useState } from 'react';

// When a new version of TapIN is published, people who already have it open keep the old copy until it fully
// restarts. Check for a new version when TapIN comes back on screen (and every 5 minutes while open), and offer a
// one-tap refresh.
function currentEntry(): string | null {
  const el = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]');
  return el ? new URL(el.src, window.location.href).pathname : null;
}
export default function UpdateBanner() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const mine = currentEntry();
    if (!mine) return;
    let stopped = false;
    const check = async () => {
      if (stopped || document.hidden) return;
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}index.html?v=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const html = await res.text();
        const m = html.match(/src="([^"]*\/assets\/index-[^"]+\.js)"/);
        if (m && new URL(m[1], window.location.href).pathname !== mine) setReady(true);
      } catch { /* offline: try again later */ }
    };
    const onVisible = () => { if (!document.hidden) check(); };
    document.addEventListener('visibilitychange', onVisible);
    const t = setInterval(check, 5 * 60 * 1000);
    const first = setTimeout(check, 20 * 1000);
    return () => { stopped = true; document.removeEventListener('visibilitychange', onVisible); clearInterval(t); clearTimeout(first); };
  }, []);
  if (!ready) return null;
  return (
    <div className="fixed inset-x-0 z-[1400] flex justify-center px-4" style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }} role="status">
      <div className="flex items-center gap-3 rounded-full bg-[#0F1B3D] py-2 pl-4 pr-2 text-sm text-white shadow-xl">
        <span>✨ TapIN was updated</span>
        <button onClick={() => window.location.reload()} className="rounded-full bg-white px-3 py-1.5 text-sm font-bold text-[#0F1B3D]">Refresh</button>
        <button onClick={() => setReady(false)} aria-label="Later" className="px-1 text-white/70">×</button>
      </div>
    </div>
  );
}
