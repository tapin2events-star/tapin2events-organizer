import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import Sheet from './scouting/Sheet';

// A QR code for a TapIN page (event or profile): show it on a phone screen,
// print it on a flyer, or save/share the image.
export default function ShareQR({ path, title, subtitle, label = 'QR code', className = '' }: {
  path: string; title: string; subtitle?: string; label?: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [png, setPng] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
  const fileName = `tapin-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'qr'}.png`;

  useEffect(() => {
    if (!open || png) return;
    QRCode.toDataURL(url, { width: 900, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#111827', light: '#ffffff' } }).then(setPng).catch(() => setPng(null));
  }, [open, url, png]);

  async function saveImage() {
    if (!png) return;
    try {
      const blob = await (await fetch(png)).blob();
      const file = new File([blob], fileName, { type: 'image/png' });
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
      if (nav.share && nav.canShare?.({ files: [file] })) { await nav.share({ files: [file], title }); return; }
    } catch { /* fall back to a download */ }
    const a = document.createElement('a');
    a.href = png; a.download = fileName; document.body.appendChild(a); a.click(); a.remove();
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { /* link is shown for copying by hand */ }
  }
  async function shareLink() {
    try { if (navigator.share) await navigator.share({ title, url }); else await copyLink(); } catch { /* cancelled */ }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className || 'inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-marigold'}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3M21 14v.01M14 21h3M21 17v4" /></svg>
        {label}
      </button>
      {open && (
        <Sheet title="Share with a QR code" onClose={() => setOpen(false)}>
          <div className="text-center">
            <p className="font-display text-lg font-bold text-gray-900">{title}</p>
            {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
            <div className="mx-auto mt-4 w-64 max-w-full rounded-2xl border border-gray-200 bg-white p-3">
              {png ? <img src={png} alt={`QR code for ${title}`} className="h-auto w-full" /> : <div className="aspect-square w-full animate-pulse rounded-xl bg-gray-100" />}
            </div>
            <p className="mt-2 text-xs text-gray-500">Point a phone camera at the code to open the page.</p>
            <p className="mx-auto mt-1 max-w-xs truncate text-xs text-gray-400">{url}</p>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            <button type="button" onClick={saveImage} disabled={!png} className="rounded-xl bg-marigold px-2 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Save image</button>
            <button type="button" onClick={copyLink} className="rounded-xl border border-gray-300 bg-white px-2 py-2.5 text-sm font-medium text-gray-700">{copied ? 'Copied!' : 'Copy link'}</button>
            <button type="button" onClick={shareLink} className="rounded-xl border border-gray-300 bg-white px-2 py-2.5 text-sm font-medium text-gray-700">Share link</button>
          </div>
          <p className="mt-3 text-center text-xs text-gray-400">Tip: add the saved image to flyers, posters, table signs, or your slides.</p>
        </Sheet>
      )}
    </>
  );
}
