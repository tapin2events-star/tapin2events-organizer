import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { easternToIso, parseDate, toLocal } from "./dates.ts";

// Daily check of TapIN's approved local event sources (Admin > Imports).
// New upcoming events land in imported_events as "pending" for an admin to
// approve or skip. Nothing is published automatically.
//   page:         a calendar/event web page, read by import-events-from-url
//   ical:         an .ics calendar feed
//   ticketmaster: Ticketmaster Discovery API around the Triangle (needs TICKETMASTER_API_KEY)
// When a page draws its calendar in the browser (so it reads as empty), the data feed behind
// it is found automatically (WordPress events API, .ics, or RSS) and remembered.
// Called by the daily scheduled job (no sign-in; sources checked in the last 20 hours
// are skipped) or by an admin's "Check now" (any source, any time).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const TRIANGLE = { lat: 35.8, lng: -78.75, radiusMiles: 35 };
const HORIZON_DAYS = 90;
const STARTED = Date.now();
const TIME_BUDGET_MS = 280_000; // stop starting new work after this; the follow-up run finishes the rest
const outOfTime = () => Date.now() - STARTED > TIME_BUDGET_MS;
const UA = "Mozilla/5.0 (compatible; TapIN2Events-Calendar/1.0; +https://tapin2events.com)";
// Places in and around the Triangle, for the "outside the Triangle" check.
const TRIANGLE_PLACES = /\b(raleigh|durham|cary|chapel hill|carrboro|apex|morrisville|wake forest|garner|holly springs|fuquay|knightdale|wendell|zebulon|rolesville|clayton|hillsborough|pittsboro|mebane|rtp|research triangle|smithfield|youngsville|creedmoor|benson|angier|willow spring|knightdale)\b/i;

async function getText(url: string, accept = "*/*", ms = 15000): Promise<{ ok: boolean; status: number; text: string; type: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: accept }, signal: ctrl.signal, redirect: "follow" });
    const text = res.ok ? (await res.text()).slice(0, 3_000_000) : "";
    return { ok: res.ok, status: res.status, text, type: res.headers.get("content-type") ?? "" };
  } catch { return { ok: false, status: 0, text: "", type: "" }; } finally { clearTimeout(t); }
}
const stripHtml = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#0?39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();

interface Found {
  key: string; title: string; start: string | null; end: string | null; location_name: string | null; location_address: string | null;
  description: string | null; ticket_url: string | null; event_url: string | null; image_url: string | null; category: string | null; price: number | null; is_free: boolean;
}

const words = (t: string) => new Set(t.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2));
function similar(a: string, b: string) {
  const x = a.toLowerCase().replace(/[^a-z0-9]/g, ""), y = b.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (x && y && (x.includes(y) || y.includes(x))) return true;
  const wa = words(a), wb = words(b);
  if (!wa.size || !wb.size) return false;
  const overlap = [...wa].filter((w) => wb.has(w)).length;
  return overlap / Math.min(wa.size, wb.size) >= 0.6;
}
const easternDay = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
const short = (s: unknown, n = 600) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, n) : null) || null;

// ---------- Sources ----------
async function fromPage(supabaseUrl: string, serviceKey: string, sourceId: string, url: string): Promise<Found[]> {
  const res = await fetch(`${supabaseUrl}/functions/v1/import-events-from-url`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "preview", url }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error ?? `Couldn't read the page (${res.status})`);
  return ((j.events ?? []) as Record<string, unknown>[]).filter((e) => e.start_local).map((e) => ({
    key: `${sourceId}:${e.event_url ?? e.key}`,
    title: String(e.title),
    start: easternToIso(String(e.start_local)),
    end: e.end_local ? easternToIso(String(e.end_local)) : null,
    location_name: short(e.location_name, 200), location_address: short(e.location_address, 300),
    description: short(e.description), ticket_url: (e.ticket_url as string) ?? null, event_url: (e.event_url as string) ?? url,
    image_url: null, // Images from other sites are skipped unless the organizer adds their own.
    category: (e.category as string) ?? null, price: typeof e.price === "number" ? e.price : null, is_free: e.is_free === true,
  }));
}

