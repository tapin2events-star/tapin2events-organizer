import { useCallback, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';

// "Adjust photo": drag to position and pinch/slide to zoom, inside a circle (profile photos), a square (logos) or a
// wide frame (cover images). Saves a NEW cropped image, so it looks right everywhere the photo appears
// (pages, cards, emails and shared-link previews), not only on TapIN's own screens.
export type CropShape = 'round' | 'square' | 'cover';
const ASPECT: Record<CropShape, number> = { round: 1, square: 1, cover: 16 / 9 };
const OUT_WIDTH: Record<CropShape, number> = { round: 800, square: 800, cover: 1600 };

async function cropToBlob(src: string, area: Area, shape: CropShape, png: boolean): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Couldn't load the photo."));
    i.src = src;
  });
  const width = Math.min(OUT_WIDTH[shape], Math.round(area.width));
  const height = Math.round(width / ASPECT[shape]);
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("Couldn't prepare the photo.");
  if (!png) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height); }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, width, height);
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't save the photo."))), png ? 'image/png' : 'image/jpeg', 0.9));
}

export default function PhotoCropper({ src, shape = 'round', png = false, onCancel, onDone }: { src: string; shape?: CropShape; png?: boolean; onCancel: () => void; onDone: (blob: Blob) => void }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const onComplete = useCallback((_a: Area, px: Area) => setArea(px), []);
  async function save() {
    if (!area) return;
    setBusy(true); setErr(null);
    try { onDone(await cropToBlob(src, area, shape, png)); }
    catch (e) {
      // Photos stored on some older services can't be re-cropped in the browser.
      setErr((e as Error)?.name === 'SecurityError' ? 'This photo can\u2019t be adjusted here. Upload it again (Change photo) to adjust it.' : (e as Error).message);
      setBusy(false);
    }
  }
  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black/90" role="dialog" aria-modal="true" aria-label="Adjust photo">
      <div className="flex items-center justify-between px-4 py-3 text-white" style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}>
        <button type="button" onClick={onCancel} className="text-sm font-medium text-white/80">Cancel</button>
        <p className="text-sm font-semibold">Adjust photo</p>
        <button type="button" onClick={save} disabled={busy || !area} className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-gray-900 disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
      </div>
      <div className="relative flex-1">
        <Cropper image={src} crop={crop} zoom={zoom} aspect={ASPECT[shape]} cropShape={shape === 'round' ? 'round' : 'rect'} showGrid={false}
          onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onComplete} objectFit="contain" />
      </div>
      <div className="px-6 py-4 text-white" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
        <p className="mb-2 text-center text-xs text-white/70">Drag to position · pinch or use the slider to zoom</p>
        <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label="Zoom" className="w-full accent-white" />
        {err && <p role="alert" className="mt-2 text-center text-sm text-red-300">{err}</p>}
      </div>
    </div>
  );
}
