// ---------- Dates (everything shown and saved in Eastern time) ----------
const TZ = "America/New_York";
export function partsIn(date: Date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour === "24" ? "00" : p.hour}:${p.minute}`;
}
const pad = (n: number) => String(n).padStart(2, "0");
const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

/** "7", "7pm", "7:30 PM", "19:00", "noon", "midnight" -> "HH:mm" (or null). */
export function parseTime(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase().replace(/\./g, "");
  if (!s) return null;
  if (s === "noon") return "12:00";
  if (s === "midnight") return "00:00";
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*(am|pm|a|p)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  const ap = m[3]?.[0];
  if (ap === "p" && h < 12) h += 12;
  if (ap === "a" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${pad(h)}:${pad(min)}`;
}

/** "2026-10-31", "10/31/2026", "Oct 31, 2026" -> "YYYY-MM-DD" (or null). */
export function parseDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${pad(+m[1])}-${pad(+m[2])}`;
  m = s.match(/^(?:[a-z]+,?\s+)?([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/i);
  if (m) {
    const mo = MONTHS[m[1].slice(0, 4).toLowerCase()] ?? MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mo) return `${m[3]}-${pad(mo)}-${pad(+m[2])}`;
  }
  return null;
}

/**
 * Any date string -> "YYYY-MM-DDTHH:mm" in Eastern time.
 * A date/time WITHOUT a time zone is taken as Eastern exactly as written (never
 * run through new Date(), which would treat it as the server's UTC and shift it).
 * A time WITH a zone (Z, +hh:mm, -hhmm) is converted to Eastern.
 */
export function toLocal(v: unknown): { local: string; dateOnly: boolean } | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const s = v.trim().replace(/\s+/g, " ");
  const dOnly = parseDate(s);
  if (dOnly) return { local: `${dOnly}T00:00`, dateOnly: true };
  const zoned = /(Z|[+-]\d{2}:?\d{2})$/i.test(s) && /\d{4}-\d{2}-\d{2}[T ]\d/.test(s);
  if (!zoned) {
    // "YYYY-MM-DD[T ]HH:mm[:ss[.sss]]" or "<date> <time>" in any format we understand.
    const iso = s.match(/^(\d{4}-\d{1,2}-\d{1,2})[T ](\d{1,2}:\d{2})(?::\d{2}(?:\.\d+)?)?$/);
    if (iso) { const d = parseDate(iso[1]); const t = parseTime(iso[2]); if (d && t) return { local: `${d}T${t}`, dateOnly: false }; }
    const split = s.match(/^(.*?\d{4}),?\s*(?:at\s+|@\s*)?(\d{1,2}(?::\d{2})?\s*(?:[ap]\.?m\.?)?)$/i);
    if (split) { const d = parseDate(split[1]); const t = parseTime(split[2]); if (d && t) return { local: `${d}T${t}`, dateOnly: false }; }
    return null;
  }
  const norm = s.replace(" ", "T").replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  const d = new Date(norm);
  return Number.isNaN(d.getTime()) ? null : { local: partsIn(d), dateOnly: false };
}

/** "YYYY-MM-DDTHH:mm" in Eastern time -> ISO timestamp (handles daylight saving). */
export function easternToIso(local: string): string | null {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const asUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  const offsetFor = (t: number) => {
    const name = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" }).formatToParts(new Date(t)).find((x) => x.type === "timeZoneName")?.value ?? "GMT-05:00";
    const o = name.match(/GMT([+-])(\d{2}):?(\d{2})?/);
    return o ? (o[1] === "-" ? -1 : 1) * (Number(o[2]) * 60 + Number(o[3] ?? 0)) : 0;
  };
  const guess = asUtc - offsetFor(asUtc) * 60000;
  return new Date(asUtc - offsetFor(guess) * 60000).toISOString();
}
export const nowLocal = () => partsIn(new Date());

function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Makes a start/end pair sensible:
 * - an end with no time on the same day as the start is dropped (unknown, not midnight)
 * - an end with no time on a later day ends at 11:59 PM that day
 * - an end earlier than the start on the same day runs past midnight (9 PM - 2 AM)
 * - an end equal to the start, or days before it, is dropped and flagged
 */
export function fixRange(start: { local: string; dateOnly: boolean } | null, end: { local: string; dateOnly: boolean } | null, needs: string[]) {
  let s = start?.local ?? null;
  let e = end?.local ?? null;
  if (start?.dateOnly && !needs.includes("start_time")) needs.push("start_time");
  if (e && end?.dateOnly) {
    if (!s || e.slice(0, 10) <= s.slice(0, 10)) e = null;
    else e = `${e.slice(0, 10)}T23:59`;
  }
  if (s && e && e <= s) {
    if (e.slice(0, 10) === s.slice(0, 10) && e !== s && !start?.dateOnly) {
      e = `${addDays(e.slice(0, 10), 1)}T${e.slice(11)}`; // overnight
    } else {
      e = null;
      if (!needs.includes("end_date")) needs.push("end_date");
    }
  }
  if (s && e && new Date(`${e}:00Z`).getTime() - new Date(`${s}:00Z`).getTime() > 31 * 86400000) { e = null; if (!needs.includes("end_date")) needs.push("end_date"); }
  return { start_local: s, end_local: e };
}
