import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Low-level email sender (Resend). SERVER-ONLY: callers must present the
// service role key, so only TapIN's own functions can use it. The app never
// calls this directly; it uses send-app-email, which checks permissions and
// builds safe templates.
//
// Replies: an optional reply_to (e.g. an organizer) is used when given;
// otherwise replies go to support@tapin2events.com, so nothing bounces.
//
// Groups: an email addressed to a group's internal address
// (group-<id>@groups.tapin2events.com) goes to the group's owner and admins
// instead, each separately, with links pointed at the group's Manage page.
//
// Links: any link to the old site address (tapin2events-star.github.io/
// tapin2events-organizer/) is rewritten to app.tapin2events.com before sending.
//
// Perks: ticket emails (payment and registration confirmations, ticket copies) for an event with local partners
// get a "Your ticket unlocks N perks nearby" box above the footer (see the deployed function, v26).
//
// White-label: attendee emails about a white-labeled event (ticket confirmations, registrations, ticket copies,
// reminders, event updates/cancellations, organizer messages) are re-skinned with the organization's logo, name
// and colors, TapIN mentions are removed, they're sent from the organization's name, and replies go to the
// organization's contact email (unless the organizer set a reply-to).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
const GROUP_RE = /^group-([0-9a-f-]{36})@groups\.tapin2events\.com$/i;
const OLD_SITE = /https?:\/\/tapin2events-star\.github\.io\/tapin2events-organizer\/?/g;
const NEW_SITE = "https://app.tapin2events.com/";
const SUPPORT = "support@tapin2events.com";
const TAPIN_HEADER = '<div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">TapIN</div>';
const ATTENDEE_EYEBROWS = ["Payment confirmed", "Registration confirmed", "Your ticket", "See you tomorrow", "Event updated", "Event cancelled", "Message about your event"];
const esc = (t: unknown) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
const hex = (v: unknown, fallback: string) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim() : fallback);

type Brand = { name: string; logo: string | null; primary: string; accent: string; place: string; contact: string | null };

