// Draws an event flyer onto a canvas. Everything factual (date, time, venue,
// price) is typed onto the flyer exactly as the organizer entered it -- the
// AI only ever supplies the headline, tagline, and a palette/style choice.

export type FlyerStyle = 'bold' | 'photo' | 'minimal' | 'split';
export type FlyerSize = 'post' | 'story' | 'print';

export interface Palette {
  id: string;
  name: string;
  from: string;
  to: string;
  accent: string;
  text: string;
  sub: string;
  strong: string; // a dark, saturated version readable on white
}

// Keep ids in sync with the generate-flyer-copy edge function.
export const PALETTES: Palette[] = [
  { id: 'midnight', name: 'Midnight', from: '#1e1b4b', to: '#6b21a8', accent: '#fbbf24', text: '#ffffff', sub: '#ddd6fe', strong: '#5b21b6' },
  { id: 'sunset', name: 'Sunset', from: '#ea580c', to: '#db2777', accent: '#fef08a', text: '#ffffff', sub: '#ffedd5', strong: '#c2410c' },
  { id: 'ocean', name: 'Ocean', from: '#0c4a6e', to: '#0d9488', accent: '#fde68a', text: '#ffffff', sub: '#ccfbf1', strong: '#0c4a6e' },
  { id: 'forest', name: 'Forest', from: '#14532d', to: '#4d7c0f', accent: '#fcd34d', text: '#ffffff', sub: '#dcfce7', strong: '#166534' },
  { id: 'gold', name: 'Black & Gold', from: '#0a0a0a', to: '#292524', accent: '#eab308', text: '#ffffff', sub: '#d6d3d1', strong: '#a16207' },
  { id: 'candy', name: 'Candy', from: '#be185d', to: '#7c3aed', accent: '#fbcfe8', text: '#ffffff', sub: '#fce7f3', strong: '#be185d' },
  { id: 'earth', name: 'Earth', from: '#78350f', to: '#b45309', accent: '#fef3c7', text: '#ffffff', sub: '#fde68a', strong: '#78350f' },
  { id: 'mono', name: 'Mono', from: '#111827', to: '#374151', accent: '#f87171', text: '#ffffff', sub: '#d1d5db', strong: '#111827' },
  { id: 'brand', name: 'TapIN', from: '#4f46e5', to: '#14b8a6', accent: '#fde047', text: '#ffffff', sub: '#e0e7ff', strong: '#4338ca' },
];

export const SIZES: Record<FlyerSize, { label: string; width: number; height: number }> = {
  post: { label: 'Instagram post', width: 1080, height: 1350 },
  story: { label: 'Instagram story', width: 1080, height: 1920 },
  print: { label: 'Print (8.5×11)', width: 2550, height: 3300 },
};

export interface FlyerContent {
  headline: string;
  tagline: string;
  dateLine: string;
  timeLine: string;
  venueLine: string;
  addressLine: string;
  priceLine: string;
  qrCaption: string;
  qr: HTMLImageElement | null;
  photo: HTMLImageElement | null;
}

const DISPLAY = '"Big Shoulders Display", Impact, "Arial Narrow", sans-serif';
const BODY = '"Public Sans", system-ui, -apple-system, sans-serif';
const W = 1080; // everything is laid out in a 1080-wide coordinate space, then scaled

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth || !line) line = test;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Largest font size (stepping down) at which the text wraps within the box.
function fitBlock(ctx: CanvasRenderingContext2D, text: string, font: (px: number) => string, maxWidth: number, maxHeight: number, maxPx: number, minPx: number, lineHeight: number) {
  for (let px = maxPx; px >= minPx; px -= 4) {
    ctx.font = font(px);
    const lines = wrap(ctx, text, maxWidth);
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if (lines.length * px * lineHeight <= maxHeight && widest <= maxWidth) return { px, lines };
  }
  ctx.font = font(minPx);
  return { px: minPx, lines: wrap(ctx, text, maxWidth) };
}

