import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Group emails (server only; queued in email_outbox by the database):
//   group_invite          { group_id, email }    -> invites someone to join a group
//   group_booking_status  { booking_id, status } -> tells the organizer a group accepted/declined/countered
//   announce_new_site     { email, first_name, has_password } -> one-time new-site announcement
// Same design as TapIN's other emails. Skips when the invite no longer applies.

const SITE_URL = "https://app.tapin2events.com/";
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
const C = { indigo: "#4F46E5", teal: "#14B8A6", ink: "#111827", body: "#374151", muted: "#6B7280", faint: "#9CA3AF", line: "#E5E7EB", soft: "#F9FAFB", bg: "#F4F4F7", purple: "#6B21A8", purpleBg: "#F3E8FF" };
const tidy = (t: unknown) => String(t ?? "").replace(/\s+/g, " ").trim();
const esc = (t: unknown) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
const plain = (t: unknown, max = 150) => tidy(t).slice(0, max);
const httpsOnly = (u: unknown) => (typeof u === "string" && /^https:\/\//i.test(u.trim()) ? u.trim() : null);

function layout(opts: { preheader: string; eyebrow: string; body: string; why?: string }) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>TapIN</title></head>` +
    `<body style="margin:0;padding:0;background:${C.bg};-webkit-text-size-adjust:100%;">` +
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(opts.preheader)}</div>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};"><tr><td align="center" style="padding:24px 12px;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid ${C.line};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">` +
    `<tr><td style="background:${C.indigo};background-image:linear-gradient(135deg,${C.indigo},${C.teal});padding:22px 28px;">` +
    `<div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">TapIN</div>` +
    `<div style="margin-top:6px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.12em;color:#ffffff;opacity:0.92;">${esc(opts.eyebrow)}</div></td></tr>` +
    opts.body +
    `<tr><td style="padding:20px 28px 26px;border-top:1px solid ${C.line};background:${C.soft};">` +
    (opts.why ? `<p style="margin:0 0 10px;font-size:12px;line-height:1.5;color:${C.muted};">${esc(opts.why)}</p>` : "") +
    `<p style="margin:0;font-size:12px;line-height:1.6;color:${C.faint};">` +
    `<a href="${SITE_URL}profile" style="color:${C.muted};">Email settings</a> &nbsp;&middot;&nbsp; <a href="${SITE_URL}privacy" style="color:${C.muted};">Privacy</a> &nbsp;&middot;&nbsp; <a href="${SITE_URL}terms" style="color:${C.muted};">Terms</a><br>TapIN LLC &middot; Rolesville, North Carolina</p>` +
    `</td></tr></table></td></tr></table></body></html>`;
}
const section = (inner: string, pad = "24px 28px 0") => `<tr><td style="padding:${pad};">${inner}</td></tr>`;
const button = (href: string, text: string) => `<a href="${esc(href)}" style="display:inline-block;padding:13px 22px;border-radius:999px;font-size:15px;font-weight:700;text-decoration:none;background:${C.indigo};color:#ffffff;">${esc(text)}</a>`;
const para = (html: string) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:${C.body};">${html}</p>`;
const note = (html: string) => `<p style="margin:0;font-size:13px;line-height:1.55;color:${C.muted};">${html}</p>`;
const badge = (text: string) => `<span style="display:inline-block;padding:5px 12px;border-radius:999px;background:${C.purpleBg};color:${C.purple};font-size:12px;font-weight:700;">${esc(text)}</span>`;