function parseIcal(text: string, sourceId: string, fallbackUrl: string | null): Found[] {
  const lines = text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
  const out: Found[] = [];
  let cur: Record<string, { value: string; params: string }> | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") { cur = {}; continue; }
    if (line === "END:VEVENT") {
      if (cur) {
        const when = (k: string) => {
          const f = cur![k]; if (!f) return null;
          const v = f.value.trim();
          if (/VALUE=DATE(?!-)/.test(f.params) || /^\d{8}$/.test(v)) return easternToIso(`${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}T00:00`);
          const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
          if (!m) return null;
          if (m[7]) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0))).toISOString();
          return easternToIso(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}`); // local or TZID time: treated as Eastern
        };
        const unesc = (s?: string) => (s ?? "").replace(/\\n/gi, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\").trim();
        const title = unesc(cur.SUMMARY?.value);
        const start = when("DTSTART");
        if (title && start && !/CANCELLED/i.test(cur.STATUS?.value ?? "")) {
          const loc = unesc(cur.LOCATION?.value);
          const comma = loc.indexOf(",");
          out.push({
            key: `${sourceId}:${cur.UID?.value ?? `${title}-${start}`}`,
            title: title.slice(0, 200), start, end: when("DTEND"),
            location_name: comma > 0 ? loc.slice(0, comma).slice(0, 200) : loc.slice(0, 200) || null,
            location_address: comma > 0 ? loc.slice(comma + 1).trim().slice(0, 300) : null,
            description: short(unesc(cur.DESCRIPTION?.value)), ticket_url: cur.URL?.value ?? null, event_url: cur.URL?.value ?? fallbackUrl,
            image_url: null, category: null, price: null, is_free: false,
          });
        }
      }
      cur = null; continue;
    }
    if (!cur) continue;
    const i = line.indexOf(":");
    if (i < 0) continue;
    const head = line.slice(0, i), value = line.slice(i + 1);
    const [name, ...params] = head.split(";");
    cur[name.toUpperCase()] = { value, params: params.join(";") };
  }
  return out;
}

async function fromIcal(sourceId: string, url: string): Promise<Found[]> {
  const res = await fetch(url, { headers: { "User-Agent": "TapIN2Events-Calendar/1.0 (+https://tapin2events.com)", Accept: "text/calendar,*/*" } });
  if (!res.ok) throw new Error(`Couldn't open the calendar (${res.status})`);
  return parseIcal((await res.text()).slice(0, 3_000_000), sourceId, url);
}