// Single line, shrunk until it fits the width.
function fitLine(ctx: CanvasRenderingContext2D, text: string, font: (px: number) => string, maxWidth: number, maxPx: number, minPx = 18) {
  let px = maxPx;
  ctx.font = font(px);
  while (px > minPx && ctx.measureText(text).width > maxWidth) {
    px -= 2;
    ctx.font = font(px);
  }
  return px;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function gradientBg(ctx: CanvasRenderingContext2D, p: Palette, h: number) {
  const g = ctx.createLinearGradient(0, 0, W, h);
  g.addColorStop(0, p.from);
  g.addColorStop(1, p.to);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, h);
  // Soft decorative shapes for depth.
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = p.accent;
  ctx.beginPath();
  ctx.arc(W - 60, 120, 320, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.07;
  ctx.beginPath();
  ctx.arc(80, h - 80, 260, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawQr(ctx: CanvasRenderingContext2D, qr: HTMLImageElement, x: number, y: number, size: number, caption: string, captionColor: string) {
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, x, y, size, size, 18);
  ctx.fill();
  const pad = size * 0.07;
  ctx.drawImage(qr, x + pad, y + pad, size - pad * 2, size - pad * 2);
  ctx.fillStyle = captionColor;
  ctx.font = `700 20px ${BODY}`;
  ctx.textAlign = 'center';
  ctx.fillText(caption, x + size / 2, y + size + 30);
  ctx.textAlign = 'left';
}

function pricePill(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, bg: string, fg: string) {
  ctx.font = `800 52px ${DISPLAY}`;
  const w = ctx.measureText(text).width + 56;
  ctx.fillStyle = bg;
  roundRect(ctx, x, y, w, 76, 38);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.fillText(text, x + 28, y + 57);
}

function credit(ctx: CanvasRenderingContext2D, h: number, color: string) {
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = color;
  ctx.font = `600 18px ${BODY}`;
  ctx.textAlign = 'center';
  ctx.fillText('TapIN2Events', W / 2, h - 28);
  ctx.textAlign = 'left';
  ctx.globalAlpha = 1;
}

// Headline + details on a colored (or photo) background. The tagline,
// headline, and details form one block: centered in tall formats (so a story
// doesn't leave a hole in the middle, and stays clear of Instagram's UI), or
// anchored low over a photo, where the darkened bottom keeps text readable.
function drawStacked(ctx: CanvasRenderingContext2D, c: FlyerContent, p: Palette, h: number, onPhoto: boolean) {
  const pad = 90;
  const maxW = W - pad * 2;
  const qrSize = c.qr ? 190 : 0;
  const bottomRowH = c.priceLine || c.qr ? Math.max(76, qrSize + 40) : 0;
  const regionTop = pad + (h > 1600 ? 110 : 20);
  const regionBottom = h - pad - bottomRowH - (bottomRowH ? 50 : 0);

  // Measure details (top-down order) at their fitted sizes.
  const details: { text: string; font: (px: number) => string; px: number; color: string; gapAfter: number }[] = [];
  if (c.dateLine) details.push({ text: c.dateLine, font: (px) => `800 ${px}px ${DISPLAY}`, px: 84, color: p.text, gapAfter: 14 });
  if (c.timeLine) details.push({ text: c.timeLine, font: (px) => `700 ${px}px ${BODY}`, px: 42, color: p.accent, gapAfter: 30 });
  if (c.venueLine) details.push({ text: c.venueLine, font: (px) => `700 ${px}px ${BODY}`, px: 44, color: p.text, gapAfter: 12 });
  if (c.addressLine) details.push({ text: c.addressLine, font: (px) => `400 ${px}px ${BODY}`, px: 32, color: p.sub, gapAfter: 0 });
  details.forEach((d) => (d.px = fitLine(ctx, d.text, d.font, maxW, d.px)));
  const detailsH = details.reduce((sum, d, i) => sum + d.px + (i < details.length - 1 ? d.gapAfter : 0), 0);

  ctx.font = `700 32px ${BODY}`;
  const taglineLines = c.tagline ? wrap(ctx, c.tagline.toUpperCase(), maxW).slice(0, 2) : [];
  const taglineH = taglineLines.length ? taglineLines.length * 42 + 20 : 0;

  const barGap = 90; // headline -> accent bar -> details
  const headMax = regionBottom - regionTop - taglineH - barGap - detailsH;
  const head = fitBlock(ctx, c.headline.toUpperCase(), (sz) => `800 ${sz}px ${DISPLAY}`, maxW, Math.max(headMax, 80), 260, 70, 0.9);
  const headH = head.lines.length * head.px * 0.9;
  const total = taglineH + headH + barGap + detailsH;
  const spare = Math.max(0, regionBottom - regionTop - total);
  let y = onPhoto ? regionTop + spare : regionTop + spare / 2;

  taglineLines.forEach((line, i) => {
    ctx.font = `700 32px ${BODY}`;
    ctx.fillStyle = p.accent;
    ctx.fillText(line, pad, y + 32 + i * 42);
  });
  y += taglineH;

  ctx.font = `800 ${head.px}px ${DISPLAY}`;
  ctx.fillStyle = p.text;
  if (onPhoto) {
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 18;
  }
  head.lines.forEach((line, i) => ctx.fillText(line, pad, y + head.px * 0.86 + i * head.px * 0.9));
  ctx.shadowBlur = 0;
  y += headH;

  ctx.fillStyle = p.accent;
  ctx.fillRect(pad, y + 34, 150, 10);
  y += barGap;

  details.forEach((d) => {
    ctx.font = d.font(d.px);
    ctx.fillStyle = d.color;
    ctx.fillText(d.text, pad, y + d.px * 0.8);
    y += d.px + d.gapAfter;
  });

  // Bottom row: price on the left, QR on the right.
  const rowY = h - pad - bottomRowH;
  if (c.priceLine) pricePill(ctx, c.priceLine, pad, rowY + (bottomRowH - 76) / 2, p.accent, '#111111');
  if (c.qr) drawQr(ctx, c.qr, W - pad - qrSize, rowY - 10, qrSize, c.qrCaption, p.sub);
}

// Label/value rows on a light panel (used by minimal and split).
function drawRows(ctx: CanvasRenderingContext2D, c: FlyerContent, p: Palette, x: number, y: number, maxW: number, measureOnly = false) {
  const rows: [string, string, string][] = [];
  if (c.dateLine || c.timeLine) rows.push(['WHEN', c.dateLine, c.timeLine]);
  if (c.venueLine || c.addressLine) rows.push(['WHERE', c.venueLine, c.addressLine]);
  if (c.priceLine) rows.push(['ENTRY', c.priceLine, '']);
  for (const [label, main, extra] of rows) {
    ctx.fillStyle = p.strong;
    ctx.font = `800 24px ${BODY}`;
    if (!measureOnly) ctx.fillText(label, x, y);
    y += 50;
    if (main) {
      const px = fitLine(ctx, main, (s) => `700 ${s}px ${BODY}`, maxW, 46);
      ctx.fillStyle = '#111827';
      if (!measureOnly) ctx.fillText(main, x, y);
      y += px + 8;
    }
    if (extra) {
      const px = fitLine(ctx, extra, (s) => `400 ${s}px ${BODY}`, maxW, 34);
      ctx.fillStyle = '#4b5563';
      if (!measureOnly) ctx.fillText(extra, x, y);
      y += px + 8;
    }
    y += 38;
  }
  return y;
}

// maxWidth (optional) renders a smaller copy with the identical layout --
// used for the event poster, which is shown on web pages, not printed.
export function drawFlyer(canvas: HTMLCanvasElement, style: FlyerStyle, palette: Palette, size: FlyerSize, c: FlyerContent, maxWidth?: number) {
  const full = SIZES[size];
  const shrink = maxWidth && full.width > maxWidth ? maxWidth / full.width : 1;
  const width = Math.round(full.width * shrink);
  const height = Math.round(full.height * shrink);
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const s = width / W;
  const h = height / s;
  ctx.setTransform(s, 0, 0, s, 0, 0);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  if (style === 'photo' && c.photo) {
    drawCover(ctx, c.photo, 0, 0, W, h);
    const g = ctx.createLinearGradient(0, h * 0.2, 0, h);
    g.addColorStop(0, 'rgba(0,0,0,0.05)');
    g.addColorStop(0.45, 'rgba(0,0,0,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0.9)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, h);
    drawStacked(ctx, c, { ...palette, text: '#ffffff', sub: '#e5e7eb' }, h, true);
    credit(ctx, h, '#ffffff');
    return;
  }

  if (style === 'minimal') {
    ctx.fillStyle = '#fafaf7';
    ctx.fillRect(0, 0, W, h);
    ctx.fillStyle = palette.strong;
    ctx.fillRect(0, 0, 28, h);
    const pad = 100;
    const maxW = W - pad - 90;
    let top = pad + (h > 1600 ? 90 : 20);
    if (c.tagline) {
      ctx.font = `700 30px ${BODY}`;
      ctx.fillStyle = palette.to;
      const tl = wrap(ctx, c.tagline.toUpperCase(), maxW).slice(0, 2);
      tl.forEach((line, i) => ctx.fillText(line, pad, top + 30 + i * 40));
      top += tl.length * 40 + 24;
    }
    const { px, lines } = fitBlock(ctx, c.headline, (s2) => `800 ${s2}px ${DISPLAY}`, maxW, h * 0.36, 220, 70, 0.9);
    ctx.fillStyle = palette.strong;
    lines.forEach((line, i) => ctx.fillText(line, pad, top + px * 0.86 + i * px * 0.9));
    const afterHead = top + lines.length * px * 0.9 + 40;
    ctx.fillStyle = palette.accent === '#fef3c7' ? palette.to : palette.accent;
    ctx.fillRect(pad, afterHead, 120, 8);
    drawRows(ctx, c, palette, pad, afterHead + 90, maxW - (c.qr ? 0 : 0));
    if (c.qr) drawQr(ctx, c.qr, W - 90 - 180, h - 90 - 220, 180, c.qrCaption, palette.strong);
    credit(ctx, h, '#6b7280');
    return;
  }

  if (style === 'split') {
    const blockH = h * 0.52;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, blockH);
    ctx.clip();
    gradientBg(ctx, palette, blockH);
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, blockH, W, h - blockH);
    const pad = 90;
    const maxW = W - pad * 2;
    let top = pad + (h > 1600 ? 90 : 10);
    if (c.tagline) {
      ctx.font = `700 32px ${BODY}`;
      ctx.fillStyle = palette.accent;
      const tl = wrap(ctx, c.tagline.toUpperCase(), maxW).slice(0, 2);
      tl.forEach((line, i) => ctx.fillText(line, pad, top + 32 + i * 42));
      top += tl.length * 42 + 20;
    }
    const { px, lines } = fitBlock(ctx, c.headline.toUpperCase(), (s2) => `800 ${s2}px ${DISPLAY}`, maxW, blockH - top - 60, 250, 70, 0.9);
    ctx.fillStyle = palette.text;
    lines.forEach((line, i) => ctx.fillText(line, pad, top + px * 0.86 + i * px * 0.9));
    const rowsW = c.qr ? maxW - 230 : maxW;
    // Center the detail rows (and QR) in the white panel.
    const panelTop = blockH + 60;
    const panelBottom = h - 70;
    const rowsH = drawRows(ctx, c, palette, pad, 0, rowsW, true) - 38;
    const contentH = Math.max(rowsH, c.qr ? 230 : 0);
    const startY = panelTop + Math.max(0, (panelBottom - panelTop - contentH) / 2);
    drawRows(ctx, c, palette, pad, startY + 30, rowsW);
    if (c.qr) drawQr(ctx, c.qr, W - pad - 190, startY, 190, c.qrCaption, palette.strong);
    credit(ctx, h, '#6b7280');
    return;
  }

  // bold (also the fallback for photo style with no photo yet)
  gradientBg(ctx, palette, h);
  drawStacked(ctx, c, palette, h, false);
  credit(ctx, h, palette.sub);
}
