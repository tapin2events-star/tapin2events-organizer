// Draws event flyers onto a <canvas>. Everything factual on the flyer --
// title, date, time, venue, address, price -- comes straight from the
// organizer's event form. Only the tagline is AI-suggested (and editable).

export type FlyerStyle = 'bold' | 'elegant' | 'split' | 'minimal';
export type FlyerSize = 'post' | 'story' | 'print';

export const FLYER_STYLES: { id: FlyerStyle; label: string }[] = [
  { id: 'bold', label: 'Bold' },
  { id: 'elegant', label: 'Elegant' },
  { id: 'split', label: 'Split' },
  { id: 'minimal', label: 'Minimal' },
];

export const FLYER_SIZES: Record<FlyerSize, { w: number; h: number; label: string }> = {
  post: { w: 1080, h: 1350, label: 'Instagram post' },
  story: { w: 1080, h: 1920, label: 'Instagram story' },
  print: { w: 1275, h: 1650, label: 'Print (8.5×11)' },
};

export interface Palette {
  id: string;
  name: string;
  bg: [string, string];
  accent: string;
  text: string;
  sub: string;
  light: boolean;
  // Accent used on top of a darkened photo (light palettes' accents are dark).
  accentOnPhoto: string;
}

export const PALETTES: Palette[] = [
  { id: 'midnight', name: 'Midnight', bg: ['#0f172a', '#312e81'], accent: '#fbbf24', text: '#ffffff', sub: '#c7d2fe', light: false, accentOnPhoto: '#fbbf24' },
  { id: 'sunset', name: 'Sunset', bg: ['#7c2d12', '#db2777'], accent: '#fde68a', text: '#ffffff', sub: '#ffe4e6', light: false, accentOnPhoto: '#fde68a' },
  { id: 'electric', name: 'Electric', bg: ['#1e1b4b', '#7c3aed'], accent: '#22d3ee', text: '#ffffff', sub: '#ddd6fe', light: false, accentOnPhoto: '#22d3ee' },
  { id: 'forest', name: 'Forest', bg: ['#052e16', '#15803d'], accent: '#facc15', text: '#ffffff', sub: '#dcfce7', light: false, accentOnPhoto: '#facc15' },
  { id: 'royal', name: 'Royal', bg: ['#1e3a8a', '#4f46e5'], accent: '#f9a8d4', text: '#ffffff', sub: '#e0e7ff', light: false, accentOnPhoto: '#f9a8d4' },
  { id: 'blush', name: 'Blush', bg: ['#fff1f2', '#fce7f3'], accent: '#be185d', text: '#1f2937', sub: '#6b7280', light: true, accentOnPhoto: '#f9a8d4' },
  { id: 'sand', name: 'Sand', bg: ['#fefce8', '#fef3c7'], accent: '#b45309', text: '#1c1917', sub: '#57534e', light: true, accentOnPhoto: '#fcd34d' },
  { id: 'mono', name: 'Mono', bg: ['#111111', '#262626'], accent: '#ffffff', text: '#ffffff', sub: '#a3a3a3', light: false, accentOnPhoto: '#ffffff' },
];

export interface FlyerContent {
  title: string;
  tagline: string;
  category: string;
  dateLine: string; // "FRIDAY, OCTOBER 30" or "DATE TBA"
  timeLine: string; // "8 PM – 11 PM" or ""
  dateParts: { day: string; month: string; weekday: string } | null;
  venue: string;
  address: string;
  price: string; // "" hides the price
  footer: string; // "" hides the footer
}

export interface RenderOptions {
  style: FlyerStyle;
  size: FlyerSize;
  palette: Palette;
  content: FlyerContent;
  photo: HTMLImageElement | null;
}

export const FLYER_FONTS = {
  display: '"Bebas Neue", "Impact", "Arial Narrow", sans-serif',
  serif: '"Playfair Display", Georgia, serif',
  sans: '"Montserrat", "Helvetica Neue", Arial, sans-serif',
  round: '"Poppins", "Helvetica Neue", Arial, sans-serif',
};

