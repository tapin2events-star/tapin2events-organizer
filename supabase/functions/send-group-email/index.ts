import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Group emails (server only; queued in email_outbox by the database):
//   group_invite  { group_id, email }  -> invites someone to join a group
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