async function fromTicketmaster(sourceId: string): Promise<Found[]> {
  const key = Deno.env.get("TICKETMASTER_API_KEY");
  if (!key) throw new Error("Add a Ticketmaster API key to turn this source on");
  const start = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const end = new Date(Date.now() + HORIZON_DAYS * 86400000).toISOString().replace(/\.\d{3}Z$/, "Z");
  const out: Found[] = [];
  for (let page = 0; page < 3; page++) {
    const q = new URLSearchParams({ apikey: key, latlong: `${TRIANGLE.lat},${TRIANGLE.lng}`, radius: String(TRIANGLE.radiusMiles), unit: "miles", size: "100", page: String(page), sort: "date,asc", startDateTime: start, endDateTime: end, locale: "*" });
    const res = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${q}`);
    if (!res.ok) throw new Error(`Ticketmaster said ${res.status}`);
    const j = await res.json();
    const list = (j?._embedded?.events ?? []) as Record<string, any>[];
    for (const e of list) {
      const v = e._embedded?.venues?.[0];
      const startIso = e.dates?.start?.dateTime ?? (e.dates?.start?.localDate ? easternToIso(`${e.dates.start.localDate}T${(e.dates.start.localTime ?? "00:00").slice(0, 5)}`) : null);
      if (!startIso) continue;
      const img = ((e.images ?? []) as { url: string; ratio?: string; width?: number }[]).filter((i) => i.ratio === "16_9" && (i.width ?? 0) >= 640).sort((a, b) => (a.width ?? 0) - (b.width ?? 0))[0];
      const seg = String(e.classifications?.[0]?.segment?.name ?? "");
      const category = /music/i.test(seg) ? "Music" : /sport/i.test(seg) ? "Sports & Fitness" : /arts|theat/i.test(seg) ? "Arts & Culture" : /family/i.test(seg) ? "Community" : "Other";
      const min = Number(e.priceRanges?.[0]?.min);
      out.push({
        key: `${sourceId}:${e.id}`, title: String(e.name).slice(0, 200), start: startIso, end: null,
        location_name: v?.name ?? null,
        location_address: [v?.address?.line1, v?.city?.name, v?.state?.stateCode].filter(Boolean).join(", ") || null,
        description: short(e.info ?? e.pleaseNote ?? null), ticket_url: e.url ?? null, event_url: e.url ?? null,
        image_url: img?.url ?? null, // Ticketmaster allows its images with credit
        category, price: Number.isFinite(min) && min > 0 ? min : null, is_free: false,
      });
    }
    if ((j?.page?.number ?? 0) + 1 >= (j?.page?.totalPages ?? 0)) break;
  }
  return out;
}

// WordPress sites using The Events Calendar publish events at /wp-json/tribe/events/v1/events.
async function fromWordpress(sourceId: string, feedUrl: string): Promise<Found[]> {
  const out: Found[] = [];
  let next: string | null = feedUrl;
  for (let page = 0; page < 4 && next && !outOfTime(); page++) {
    const r = await getText(next, "application/json");
    if (!r.ok) { if (page === 0) throw new Error(`Couldn't open the events feed (${r.status})`); break; }
    const j = JSON.parse(r.text);
    for (const e of (j.events ?? []) as Record<string, any>[]) {
      const local = (v: string) => (v ? easternToIso(String(v).replace(" ", "T").slice(0, 16)) : null);
      const venue = e.venue && !Array.isArray(e.venue) ? e.venue : null;
      const allDay = e.all_day === true;
      out.push({
        key: `${sourceId}:${e.url ?? e.id}`, title: stripHtml(String(e.title ?? "")).slice(0, 200),
        start: allDay ? local(String(e.start_date).slice(0, 10) + " 00:00") : local(e.start_date), end: allDay ? null : local(e.end_date),
        location_name: venue?.venue ? stripHtml(venue.venue).slice(0, 200) : null,
        location_address: venue ? [venue.address, venue.city, venue.state ?? venue.province, venue.zip].filter(Boolean).join(", ").slice(0, 300) || null : null,
        description: short(stripHtml(String(e.excerpt || e.description || ""))), ticket_url: e.website || e.url || null, event_url: e.url ?? null,
        image_url: null, category: null, price: null, is_free: /free/i.test(String(e.cost ?? "")),
      });
    }
    next = j.next_rest_url ?? null;
  }
  return out;
}