// ---------- date helpers ----------

// `local` is a datetime-local value ("2026-10-30T20:00"), read as local time.
export function formatFlyerDate(start: string, end: string) {
  if (!start) return { dateLine: 'DATE TBA', timeLine: '', dateParts: null };
  const s = new Date(start);
  if (isNaN(s.getTime())) return { dateLine: 'DATE TBA', timeLine: '', dateParts: null };
  const time = (d: Date) => {
    const h = d.getHours() % 12 || 12;
    const m = d.getMinutes();
    return `${h}${m ? `:${String(m).padStart(2, '0')}` : ''} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
  };
  const e = end ? new Date(end) : null;
  const sameDay = e && !isNaN(e.getTime()) && e.toDateString() === s.toDateString();
  return {
    dateLine: s.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase(),
    timeLine: sameDay ? `${time(s)} – ${time(e!)}` : time(s),
    dateParts: {
      day: String(s.getDate()),
      month: s.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
      weekday: s.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase(),
    },
  };
}

// ---------- drawing helpers ----------

type Ctx = CanvasRenderingContext2D;

function wrap(ctx: Ctx, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const attempt = line ? `${line} ${word}` : word;
    if (ctx.measureText(attempt).width <= maxWidth) {
      line = attempt;
      continue;
    }
    if (line) lines.push(line);
    // A single word wider than the line gets broken by character.
    if (ctx.measureText(word).width > maxWidth) {
      let chunk = '';
      for (const ch of word) {
        if (ctx.measureText(chunk + ch).width > maxWidth && chunk) {
          lines.push(chunk);
          chunk = ch;
        } else chunk += ch;
      }
      line = chunk;
    } else line = word;
  }
  if (line) lines.push(line);
  return lines;
}

// Largest font size (between max and min) where the text fits in maxLines.
function fit(ctx: Ctx, text: string, font: (px: number) => string, maxWidth: number, maxLines: number, maxPx: number, minPx: number) {
  for (let px = maxPx; px >= minPx; px -= 2) {
    ctx.font = font(px);
    const lines = wrap(ctx, text, maxWidth);
    if (lines.length <= maxLines) return { px, lines };
  }
  ctx.font = font(minPx);
  const lines = wrap(ctx, text, maxWidth);
  if (lines.length > maxLines) {
    // Last resort only: keep as many characters as fit, then an ellipsis.
    const kept = lines.slice(0, maxLines);
    let last = `${kept[maxLines - 1]} ${lines[maxLines]}`;
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last.trimEnd()}…`;
    return { px: minPx, lines: kept };
  }
  return { px: minPx, lines };
}

function drawCover(ctx: Ctx, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
}

function gradientBg(ctx: Ctx, p: Palette, x: number, y: number, w: number, h: number) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, p.bg[0]);
  g.addColorStop(1, p.bg[1]);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

function darkOverlay(ctx: Ctx, x: number, y: number, w: number, h: number, top = 0.3, bottom = 0.82) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, `rgba(0,0,0,${top})`);
  g.addColorStop(1, `rgba(0,0,0,${bottom})`);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