// Which white-labeled event (if any) this attendee email is about.
async function whiteLabelBrand(admin: ReturnType<typeof createClient>, html: string): Promise<Brand | null> {
  if (!html.includes(TAPIN_HEADER)) return null;
  const eyebrow = html.slice(html.indexOf(TAPIN_HEADER) + TAPIN_HEADER.length, html.indexOf(TAPIN_HEADER) + TAPIN_HEADER.length + 400);
  if (!ATTENDEE_EYEBROWS.some((e) => eyebrow.includes(`>${e}</div>`))) return null;
  const m = html.match(/\/(events|pass)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  if (!m) return null;
  let eventId = m[2];
  if (m[1] === "pass") {
    const { data: t } = await admin.from("tickets").select("event_id").eq("id", m[2]).maybeSingle();
    if (!t?.event_id) return null;
    eventId = t.event_id;
  }
  const { data: ev } = await admin.from("events").select("white_label, organization_id").eq("id", eventId).maybeSingle();
  if (!ev?.white_label || !ev.organization_id) return null;
  const { data: o } = await admin.from("organizations").select("name, logo_url, brand, city, state, contact_email").eq("id", ev.organization_id).maybeSingle();
  if (!o) return null;
  const b = (o.brand ?? {}) as { primary?: string; accent?: string };
  return {
    name: String(o.name ?? "").replace(/[\r\n<>"]+/g, " ").trim().slice(0, 60) || "Your event",
    logo: typeof o.logo_url === "string" && /^https:\/\//i.test(o.logo_url) ? o.logo_url : null,
    primary: hex(b.primary, "#0F1B3D"), accent: hex(b.accent, "#C9A227"),
    place: [o.city, o.state].filter(Boolean).join(", "),
    contact: typeof o.contact_email === "string" && EMAIL_RE.test(o.contact_email) ? o.contact_email : null,
  };
}

function rebrand(html: string, b: Brand) {
  const header = `<table role="presentation" cellpadding="0" cellspacing="0"><tr>` +
    (b.logo ? `<td style="padding-right:12px;" valign="middle"><img src="${esc(b.logo)}" width="44" height="44" alt="" style="display:block;width:44px;height:44px;border-radius:10px;background:#ffffff;object-fit:contain;"></td>` : "") +
    `<td valign="middle"><div style="font-size:21px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">${esc(b.name)}</div></td></tr></table>`;
  return html
    .replace(TAPIN_HEADER, header)
    .replace("background:#4F46E5;background-image:linear-gradient(135deg,#4F46E5,#14B8A6)", `background:${b.primary};background-image:linear-gradient(135deg,${b.primary},${b.accent})`)
    .replace(/#4F46E5/gi, b.primary)
    .replace("<title>TapIN</title>", `<title>${esc(b.name)}</title>`)
    .replace("TapIN LLC &middot; Rolesville, North Carolina", `${esc(b.name)}${b.place ? " &middot; " + esc(b.place) : ""}`)
    .replace(/ on TapIN/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  const jsonHeaders = Object.assign({}, corsHeaders, { "content-type": "application/json" });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!serviceKey || token !== serviceKey) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: jsonHeaders });
  }

  try {
    const body = await req.json();
    const to = body.to;
    let subject = body.subject;
    let html = body.html;
    if (!to || !subject || !html) {
      return new Response(JSON.stringify({ error: "Missing to/subject/html" }), { status: 400, headers: jsonHeaders });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "Resend not configured yet (RESEND_API_KEY)" }), { status: 500, headers: jsonHeaders });
    }

    // Current site address in every link.
    html = String(html).replace(OLD_SITE, NEW_SITE);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

    // White-labeled event emails: the organization's brand and name.
    let fromName = "TapIN";
    let brandReplyTo: string | null = null;
    try {
      const brand = await whiteLabelBrand(admin, html);
      if (brand) { html = rebrand(html, brand); fromName = brand.name; brandReplyTo = brand.contact; }
    } catch (e) { console.error("[send-ticket-confirmation] white-label", e); }

    // Who actually receives it.
    let recipients: string[] = [typeof to === "string" ? to : String(to)];
    const group = typeof to === "string" ? to.match(GROUP_RE) : null;
    if (group) {
      const groupId = group[1];
      const [{ data: g }, { data: leads }] = await Promise.all([
        admin.from("resources").select("display_name").eq("id", groupId).eq("kind", "group").maybeSingle(),
        admin.from("group_members").select("user_email").eq("group_id", groupId).eq("status", "active").in("role", ["owner", "admin"]),
      ]);
      recipients = (leads ?? []).map((m) => m.user_email).filter((e) => EMAIL_RE.test(e));
      if (recipients.length === 0) {
        return new Response(JSON.stringify({ success: true, skipped: "group has no admins" }), { status: 200, headers: jsonHeaders });
      }
      const name = String(g?.display_name ?? "Your group").replace(/[\r\n]+/g, " ").slice(0, 80);
      subject = `[${name}] ${subject}`;
      // Point resource-dashboard links at the group's own Manage page.
      html = html.replace(/(https:\/\/[^"']+?\/)resources\/dashboard(\?[^"']*)?/g, `$1groups/${groupId}/manage`);
    }

    const replyTo = typeof body.reply_to === "string" && EMAIL_RE.test(body.reply_to) ? body.reply_to : (brandReplyTo ?? SUPPORT);
    const safeFrom = fromName.replace(/[^\p{L}\p{N} &.,'!-]/gu, "").trim().slice(0, 60) || "TapIN";
    const ids: string[] = [];
    for (const recipient of recipients) {
      const payload: Record<string, unknown> = { from: `${safeFrom} <tickets@tapin2events.com>`, to: recipient, subject, html, reply_to: replyTo };
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: "Bearer " + resendApiKey, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        return new Response(JSON.stringify({ error: "resend send failed", details: data }), { status: 502, headers: jsonHeaders });
      }
      ids.push(data.id);
    }

    return new Response(JSON.stringify({ success: true, id: ids[0], ids }), { status: 200, headers: jsonHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: jsonHeaders });
  }
});