Deno.serve(async (req) => {
  const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (token !== serviceKey) return respond({ error: "Not allowed." }, 403);
    const admin = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({}));
    const kind = String(body.kind ?? "");
    const skip = (reason: string) => respond({ skipped: reason });
    let to = "", subject = "", html = "";

    if (kind === "group_invite") {
      const groupId = String(body.group_id ?? "");
      const email = String(body.email ?? "");
      const { data: m } = await admin.from("group_members").select("user_email, role, title, status, invited_by").eq("group_id", groupId).eq("user_email", email).maybeSingle();
      if (!m || m.status !== "invited") return skip("invite no longer pending");
      const { data: g } = await admin.from("resources").select("id, display_name, profile_image, bio, kind, status").eq("id", groupId).maybeSingle();
      if (!g || g.kind !== "group" || g.status !== "active") return skip("group not available");
      const { data: inviter } = await admin.from("profiles").select("full_name").eq("email", m.invited_by ?? "").maybeSingle();
      const { count } = await admin.from("group_members").select("user_email", { count: "exact", head: true }).eq("group_id", groupId).eq("status", "active");
      const who = tidy(inviter?.full_name) || "Someone on TapIN";
      const groupName = tidy(g.display_name) || "a group";
      const role = m.role === "admin" ? "an admin" : "a member";
      const img = httpsOnly(g.profile_image);
      to = email;
      subject = `${plain(who, 60)} invited you to join ${plain(groupName, 80)} on TapIN`;
      let b = section(
        `<table role="presentation" cellpadding="0" cellspacing="0"><tr>` +
        (img ? `<td width="64" valign="middle"><img src="${esc(img)}" width="56" height="56" alt="" style="display:block;width:56px;height:56px;border-radius:999px;object-fit:cover;"></td>` : "") +
        `<td valign="middle" style="padding-left:${img ? "12px" : "0"};">${badge("Group invite")}` +
        `<div style="margin-top:8px;font-size:22px;line-height:1.25;font-weight:800;color:${C.ink};">${esc(groupName)}</div>` +
        `<div style="margin-top:2px;font-size:13px;color:${C.muted};">${count ?? 1} member${count === 1 ? "" : "s"}</div></td></tr></table>`);
      b += section(para(`<strong>${esc(who)}</strong> invited you to join <strong>${esc(groupName)}</strong> as ${role}${m.title ? ` (${esc(tidy(m.title))})` : ""}.`) +
        (g.bio ? `<div style="margin:4px 0 14px;padding:12px 14px;border-radius:12px;background:${C.soft};border:1px solid ${C.line};font-size:14px;line-height:1.5;color:${C.body};">${esc(plain(g.bio, 280))}</div>` : "") +
        note("Members appear on the group's page, can be booked together, and share in the group's booking payments."));
      b += section(button(SITE_URL + "groups", "Review invite") +
        `<div style="margin-top:14px;">${note(`Sign in with this email address (${esc(email)}) to join or decline. Not interested? You can ignore this email.`)}</div>`, "20px 28px 24px");
      html = layout({ preheader: `${plain(who, 60)} invited you to join ${plain(groupName, 60)}.`, eyebrow: "You're invited to a group", body: b, why: "You're receiving this because a group admin on TapIN invited you." });
    } else if (kind === "group_booking_status") {
      // A group's owner/admin accepted, declined, or countered a booking: tell the organizer.
      const { data: bk } = await admin.from("resource_bookings").select("id, event_id, resource_id, organizer_email, status, offered_rate, counter_offer_rate, final_rate, response_from_resource").eq("id", String(body.booking_id ?? "")).maybeSingle();
      if (!bk) return skip("booking not found");
      if (String(body.status ?? "") !== bk.status) return skip("status changed again");
      const { data: g } = await admin.from("resources").select("display_name, profile_image").eq("id", bk.resource_id).maybeSingle();
      const { data: ev } = await admin.from("events").select("title").eq("id", bk.event_id).maybeSingle();
      const groupName = tidy(g?.display_name) || "The group";
      const eventTitle = tidy(ev?.title) || "your event";
      const money = (n: unknown) => "$" + (Number(n) || 0).toFixed(2);
      const copy: Record<string, { badge: string; subject: string; line: string; button: string }> = {
        accepted: { badge: "\u2713 Booking accepted", subject: `Booking accepted: ${plain(groupName, 60)} for ${plain(eventTitle, 60)}`, line: `<strong>${esc(groupName)}</strong> accepted your booking for <strong>${esc(eventTitle)}</strong>${bk.final_rate != null ? ` at <strong>${esc(money(bk.final_rate))}</strong>` : ""}. You can now pay securely through TapIN; the payment is shared among the group's members.`, button: "Pay & view booking" },
        rejected: { badge: "Booking declined", subject: `Booking declined: ${plain(groupName, 60)} for ${plain(eventTitle, 60)}`, line: `<strong>${esc(groupName)}</strong> isn't able to take your booking for <strong>${esc(eventTitle)}</strong>.`, button: "Find other artists & resources" },
        counter_offered: { badge: "Counter offer", subject: `Counter offer from ${plain(groupName, 60)} for ${plain(eventTitle, 60)}`, line: `<strong>${esc(groupName)}</strong> sent a counter offer of <strong>${esc(money(bk.counter_offer_rate))}</strong> for <strong>${esc(eventTitle)}</strong> (you offered ${esc(money(bk.offered_rate))}).`, button: "Review counter offer" },
      };
      const c = copy[bk.status];
      if (!c) return skip("no email for this status");
      to = bk.organizer_email;
      subject = c.subject;
      let b = section(`<span style="display:inline-block;padding:5px 12px;border-radius:999px;background:#EEF2FF;color:${C.indigo};font-size:12px;font-weight:700;">${esc(c.badge)}</span>` +
        `<div style="margin-top:10px;font-size:22px;line-height:1.25;font-weight:800;color:${C.ink};">${esc(eventTitle)}</div>`);
      b += section(para(c.line) + (bk.response_from_resource ? `<div style="margin:4px 0 0;padding:12px 14px;border-radius:12px;background:${C.soft};border:1px solid ${C.line};font-size:14px;line-height:1.5;color:${C.body};">\u201c${esc(plain(bk.response_from_resource, 600))}\u201d</div>` : ""));
      b += section(button(bk.status === "rejected" ? SITE_URL + "resources" : SITE_URL + "organizer/bookings?booking=" + bk.id, c.button), "20px 28px 24px");
      html = layout({ preheader: c.subject, eyebrow: c.badge.replace("\u2713 ", ""), body: b, why: "You're receiving this because you sent a booking request on TapIN." });
    } else if (kind === "announce_new_site") {
      // One-time announcement of the new site. { email, first_name, has_password }
      const email = String(body.email ?? "");
      const { data: p } = await admin.from("profiles").select("full_name, is_banned").eq("email", email).maybeSingle();
      if (!p || p.is_banned) return skip("no longer applies");
      const { data: wants } = await admin.rpc("notif_wants", { p_email: email, p_key: "email_notifications" });
      if (wants === false) return skip("preference");
      const first = tidy(body.first_name) || tidy(p.full_name).split(" ")[0] || "there";
      const hasPassword = body.has_password === true;
      const item = (title: string, text: string) => `<tr><td valign="top" style="padding:6px 10px 6px 0;font-size:15px;color:${C.indigo};">&#9679;</td><td style="padding:6px 0;font-size:15px;line-height:1.5;color:${C.body};"><strong style="color:${C.ink};">${esc(title)}</strong> ${esc(text)}</td></tr>`;
      to = email;
      subject = "TapIN has a new home: app.tapin2events.com";
      let b = section(`<div style="font-size:24px;line-height:1.25;font-weight:800;color:${C.ink};">Hi ${esc(first)},</div>` +
        `<p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:${C.body};">TapIN2Events has a brand-new home: <a href="${SITE_URL}" style="color:${C.indigo};font-weight:700;">app.tapin2events.com</a>. We rebuilt TapIN from the ground up to be faster and easier to use. Your account and everything in it came with you.</p>`);
      b += section(`<div style="padding:14px 16px;border-radius:14px;background:#EEF2FF;">` +
        `<div style="font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:${C.indigo};">Signing in</div>` +
        (hasPassword
          ? `<p style="margin:6px 0 0;font-size:15px;line-height:1.55;color:${C.body};">Sign in as usual with your email and password, or ask for a 6-digit code by email.</p>`
          : `<p style="margin:6px 0 0;font-size:15px;line-height:1.55;color:${C.body};">Sign in with your email and we'll send you a 6-digit code. Then set a password anytime from your <a href="${SITE_URL}profile#password" style="color:${C.indigo};">Profile</a>.</p>` +
            `<p style="margin:6px 0 0;font-size:13px;line-height:1.5;color:${C.muted};">If you used TapIN before, your old password didn't carry over.</p>`) +
        `</div>`, "18px 28px 0");
      b += section(`<div style="font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:${C.faint};margin-bottom:6px;">What's new</div>` +
        `<table role="presentation" cellpadding="0" cellspacing="0" width="100%">` +
        item("Discover events near you:", "a map, today's events, and picks based on your interests") +
        item("Tickets in seconds,", "with QR codes in your Activity tab") +
        item("Lineups and schedules:", "see who's performing and when") +
        item("Book artists, vendors, and services,", "and pay securely in the app") +
        item("Groups:", "bands, crews, and collectives get their own page, shared booking payments, and a private group chat") +
        item("A social feed", "to share and watch videos from the community") +
        `</table>` +
        `<p style="margin:12px 0 0;font-size:14px;line-height:1.55;color:${C.muted};"><strong style="color:${C.ink};">Tip:</strong> add TapIN to your phone's Home Screen for a full-screen, app-like experience.</p>`, "20px 28px 0");
      b += section(button(SITE_URL, "Open TapIN") +
        `<p style="margin:18px 0 0;font-size:15px;line-height:1.6;color:${C.body};">Thanks for being part of the TapIN community!<br><strong>William</strong>, TapIN2Events</p>`, "22px 28px 24px");
      html = layout({ preheader: "Same account, brand-new TapIN. Here's how to sign in and what's new.", eyebrow: "A new home for TapIN", body: b, why: "You're receiving this one-time announcement because you have a TapIN account. You can turn off emails in Email settings." });
    } else {
      return respond({ error: "Unknown email type." }, 400);
    }

    if (!EMAIL_RE.test(to)) return respond({ error: "No valid recipient for this email." }, 400);
    if (body.preview === true) return respond({ to, subject, html });
    const sendRes = await fetch(`${supabaseUrl}/functions/v1/send-ticket-confirmation`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, html }),
    });
    if (!sendRes.ok) {
      console.error("[send-group-email] send failed", kind, sendRes.status, (await sendRes.text()).slice(0, 300));
      return respond({ error: "The email couldn't be sent right now." }, 502);
    }
    return respond({ success: true });
  } catch (e) {
    console.error("[send-group-email] error", e);
    return respond({ error: "Something went wrong." }, 500);
  }
});