function decorCircles(ctx: Ctx, w: number, h: number, color: string) {
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(w * 0.9, h * 0.08, w * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(w * 0.05, h * 0.55, w * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function pill(ctx: Ctx, text: string, x: number, y: number, px: number, bg: string, fg: string, align: 'left' | 'center' = 'left') {
  ctx.font = `700 ${px}px ${FLYER_FONTS.sans}`;
  const tw = ctx.measureText(text).width;
  const padX = px * 0.9;
  const hgt = px * 2;
  const wid = tw + padX * 2;
  const left = align === 'center' ? x - wid / 2 : x;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(left, y, wid, hgt, hgt / 2);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(text, left + padX, y + hgt / 2 + px * 0.05);
  ctx.textBaseline = 'alphabetic';
  return hgt;
}

// Draws lines of text top-down from y; returns the y after the last line.
function lines(ctx: Ctx, textLines: string[], x: number, y: number, px: number, lineHeight: number, color: string, align: CanvasTextAlign = 'left') {
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  let cy = y;
  for (const l of textLines) {
    cy += px * lineHeight;
    ctx.fillText(l, x, cy);
  }
  return cy;
}

// ---------- styles ----------

function bold(ctx: Ctx, w: number, h: number, o: RenderOptions) {
  const { palette: p, content: c, photo } = o;
  if (photo) {
    drawCover(ctx, photo, 0, 0, w, h);
    darkOverlay(ctx, 0, 0, w, h);
  } else {
    gradientBg(ctx, p, 0, 0, w, h);
    decorCircles(ctx, w, h, p.accent);
  }
  const onPhoto = !!photo;
  const text = onPhoto ? '#ffffff' : p.text;
  const sub = onPhoto ? 'rgba(255,255,255,0.85)' : p.sub;
  const accent = onPhoto ? p.accentOnPhoto : p.accent;
  const pad = w * 0.08;
  const maxW = w - pad * 2;

  let y = pad;
  if (c.category) {
    ctx.font = `700 ${Math.round(w * 0.028)}px ${FLYER_FONTS.sans}`;
    y = lines(ctx, [c.category.toUpperCase()], pad, y, w * 0.028, 1, accent);
  }
  const t = fit(ctx, c.title.toUpperCase(), (px) => `400 ${px}px ${FLYER_FONTS.display}`, maxW, 5, Math.round(w * 0.2), Math.round(w * 0.065));
  ctx.font = `400 ${t.px}px ${FLYER_FONTS.display}`;
  y = lines(ctx, t.lines, pad, y + w * 0.03, t.px, 0.92, text);
  if (c.tagline) {
    const tg = fit(ctx, c.tagline, (px) => `500 ${px}px ${FLYER_FONTS.sans}`, maxW, 2, Math.round(w * 0.042), Math.round(w * 0.032));
    ctx.font = `500 ${tg.px}px ${FLYER_FONTS.sans}`;
    lines(ctx, tg.lines, pad, y + w * 0.025, tg.px, 1.3, sub);
  }

  // Details block anchored to the bottom.
  let by = h - pad;
  if (c.footer) {
    ctx.font = `500 ${Math.round(w * 0.022)}px ${FLYER_FONTS.sans}`;
    ctx.fillStyle = sub;
    ctx.textAlign = 'left';
    ctx.fillText(c.footer, pad, by);
    by -= w * 0.06;
  }
  const detail: { text: string; font: string; px: number; color: string }[] = [];
  detail.push({ text: c.dateLine, font: `400 PXpx ${FLYER_FONTS.display}`, px: Math.round(w * 0.085), color: accent });
  if (c.timeLine) detail.push({ text: c.timeLine, font: `700 PXpx ${FLYER_FONTS.sans}`, px: Math.round(w * 0.04), color: text });
  if (c.venue) detail.push({ text: c.venue, font: `700 PXpx ${FLYER_FONTS.sans}`, px: Math.round(w * 0.04), color: text });
  if (c.address) detail.push({ text: c.address, font: `500 PXpx ${FLYER_FONTS.sans}`, px: Math.round(w * 0.03), color: sub });
  const lineGap = 1.35;
  const blockH = detail.reduce((s, d) => s + d.px * lineGap, 0);
  let dy = by - blockH;
  if (c.price) {
    const ph = Math.round(w * 0.034);
    pill(ctx, c.price.toUpperCase(), pad, dy - ph * 2 - w * 0.03, ph, accent, onPhoto || !p.light ? '#111111' : '#ffffff');
  }
  for (const d of detail) {
    const f = fit(ctx, d.text, (px) => d.font.replace('PX', String(px)), maxW, 1, d.px, Math.round(d.px * 0.6));
    ctx.font = d.font.replace('PX', String(f.px));
    dy = lines(ctx, f.lines, pad, dy, d.px, lineGap, d.color);
  }
}

function elegant(ctx: Ctx, w: number, h: number, o: RenderOptions) {
  const { palette: p, content: c, photo } = o;
  if (photo) {
    drawCover(ctx, photo, 0, 0, w, h);
    darkOverlay(ctx, 0, 0, w, h, 0.55, 0.8);
  } else {
    gradientBg(ctx, p, 0, 0, w, h);
  }
  const onPhoto = !!photo;
  const text = onPhoto ? '#ffffff' : p.text;
  const sub = onPhoto ? 'rgba(255,255,255,0.85)' : p.sub;
  const accent = onPhoto ? p.accentOnPhoto : p.accent;
  const pad = w * 0.09;
  const cx = w / 2;
  const maxW = w - pad * 2.4;

  // Thin inset frame.
  ctx.strokeStyle = accent;
  ctx.lineWidth = Math.max(2, w * 0.003);
  ctx.strokeRect(pad * 0.45, pad * 0.45, w - pad * 0.9, h - pad * 0.9);

  // Measure the centered block first so it can be vertically centered.
  const catPx = Math.round(w * 0.026);
  const t = fit(ctx, c.title, (px) => `700 ${px}px ${FLYER_FONTS.serif}`, maxW, 5, Math.round(w * 0.12), Math.round(w * 0.045));
  ctx.font = `500 ${Math.round(w * 0.036)}px ${FLYER_FONTS.sans}`;
  const tagLines = c.tagline ? wrap(ctx, c.tagline, maxW).slice(0, 2) : [];
  const details = [c.dateLine, c.timeLine, c.venue, c.address].filter(Boolean);
  const detailPx = Math.round(w * 0.034);
  const blockH =
    (c.category ? catPx * 2 : 0) +
    t.px * 1.12 * t.lines.length +
    w * 0.08 +
    (tagLines.length ? Math.round(w * 0.036) * 1.4 * tagLines.length + w * 0.03 : 0) +
    detailPx * 1.6 * details.length +
    (c.price ? detailPx * 3.2 : 0);
  let y = Math.max(pad * 1.2, (h - blockH) / 2 - w * 0.03);

  if (c.category) {
    ctx.font = `700 ${catPx}px ${FLYER_FONTS.sans}`;
    y = lines(ctx, [c.category.toUpperCase().split('').join(' ')], cx, y, catPx, 1, accent, 'center') + catPx;
  }
  ctx.font = `700 ${t.px}px ${FLYER_FONTS.serif}`;
  y = lines(ctx, t.lines, cx, y, t.px, 1.12, text, 'center');
  // Accent divider.
  y += w * 0.04;
  ctx.fillStyle = accent;
  ctx.fillRect(cx - w * 0.08, y, w * 0.16, Math.max(2, w * 0.003));
  y += w * 0.04;
  if (tagLines.length) {
    ctx.font = `500 ${Math.round(w * 0.036)}px ${FLYER_FONTS.sans}`;
    y = lines(ctx, tagLines, cx, y, Math.round(w * 0.036), 1.4, sub, 'center') + w * 0.03;
  }
  details.forEach((d, i) => {
    const isDate = i === 0;
    const font = (px: number) => `${isDate ? 700 : 500} ${px}px ${FLYER_FONTS.sans}`;
    const f = fit(ctx, d, font, maxW, 1, detailPx, Math.round(detailPx * 0.65));
    ctx.font = font(f.px);
    y = lines(ctx, f.lines, cx, y, detailPx, 1.6, isDate ? accent : d === c.address ? sub : text, 'center');
  });
  if (c.price) {
    pill(ctx, c.price.toUpperCase(), cx, y + detailPx * 0.9, Math.round(w * 0.03), accent, onPhoto || !p.light ? '#111111' : '#ffffff', 'center');
  }
  if (c.footer) {
    ctx.font = `500 ${Math.round(w * 0.021)}px ${FLYER_FONTS.sans}`;
    ctx.fillStyle = sub;
    ctx.textAlign = 'center';
    ctx.fillText(c.footer, cx, h - pad * 0.45 - w * 0.03);
  }
}

function split(ctx: Ctx, w: number, h: number, o: RenderOptions) {
  const { palette: p, content: c, photo, size } = o;
  const pad = w * 0.08;
  const maxW = w - pad * 2;
  const labelPx = Math.round(w * 0.024);
  const valPx = Math.round(w * 0.036);
  const catPx = w * 0.026;
  const colX = pad + w * 0.2;
  const footerSpace = c.footer ? w * 0.09 : w * 0.05;
  const rows: { label: string; value: string; value2?: string }[] = [
    { label: 'WHEN', value: c.dateLine, value2: c.timeLine },
    ...(c.venue || c.address ? [{ label: 'WHERE', value: c.venue || c.address, value2: c.venue ? c.address : '' }] : []),
  ];
  const colW = w - colX - pad;
  const rowFits = rows.map((r) => ({
    main: fit(ctx, r.value, (px) => `700 ${px}px ${FLYER_FONTS.round}`, colW, 2, valPx, Math.round(valPx * 0.75)),
    second: r.value2 ? fit(ctx, r.value2, (px) => `400 ${px}px ${FLYER_FONTS.round}`, colW, 2, Math.round(valPx * 0.85), Math.round(valPx * 0.65)) : null,
  }));
  const rowsH = rowFits.reduce(
    (sum, f) => sum + f.main.px * 1.25 * f.main.lines.length + (f.second ? f.second.px * 1.35 * f.second.lines.length : 0) + w * 0.035,
    0
  );

  // Measure first: shrink the title, then the photo area, until the text
  // panel fits above the footer. Drawing top-down without this let the
  // details run off the bottom on shorter sizes.
  const baseTop = size === 'story' ? 0.5 : 0.42;
  let topH = Math.round(h * baseTop);
  let t = fit(ctx, c.title, (px) => `700 ${px}px ${FLYER_FONTS.round}`, maxW, 4, Math.round(w * 0.1), Math.round(w * 0.045));
  let tg = c.tagline ? fit(ctx, c.tagline, (px) => `400 ${px}px ${FLYER_FONTS.round}`, maxW, 2, Math.round(w * 0.034), Math.round(w * 0.026)) : null;
  const panelNeeded = () =>
    w * 0.05 + (c.category ? catPx * 1.2 : 0) + w * 0.01 + t.px * 1.15 * t.lines.length + (tg ? w * 0.01 + tg.px * 1.4 * tg.lines.length : 0) + w * 0.04 + rowsH;
  search: for (const ratio of [baseTop, baseTop - 0.05, baseTop - 0.1, baseTop - 0.14]) {
    topH = Math.round(h * ratio);
    for (let maxPx = Math.round(w * 0.1); maxPx >= Math.round(w * 0.05); maxPx -= Math.round(w * 0.005)) {
      t = fit(ctx, c.title, (px) => `700 ${px}px ${FLYER_FONTS.round}`, maxW, 4, maxPx, Math.round(w * 0.04));
      if (panelNeeded() <= h - topH - footerSpace) break search;
    }
  }

  if (photo) {
    drawCover(ctx, photo, 0, 0, w, topH);
  } else {
    gradientBg(ctx, p, 0, 0, w, topH);
    decorCircles(ctx, w, topH * 1.6, p.accent);
  }
  const panelBg = p.light ? '#ffffff' : p.bg[0];
  const text = p.light ? p.text : '#ffffff';
  const sub = p.sub;
  ctx.fillStyle = panelBg;
  ctx.fillRect(0, topH, w, h - topH);
  // Accent stripe at the seam.
  ctx.fillStyle = p.accent;
  ctx.fillRect(0, topH, w, Math.max(6, h * 0.008));

  if (c.price) {
    const ph = Math.round(w * 0.034);
    ctx.font = `700 ${ph}px ${FLYER_FONTS.sans}`;
    const pw = ctx.measureText(c.price.toUpperCase()).width + ph * 1.8;
    pill(ctx, c.price.toUpperCase(), w - pad - pw, topH - ph * 2 - w * 0.03, ph, p.accent, p.light ? '#ffffff' : '#111111');
  }

  let y = topH + w * 0.05;
  if (c.category) {
    ctx.font = `700 ${Math.round(catPx)}px ${FLYER_FONTS.round}`;
    y = lines(ctx, [c.category.toUpperCase()], pad, y, catPx, 1.2, p.accent);
  }
  ctx.font = `700 ${t.px}px ${FLYER_FONTS.round}`;
  y = lines(ctx, t.lines, pad, y + w * 0.01, t.px, 1.15, text);
  if (tg) {
    ctx.font = `400 ${tg.px}px ${FLYER_FONTS.round}`;
    y = lines(ctx, tg.lines, pad, y + w * 0.01, tg.px, 1.4, sub);
  }
  y += w * 0.04;
  rows.forEach((r, i) => {
    const f = rowFits[i];
    ctx.font = `700 ${labelPx}px ${FLYER_FONTS.round}`;
    ctx.fillStyle = p.accent;
    ctx.textAlign = 'left';
    ctx.fillText(r.label, pad, y + f.main.px);
    ctx.font = `700 ${f.main.px}px ${FLYER_FONTS.round}`;
    let ry = lines(ctx, f.main.lines, colX, y, f.main.px, 1.25, text);
    if (f.second) {
      ctx.font = `400 ${f.second.px}px ${FLYER_FONTS.round}`;
      ry = lines(ctx, f.second.lines, colX, ry, f.second.px, 1.35, sub);
    }
    y = ry + w * 0.035;
  });
  if (c.footer) {
    ctx.font = `500 ${Math.round(w * 0.022)}px ${FLYER_FONTS.round}`;
    ctx.fillStyle = sub;
    ctx.textAlign = 'left';
    ctx.fillText(c.footer, pad, h - pad * 0.7);
  }
}

function minimal(ctx: Ctx, w: number, h: number, o: RenderOptions) {
  const { palette: p, content: c } = o;
  ctx.fillStyle = p.bg[0];
  ctx.fillRect(0, 0, w, h);
  const text = p.text;
  const sub = p.sub;
  const pad = w * 0.08;
  const leftW = w * 0.28;
  const rightX = pad + leftW + w * 0.04;
  const rightW = w - rightX - pad;

  // Estimate the right column's height so the whole block sits centered.
  const t = fit(ctx, c.title, (px) => `800 ${px}px ${FLYER_FONTS.sans}`, rightW, 6, Math.round(w * 0.085), Math.round(w * 0.04));
  const detailPx = Math.round(w * 0.032);
  const rightH = t.px * 1.15 * t.lines.length + (c.tagline ? w * 0.09 : 0) + detailPx * 1.6 * 4 + (c.price ? detailPx * 3 : 0);
  let y = Math.max(pad * 1.5, (h - Math.max(rightH, w * 0.4)) / 2);
  const top = y;

  // Left column: big date.
  ctx.textAlign = 'left';
  if (c.dateParts) {
    ctx.font = `700 ${Math.round(w * 0.05)}px ${FLYER_FONTS.sans}`;
    let ly = lines(ctx, [c.dateParts.month], pad, top, w * 0.05, 1, text);
    ctx.font = `800 ${Math.round(w * 0.2)}px ${FLYER_FONTS.sans}`;
    ly = lines(ctx, [c.dateParts.day], pad - w * 0.008, ly, w * 0.2, 0.95, p.accent);
    ctx.font = `600 ${Math.round(w * 0.026)}px ${FLYER_FONTS.sans}`;
    lines(ctx, [c.dateParts.weekday], pad, ly + w * 0.01, w * 0.026, 1.2, sub);
  } else {
    ctx.font = `800 ${Math.round(w * 0.09)}px ${FLYER_FONTS.sans}`;
    lines(ctx, ['TBA'], pad, top, w * 0.09, 1, p.accent);
  }
  // Divider between columns.
  ctx.fillStyle = p.accent;
  ctx.fillRect(pad + leftW, top, Math.max(3, w * 0.004), Math.max(rightH, w * 0.4));

  // Right column.
  ctx.font = `800 ${t.px}px ${FLYER_FONTS.sans}`;
  y = lines(ctx, t.lines, rightX, y, t.px, 1.15, text);
  if (c.tagline) {
    const tg = fit(ctx, c.tagline, (px) => `500 ${px}px ${FLYER_FONTS.sans}`, rightW, 2, Math.round(w * 0.032), Math.round(w * 0.026));
    ctx.font = `500 ${tg.px}px ${FLYER_FONTS.sans}`;
    y = lines(ctx, tg.lines, rightX, y + w * 0.015, tg.px, 1.4, sub);
  }
  y += w * 0.03;
  for (const [value, weight, color] of [
    [c.timeLine, 700, text],
    [c.venue, 700, text],
    [c.address, 500, sub],
  ] as [string, number, string][]) {
    if (!value) continue;
    const f = fit(ctx, value, (px) => `${weight} ${px}px ${FLYER_FONTS.sans}`, rightW, 2, detailPx, Math.round(detailPx * 0.7));
    ctx.font = `${weight} ${f.px}px ${FLYER_FONTS.sans}`;
    y = lines(ctx, f.lines, rightX, y, f.px, 1.5, color);
  }
  if (c.price) pill(ctx, c.price.toUpperCase(), rightX, y + detailPx * 0.8, Math.round(w * 0.03), p.accent, p.light ? '#ffffff' : '#111111');
  if (c.footer) {
    ctx.font = `500 ${Math.round(w * 0.022)}px ${FLYER_FONTS.sans}`;
    ctx.fillStyle = sub;
    ctx.textAlign = 'left';
    ctx.fillText(c.footer, pad, h - pad * 0.7);
  }
}

export function renderFlyer(canvas: HTMLCanvasElement, opts: RenderOptions) {
  const { w, h } = FLYER_SIZES[opts.size];
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  if (opts.style === 'bold') bold(ctx, w, h, opts);
  else if (opts.style === 'elegant') elegant(ctx, w, h, opts);
  else if (opts.style === 'split') split(ctx, w, h, opts);
  else minimal(ctx, w, h, opts);
}

let fontsPromise: Promise<void> | null = null;
// Loads the flyer fonts once, so text is drawn in the right typeface rather
// than a fallback (canvas doesn't wait for web fonts on its own).
export function loadFlyerFonts(): Promise<void> {
  if (fontsPromise) return fontsPromise;
  fontsPromise = (async () => {
    if (!document.getElementById('flyer-fonts')) {
      const link = document.createElement('link');
      link.id = 'flyer-fonts';
      link.rel = 'stylesheet';
      link.href =
        'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Montserrat:wght@400;500;600;700;800&family=Playfair+Display:wght@700&family=Poppins:wght@400;700&display=swap';
      document.head.appendChild(link);
      await new Promise((resolve) => {
        link.onload = resolve;
        link.onerror = resolve;
      });
    }
    await Promise.all(
      ['400 40px "Bebas Neue"', '700 40px "Playfair Display"', '800 40px Montserrat', '500 40px Montserrat', '700 40px Poppins', '400 40px Poppins'].map((f) =>
        document.fonts.load(f).catch(() => undefined)
      )
    );
  })();
  return fontsPromise;
}