// RSS/Atom: titles and links; each event's own page supplies the exact date, time and venue.
async function fromRss(supabaseUrl: string, serviceKey: string, sourceId: string, feedUrl: string): Promise<Found[]> {
  const r = await getText(feedUrl, "application/rss+xml,application/atom+xml,application/xml,text/xml");
  if (!r.ok) throw new Error(`Couldn't open the feed (${r.status})`);
  const items = [...r.text.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)].map((m) => m[0]).slice(0, 60);
  const out: Found[] = [];
  let opened = 0;
  for (const it of items) {
    if (opened >= 25 || outOfTime()) break;
    const title = stripHtml((it.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/<!\[CDATA\[|\]\]>/g, ""));
    const link = (it.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] ?? it.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1] ?? "").replace(/<!\[CDATA\[|\]\]>/g, "").trim();
    if (!title || !/^https?:/i.test(link)) continue;
    opened++;
    try {
      const detail = (await fromPage(supabaseUrl, serviceKey, sourceId, link)).find((d) => similar(d.title, title)) ?? null;
      if (detail?.start) out.push({ ...detail, key: `${sourceId}:${link}`, event_url: link, title: detail.title || title });
    } catch { /* skip items whose page can't be read */ }
  }
  return out;
}

// When a calendar page is empty (it draws events in the browser), look for the data feed behind it.
async function discoverFeed(pageUrl: string): Promise<{ kind: "ical" | "wordpress" | "rss"; url: string } | null> {
  let origin = "";
  try { origin = new URL(pageUrl).origin; } catch { return null; }
  const candidates: { kind: "ical" | "wordpress" | "rss"; url: string }[] = [];
  const page = await getText(pageUrl, "text/html");
  if (page.ok) {
    for (const m of page.text.matchAll(/<link[^>]+>/gi)) {
      const tag = m[0];
      const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
      if (!href) continue;
      const abs = (() => { try { return new URL(href, pageUrl).toString(); } catch { return null; } })();
      if (!abs) continue;
      if (/text\/calendar/i.test(tag)) candidates.push({ kind: "ical", url: abs });
      else if (/application\/(rss|atom)\+xml/i.test(tag) && /event|calendar/i.test(abs + tag)) candidates.push({ kind: "rss", url: abs });
    }
    for (const m of page.text.matchAll(/href=["']([^"']*(?:\.ics|ical=1|webcal:)[^"']*)["']/gi)) {
      const abs = (() => { try { return new URL(m[1].replace(/^webcal:/i, "https:"), pageUrl).toString(); } catch { return null; } })();
      if (abs) candidates.push({ kind: "ical", url: abs });
    }
  }
  const today = new Date().toISOString().slice(0, 10);
  candidates.push(
    { kind: "wordpress", url: `${origin}/wp-json/tribe/events/v1/events?start_date=${today}&per_page=50` },
    { kind: "ical", url: `${pageUrl}${pageUrl.includes("?") ? "&" : "?"}ical=1` },
    { kind: "ical", url: `${origin}/events/?ical=1` },
    { kind: "ical", url: `${origin}/events/list/?ical=1` },
    { kind: "rss", url: `${origin}/event/rss/` },
    { kind: "rss", url: `${origin}/events/feed/` },
  );
  const seen = new Set<string>();
  for (const c of candidates) {
    if (seen.has(c.url) || outOfTime()) continue;
    seen.add(c.url);
    const r = await getText(c.url, c.kind === "wordpress" ? "application/json" : "*/*", 10000);
    if (!r.ok) continue;
    if (c.kind === "ical" && /BEGIN:VEVENT/.test(r.text)) return c;
    if (c.kind === "wordpress" && /"events"\s*:\s*\[\s*\{/.test(r.text)) return c;
    if (c.kind === "rss" && /<(item|entry)\b/i.test(r.text)) return c;
  }
  return null;
}

// Accuracy warnings for the review queue.
function issuesFor(f: Found, sourceKind: string): string[] {
  const out: string[] = [];
  const clock = f.start ? new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(f.start)) : null;
  if (clock === "00:00") out.push("time_missing");
  if (!f.location_name && !f.location_address) out.push("venue_missing");
  const where = `${f.location_name ?? ""} ${f.location_address ?? ""}`;
  if (sourceKind !== "ticketmaster" && where.trim() && !TRIANGLE_PLACES.test(where) && /\b[A-Z]{2}\b|\d{5}/.test(f.location_address ?? "")) out.push("outside_triangle");
  if (f.start && new Date(f.start).getTime() > Date.now() + 75 * 86400000) out.push("far_out");
  return out;
}

// ---------- Handler ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "content-type": "application/json" } });
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);
  const body = await req.json().catch(() => ({}));

  // An admin pressing "Check now" may check any source right away.
  let forced = false;
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (token && !body.scheduled) {
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: u } = await userClient.auth.getUser();
    const { data: p } = u?.user ? await admin.from("profiles").select("is_admin").eq("id", u.user.id).maybeSingle() : { data: null };
    if (!p?.is_admin) return respond({ error: "Only admins can check sources." }, 403);
    forced = true;
  }

  let q = admin.from("event_sources").select("*").eq("active", true);
  if (body.source_id) q = q.eq("id", String(body.source_id));
  const { data: sources } = await q;
  const recently = Date.now() - 20 * 3600000; // checked daily; skip sources checked in the last 20 hours
  const due = (sources ?? []).filter((s) => forced || !s.last_run_at || new Date(s.last_run_at).getTime() < recently);

  const nowIso = new Date().toISOString();
  const horizon = new Date(Date.now() + HORIZON_DAYS * 86400000).toISOString();
  const results: { source: string; added: number; duplicates: number; error?: string }[] = [];

  for (const s of due) {
    let found: Found[] = [];
    let error: string | undefined;
    if (outOfTime()) break; // the follow-up run picks up the rest
    let via = "";
    try {
      if (s.kind === "ical") found = await fromIcal(s.id, s.url);
      else if (s.kind === "ticketmaster") found = await fromTicketmaster(s.id);
      else if (s.feed_url && s.feed_kind) {
        // A data feed found earlier behind this page.
        via = ` via ${s.feed_kind === "wordpress" ? "events feed" : s.feed_kind === "ical" ? "calendar feed" : "RSS feed"}`;
        found = s.feed_kind === "ical" ? await fromIcal(s.id, s.feed_url) : s.feed_kind === "wordpress" ? await fromWordpress(s.id, s.feed_url) : await fromRss(supabaseUrl, serviceKey, s.id, s.feed_url);
      } else {
        try { found = await fromPage(supabaseUrl, serviceKey, s.id, s.url); } catch (e) { error = String((e as Error).message ?? e).slice(0, 200); }
        if (found.length === 0) {
          // The page drew its events in the browser: look for the feed behind it.
          const feed = await discoverFeed(s.url);
          if (feed) {
            error = undefined;
            await admin.from("event_sources").update({ feed_url: feed.url, feed_kind: feed.kind }).eq("id", s.id);
            via = ` via ${feed.kind === "wordpress" ? "events feed" : feed.kind === "ical" ? "calendar feed" : "RSS feed"} (found automatically)`;
            found = feed.kind === "ical" ? await fromIcal(s.id, feed.url) : feed.kind === "wordpress" ? await fromWordpress(s.id, feed.url) : await fromRss(supabaseUrl, serviceKey, s.id, feed.url);
          } else if (!error) {
            error = "This calendar loads in the browser and no public feed was found. Try the venue's own event pages, or an iCal/RSS link if the site has one";
          }
        }
      }
    } catch (e) { error = String((e as Error).message ?? e).slice(0, 200); }

    // Calendar pages often list only the date; open each event's own page to fill in
    // the time, venue and details (up to 12 per source per check).
    if (s.kind === "page" && !s.feed_kind && found.length) {
      const easternClock = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
      let enriched = 0;
      for (const f of found) {
        if (enriched >= 12 || outOfTime()) break;
        const missing = (f.start && easternClock(f.start) === "00:00") || !f.location_name;
        if (!missing || !f.event_url || f.event_url === s.url) continue;
        const { data: already } = await admin.from("imported_events").select("id").eq("external_key", f.key).maybeSingle();
        if (already) continue;
        enriched++;
        try {
          const detail = (await fromPage(supabaseUrl, serviceKey, s.id, f.event_url)).find((d) => similar(d.title, f.title)) ?? null;
          if (detail) {
            const sameDay = !detail.start || !f.start || easternDay(detail.start) === easternDay(f.start);
            if (detail.start && sameDay && easternClock(detail.start) !== "00:00") { f.start = detail.start; f.end = detail.end ?? f.end; }
            f.location_name = f.location_name ?? detail.location_name;
            f.location_address = f.location_address ?? detail.location_address;
            f.description = f.description ?? detail.description;
            f.ticket_url = detail.ticket_url ?? f.ticket_url;
            f.price = f.price ?? detail.price;
            f.is_free = f.is_free || detail.is_free;
            f.category = f.category && f.category !== "Other" ? f.category : detail.category;
          }
        } catch { /* keep what the calendar page had */ }
      }
    }

    // Upcoming only, within the next few months; skip ones already in the queue.
    found = found.filter((f) => f.start && (f.end ?? f.start) >= nowIso && f.start <= horizon).slice(0, 150);
    const keys = found.map((f) => f.key);
    const { data: known } = keys.length ? await admin.from("imported_events").select("external_key").in("external_key", keys) : { data: [] };
    const knownKeys = new Set((known ?? []).map((k) => k.external_key));
    const fresh = found.filter((f) => !knownKeys.has(f.key));

    let added = 0, duplicates = 0;
    if (fresh.length) {
      // Compare against events already on TapIN (and in the queue) around the same dates.
      const minD = fresh.reduce((m, f) => (f.start! < m ? f.start! : m), fresh[0].start!);
      const maxD = fresh.reduce((m, f) => (f.start! > m ? f.start! : m), fresh[0].start!);
      const from = new Date(new Date(minD).getTime() - 86400000).toISOString(), to = new Date(new Date(maxD).getTime() + 86400000).toISOString();
      const [{ data: existing }, { data: queued }] = await Promise.all([
        admin.from("events").select("id, title, start_date").neq("status", "cancelled").gte("start_date", from).lte("start_date", to).limit(2000),
        admin.from("imported_events").select("id, title, start_date").in("status", ["pending", "approved"]).gte("start_date", from).lte("start_date", to).limit(2000),
      ]);
      const rows = fresh.map((f) => {
        const day = easternDay(f.start!);
        const dupEvent = (existing ?? []).find((e) => e.start_date && easternDay(e.start_date) === day && similar(e.title, f.title));
        const dupQueued = !dupEvent && (queued ?? []).some((e) => e.start_date && easternDay(e.start_date) === day && similar(e.title, f.title));
        if (dupEvent || dupQueued) duplicates++;
        return {
          source_id: s.id, external_key: f.key, title: f.title, start_date: f.start, end_date: f.end,
          location_name: f.location_name, location_address: f.location_address, description: f.description,
          ticket_url: f.ticket_url, event_url: f.event_url, image_url: f.image_url, category: f.category, price: f.price, is_free: f.is_free,
          status: dupEvent || dupQueued ? "duplicate" : "pending", duplicate_of: dupEvent?.id ?? null,
          issues: issuesFor(f, s.kind),
        };
      });
      const { error: insErr } = await admin.from("imported_events").upsert(rows, { onConflict: "external_key", ignoreDuplicates: true });
      if (insErr) error = error ?? "Couldn't save what was found";
      else added = rows.length - duplicates;
    }
    const summary = error ? `Problem: ${error}` : `Found ${found.length} upcoming${via} \u00b7 ${added} new${duplicates ? ` \u00b7 ${duplicates} already listed` : ""}`;
    await admin.from("event_sources").update({ last_run_at: new Date().toISOString(), last_result: summary }).eq("id", s.id);
    results.push({ source: s.name, added, duplicates, error });
  }
  return respond({ checked: results.length, results });
});
