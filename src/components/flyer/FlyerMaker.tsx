import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { supabase } from '../../lib/supabaseClient';
import { drawFlyer, PALETTES, SIZES, type FlyerSize, type FlyerStyle } from './renderFlyer';

export interface FlyerEventInfo {
  id?: string;
  title: string;
  category: string;
  description: string;
  startDate: string; // datetime-local value, e.g. 2026-10-30T20:00
  endDate: string;
  isOnline: boolean;
  locationName: string;
  locationAddress: string;
  eventType: 'free' | 'paid' | 'private';
  ticketPrice: string;
}

const STYLES: { id: FlyerStyle; label: string }[] = [
  { id: 'bold', label: 'Bold' },
  { id: 'photo', label: 'Photo' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'split', label: 'Split' },
];

function timeLabel(d: Date) {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(':00', '');
}

// Formats the organizer's own form values into flyer text. Nothing here
// comes from the AI, so dates, times, venue, and price are always exact.
function formatDetails(e: FlyerEventInfo) {
  const start = e.startDate ? new Date(e.startDate) : null;
  const end = e.endDate ? new Date(e.endDate) : null;
  let dateLine = 'DATE TO BE ANNOUNCED';
  let timeLine = '';
  if (start && !isNaN(start.getTime())) {
    const sameDay = !end || end.toDateString() === start.toDateString();
    dateLine = sameDay
      ? start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()
      : `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end!.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`.toUpperCase();
    timeLine = end && sameDay && !isNaN(end.getTime()) ? `${timeLabel(start)} – ${timeLabel(end)}` : timeLabel(start);
  }
  const price = Number(e.ticketPrice);
  const priceLine =
    e.eventType === 'free' ? 'FREE' : e.eventType === 'paid' && price > 0 ? `$${Number.isInteger(price) ? price : price.toFixed(2)}` : '';
  return {
    dateLine,
    timeLine,
    venueLine: e.isOnline ? 'Online event' : e.locationName.trim(),
    addressLine: e.isOnline ? '' : e.locationAddress.trim(),
    priceLine,
    qrCaption: e.eventType === 'paid' ? 'SCAN FOR TICKETS' : 'SCAN FOR DETAILS',
  };
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export default function FlyerMaker({ event, onClose, onUseAsPoster }: { event: FlyerEventInfo; onClose: () => void; onUseAsPoster: (file: File) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [style, setStyle] = useState<FlyerStyle>('bold');
  const [paletteId, setPaletteId] = useState('midnight');
  const [size, setSize] = useState<FlyerSize>('post');
  const [headline, setHeadline] = useState(event.title);
  const [tagline, setTagline] = useState('');
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [qr, setQr] = useState<HTMLImageElement | null>(null);
  const [fontsReady, setFontsReady] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'download' | 'poster' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // The flyer fonts (Big Shoulders Display, Public Sans) are loaded by the
  // page; wait for them so the first render isn't in a fallback font.
  useEffect(() => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        setFontsReady(true);
      }
    };
    Promise.all([
      document.fonts.load('800 120px "Big Shoulders Display"'),
      document.fonts.load('700 40px "Public Sans"'),
      document.fonts.load('400 40px "Public Sans"'),
    ]).then(finish, finish);
    const t = setTimeout(finish, 2500);
    return () => clearTimeout(t);
  }, []);

  // QR code to the event page -- only once the event exists (has been saved).
  useEffect(() => {
    if (!event.id) return;
    const url = `${window.location.origin}${import.meta.env.BASE_URL}events/${event.id}`;
    QRCode.toDataURL(url, { margin: 1, width: 512 }).then(loadImage).then(setQr).catch(() => setQr(null));
  }, [event.id]);

  async function suggest(hasPhoto: boolean) {
    setAiLoading(true);
    setAiError(null);
    const { data, error } = await supabase.functions.invoke('generate-flyer-copy', {
      body: { title: event.title, category: event.category, description: event.description, has_photo: hasPhoto },
    });
    setAiLoading(false);
    if (error || !data?.headline) {
      setAiError("Couldn't get suggestions right now. You can still design it yourself.");
      return;
    }
    setHeadline(data.headline);
    setTagline(data.tagline ?? '');
    setPaletteId(data.palette);
    setStyle(hasPhoto ? 'photo' : data.style);
  }

  useEffect(() => {
    suggest(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const palette = PALETTES.find((p) => p.id === paletteId) ?? PALETTES[0];
  const content = () => ({ headline: headline.trim() || event.title, tagline: tagline.trim(), ...formatDetails(event), qr, photo });

  useEffect(() => {
    if (!canvasRef.current || !fontsReady) return;
    drawFlyer(canvasRef.current, style, palette, size, content());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style, paletteId, size, headline, tagline, photo, qr, fontsReady, event]);

  function handlePhoto(file: File) {
    if (!file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    loadImage(url).then((img) => {
      setPhoto(img);
      setStyle('photo');
    });
  }

  function toBlob(canvas: HTMLCanvasElement | null = canvasRef.current, type = 'image/png', quality?: number): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!canvas) {
        resolve(null);
        return;
      }
      try {
        canvas.toBlob((b) => resolve(b), type, quality);
      } catch {
        resolve(null);
      }
    });
  }

  async function download() {
    setBusy('download');
    setExportError(null);
    const blob = await toBlob();
    setBusy(null);
    if (!blob) {
      setExportError("Couldn't save the flyer. Please try again.");
      return;
    }
    const slug = (event.title || 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${slug}-flyer-${size}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  async function useAsPoster() {
    setBusy('poster');
    setExportError(null);
    const posterCanvas = document.createElement('canvas');
    drawFlyer(posterCanvas, style, palette, size, content(), 1080);
    const blob = await toBlob(posterCanvas, 'image/jpeg', 0.9);
    setBusy(null);
    if (!blob) {
      setExportError("Couldn't save the flyer. Please try again.");
      return;
    }
    onUseAsPoster(new File([blob], 'flyer.jpg', { type: 'image/jpeg' }));
    onClose();
  }

  const pill = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-sm font-medium ${active ? 'bg-marigold text-white' : 'bg-gray-100 text-muted hover:bg-gray-200'}`;

  return (
    <div className="fixed inset-0 z-[1100] overflow-y-auto bg-black/60 p-3 sm:p-6" onClick={onClose}>
      <div className="mx-auto flex max-w-5xl flex-col gap-5 rounded-2xl bg-surface p-4 shadow-2xl sm:p-6 md:flex-row" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-1 items-start justify-center rounded-xl bg-gray-100 p-3">
          <canvas ref={canvasRef} className="h-auto max-h-[70vh] w-auto max-w-full rounded-lg shadow-lg" />
        </div>

        <div className="flex w-full flex-col gap-4 md:w-80">
          <div className="flex items-start justify-between">
            <p className="font-display text-xl font-bold text-bone">Make a flyer</p>
            <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-bone">✕</button>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-bone">Headline</p>
              <button type="button" onClick={() => suggest(!!photo)} disabled={aiLoading} className="text-xs font-medium text-marigold disabled:opacity-50">
                {aiLoading ? 'Thinking…' : '✨ New idea'}
              </button>
            </div>
            <input value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={80} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900" />
            <p className="mt-2 text-sm font-medium text-bone">Tagline <span className="font-normal text-muted">(optional)</span></p>
            <input value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={100} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900" />
            {aiError && <p className="mt-1 text-xs text-magenta">{aiError}</p>}
          </div>

          <div>
            <p className="text-sm font-medium text-bone">Style</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {STYLES.map((s) => (
                <button key={s.id} type="button" onClick={() => setStyle(s.id)} className={pill(style === s.id)}>
                  {s.label}
                </button>
              ))}
            </div>
            {style === 'photo' && !photo && <p className="mt-1 text-xs text-muted">Add a photo below to use this style.</p>}
          </div>

          <div>
            <p className="text-sm font-medium text-bone">Colors</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {PALETTES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPaletteId(p.id)}
                  title={p.name}
                  aria-label={p.name}
                  className={`h-8 w-8 rounded-full ${paletteId === p.id ? 'ring-2 ring-marigold ring-offset-2' : ''}`}
                  style={{ background: `linear-gradient(135deg, ${p.from}, ${p.to})` }}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-bone">Photo <span className="font-normal text-muted">(optional)</span></p>
            <div className="mt-1 flex items-center gap-2">
              <label className="cursor-pointer rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-bone hover:border-marigold">
                {photo ? 'Change photo' : 'Add a photo'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) handlePhoto(f);
                  }}
                />
              </label>
              {photo && (
                <button type="button" onClick={() => { setPhoto(null); if (style === 'photo') setStyle('bold'); }} className="text-sm text-muted hover:text-bone">
                  Remove
                </button>
              )}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-bone">Size</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {(Object.keys(SIZES) as FlyerSize[]).map((k) => (
                <button key={k} type="button" onClick={() => setSize(k)} className={pill(size === k)}>
                  {SIZES[k].label}
                </button>
              ))}
            </div>
          </div>

          <p className="rounded-lg bg-surface2 px-3 py-2 text-xs text-muted">
            Date, time, place, and price come straight from your event details, so they're always exact. Edit them in the form to change them here.
            {!event.id && ' A QR code linking to your event page is added once the event has been saved.'}
          </p>

          <div className="mt-auto flex flex-col gap-2">
            <button type="button" onClick={useAsPoster} disabled={!!busy || !fontsReady} className="rounded-lg bg-marigold px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              {busy === 'poster' ? 'Saving…' : 'Use as event poster'}
            </button>
            <button type="button" onClick={download} disabled={!!busy || !fontsReady} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-bone hover:border-marigold disabled:opacity-50">
              {busy === 'download' ? 'Preparing…' : 'Download'}
            </button>
            {exportError && <p className="text-sm text-magenta">{exportError}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
