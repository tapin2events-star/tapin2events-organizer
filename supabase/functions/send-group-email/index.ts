import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Group emails (server only; queued in email_outbox by the database):
//   group_invite          { group_id, email }    -> invites someone to join a group
//   group_booking_status  { booking_id, status } -> tells the organizer a group accepted/declined/countered
//   announce_new_site     { email, first_name, has_password } -> one-time new-site announcement
//   receipt_booking_organizer { booking_id }            -> booking payment receipt for the organizer
//   receipt_booking_payee     { booking_id, email, cents } -> "you've been paid" for a resource or group member
//   follow_batch          { organizer_id }       -> new events from an organizer: notify followers, queue their emails
//   follow_new_events     { organizer_id, event_ids, email, first_name } -> one follower's new-events email
//   follow_gigs_batch     { resource_id }        -> resource added to lineups: notify followers, queue their emails
//   follow_gigs           { resource_id, event_ids, email, first_name } -> one follower's "where to catch them" email
//   lineup_invite         { booking_id }         -> free lineup invite for a resource (groups go to their admins)
// Same design as TapIN's other emails. Skips when the invite no longer applies.

const SITE_URL = "https://app.tapin2events.com/";
const APP_STORE_URL = "https://apps.apple.com/us/app/tapin2events/id6474884074";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=net.tapin2events.app";
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
      const storeBtn = (href: string, top: string, label: string) =>
        `<a href="${esc(href)}" style="display:inline-block;margin:4px 6px 4px 0;padding:9px 16px;border-radius:12px;background:${C.ink};color:#ffffff;text-decoration:none;line-height:1.15;">` +
        `<span style="display:block;font-size:10px;opacity:0.85;">${esc(top)}</span><span style="display:block;font-size:16px;font-weight:700;">${esc(label)}</span></a>`;
      b += section(`<div style="padding:14px 16px;border-radius:14px;border:1px solid ${C.line};">` +
        `<div style="font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:${C.faint};">Using the TapIN app?</div>` +
        `<p style="margin:6px 0 10px;font-size:15px;line-height:1.55;color:${C.body};">Update to the latest version, or download it if you haven't yet:</p>` +
        storeBtn(APP_STORE_URL, "Download on the", "App Store") + storeBtn(PLAY_STORE_URL, "Get it on", "Google Play") +
        `</div>`, "20px 28px 0");
      b += section(button(SITE_URL, "Open TapIN") +
        `<p style="margin:18px 0 0;font-size:15px;line-height:1.6;color:${C.body};">Thanks for being part of the TapIN community!<br><strong>William</strong>, TapIN2Events</p>`, "22px 28px 24px");
      html = layout({ preheader: "Same account, brand-new TapIN. Here's how to sign in and what's new.", eyebrow: "A new home for TapIN", body: b, why: "You're receiving this one-time announcement because you have a TapIN account. You can turn off emails in Email settings." });
    } else if (kind === "receipt_booking_organizer" || kind === "receipt_booking_payee") {
      // Booking payment emails, sent once the payment is recorded.
      //  organizer: a receipt.   payee: "you've been paid" (individual resource, or one group member's share).
      const { data: bk } = await admin.from("resource_bookings").select("id, event_id, resource_id, organizer_email, resource_email, amount_paid, final_rate, platform_fee, paid_at, payment_intent_id, payment_status").eq("id", String(body.booking_id ?? "")).maybeSingle();
      if (!bk || !["paid", "refunded"].includes(bk.payment_status)) return skip("not paid");
      const [{ data: r }, { data: ev }] = await Promise.all([
        admin.from("resources").select("display_name, kind").eq("id", bk.resource_id).maybeSingle(),
        admin.from("events").select("title, start_date").eq("id", bk.event_id).maybeSingle(),
      ]);
      const name = tidy(r?.display_name) || "your booking";
      const isGroup = r?.kind === "group";
      const eventTitle = tidy(ev?.title) || "your event";
      const money = (n: number) => "$" + n.toFixed(2);
      const price = Number(bk.amount_paid ?? bk.final_rate ?? 0);
      const fees = Number(bk.platform_fee ?? 0);
      const paidOn = new Date(bk.paid_at ?? Date.now()).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" });
      const row = (label: string, value: string, strong = false) => `<tr><td style="padding:7px 0;font-size:14px;color:${strong ? C.ink : C.muted};${strong ? "font-weight:700;" : ""}">${esc(label)}</td><td align="right" style="padding:7px 0;font-size:14px;color:${C.ink};${strong ? "font-weight:800;" : ""}">${esc(value)}</td></tr>`;
      if (kind === "receipt_booking_organizer") {
        to = bk.organizer_email;
        subject = `Receipt: ${plain(name, 60)} for ${plain(eventTitle, 60)}`;
        let b = section(`<span style="display:inline-block;padding:5px 12px;border-radius:999px;background:#DCFCE7;color:#166534;font-size:12px;font-weight:700;">\u2713 Payment received</span>` +
          `<div style="margin-top:10px;font-size:22px;line-height:1.25;font-weight:800;color:${C.ink};">${esc(name)}</div>` +
          `<div style="margin-top:2px;font-size:14px;color:${C.muted};">for ${esc(eventTitle)}</div>`);
        b += section(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${C.line};border-bottom:1px solid ${C.line};">` +
          row(isGroup ? "Booking (shared among the group's members)" : "Booking", money(price)) +
          row("Service & processing fees", money(fees)) +
          row("Total paid", money(price + fees), true) +
          `</table>` +
          `<p style="margin:10px 0 0;font-size:13px;line-height:1.55;color:${C.muted};">Paid ${esc(paidOn)}${bk.payment_intent_id ? ` &middot; Reference ${esc(String(bk.payment_intent_id).slice(-10).toUpperCase())}` : ""}</p>` +
          `<p style="margin:8px 0 0;font-size:13px;line-height:1.55;color:${C.muted};">If the booking is cancelled, the booking price is refunded; service and processing fees aren't. <a href="${SITE_URL}refund-policy" style="color:${C.indigo};">Refund policy</a></p>`, "18px 28px 0");
        b += section(button(SITE_URL + "organizer/bookings?booking=" + bk.id, "View booking"), "20px 28px 24px");
        html = layout({ preheader: `You paid ${money(price + fees)} for ${plain(name, 50)}.`, eyebrow: "Booking receipt", body: b, why: "You're receiving this receipt because you paid for a booking on TapIN." });
      } else {
        const email = String(body.email ?? "");
        const cents = Number(body.cents ?? Math.round(price * 100));
        if (!email) return skip("no payee");
        to = email;
        const share = isGroup ? "your share" : "";
        subject = isGroup ? `You've been paid your share for ${plain(eventTitle, 70)}` : `You've been paid for ${plain(eventTitle, 80)}`;
        let b = section(`<span style="display:inline-block;padding:5px 12px;border-radius:999px;background:#DCFCE7;color:#166534;font-size:12px;font-weight:700;">\u2713 You've been paid</span>` +
          `<div style="margin-top:10px;font-size:30px;line-height:1.2;font-weight:800;color:${C.ink};">${esc(money(cents / 100))}</div>` +
          `<div style="margin-top:2px;font-size:14px;color:${C.muted};">${isGroup ? `Your share for ${esc(name)} at ` : "For your booking at "}${esc(eventTitle)}</div>`);
        b += section(para(`The organizer paid ${isGroup ? `the group's booking (${esc(money(price))} total), and ${share} is` : "your booking, and the money is"} on its way to your bank through Stripe. It arrives on your usual Stripe payout schedule, often within a few business days.`) +
          note("TapIN's fees are paid by the organizer, so you receive the full amount shown."), "16px 28px 0");
        b += section(button(isGroup ? `${SITE_URL}groups/${bk.resource_id}/manage` : `${SITE_URL}resources/dashboard`, "View booking"), "20px 28px 24px");
        html = layout({ preheader: `${money(cents / 100)} is on its way to your bank.`, eyebrow: "Payment sent", body: b, why: "You're receiving this because you were paid for a booking on TapIN." });
      }
    } else if (kind === "follow_batch") {
      // An organizer published new events an hour ago: notify their followers (in-app now, email queued per follower).
      const organizerId = String(body.organizer_id ?? "");
      const { data: alerts } = await admin.from("follower_event_alerts").update({ processed_at: new Date().toISOString() })
        .eq("organizer_id", organizerId).is("processed_at", null).select("event_id");
      const ids = (alerts ?? []).map((a) => a.event_id);
      if (!ids.length) return skip("nothing new");
      const nowIso = new Date().toISOString();
      const { data: evs } = await admin.from("events").select("id, title, start_date, end_date, status").in("id", ids).eq("status", "published");
      const live = (evs ?? []).filter((e) => (e.end_date ?? e.start_date) && String(e.end_date ?? e.start_date) > nowIso)
        .sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)));
      if (!live.length) return skip("events no longer upcoming or published");
      const { data: org } = await admin.from("profiles").select("full_name, email").eq("id", organizerId).maybeSingle();
      const orgName = tidy(org?.full_name) || "An organizer you follow";
      const { data: people } = await admin.rpc("organizer_alert_recipients", { p_organizer_id: organizerId });
      const list = (people ?? []) as { email: string; first_name: string; wants_email: boolean }[];
      if (!list.length) return skip("no followers");
      const first = live[0];
      const msg = live.length === 1
        ? `${orgName} posted a new event: ${first.title}`
        : `${orgName} posted ${live.length} new events, including ${first.title}`;
      for (let i = 0; i < list.length; i += 500) {
        await admin.from("notifications").insert(list.slice(i, i + 500).map((p) => ({
          user_email: p.email, type: "followed_new_event", message: msg.slice(0, 240),
          link: live.length === 1 ? `/events/${first.id}` : `/creator/${encodeURIComponent(org?.email ?? "")}`,
          related_entity_type: "event", related_entity_id: first.id,
        })));
      }
      const rows = list.filter((p) => p.wants_email && EMAIL_RE.test(p.email)).map((p) => ({
        kind: "follow_new_events",
        payload: { organizer_id: organizerId, event_ids: live.map((e) => e.id), email: p.email, first_name: p.first_name },
        dedupe_key: `follow_new_events:${p.email}:${first.id}`,
        send_after: new Date().toISOString(),
      }));
      for (let i = 0; i < rows.length; i += 500) await admin.from("email_outbox").insert(rows.slice(i, i + 500));
      return skip(`notified ${list.length}, queued ${rows.length} emails`);
    } else if (kind === "follow_new_events") {
      // One follower's email about an organizer's new event(s).
      const email = String(body.email ?? "");
      const ids = Array.isArray(body.event_ids) ? body.event_ids.map(String).slice(0, 12) : [];
      const nowIso = new Date().toISOString();
      const { data: evs } = await admin.from("events").select("id, title, start_date, end_date, status, location_name, is_online, poster_url, event_type, ticket_price, external_ticket_url").in("id", ids).eq("status", "published");
      const live = (evs ?? []).filter((e) => String(e.end_date ?? e.start_date ?? "") > nowIso).sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)));
      if (!live.length) return skip("events no longer available");
      const { data: wants } = await admin.rpc("notif_wants", { p_email: email, p_key: "followed_new_events" });
      if (wants === false) return skip("preference");
      const { data: org } = await admin.from("profiles").select("full_name, email, profile_photo").eq("id", String(body.organizer_id ?? "")).maybeSingle();
      const orgName = tidy(org?.full_name) || "An organizer you follow";
      const when = (e: { start_date: string | null }) => e.start_date
        ? new Date(e.start_date).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }).replace(":00 ", " ")
        : "Date to be announced";
      const price = (e: { event_type: string | null; ticket_price: number | null }) => e.event_type === "free" ? "Free" : Number(e.ticket_price) > 0 ? `From $${Number(e.ticket_price).toFixed(2)}` : "";
      const card = (e: (typeof live)[number]) => {
        const img = httpsOnly(e.poster_url);
        const meta = [when(e), e.is_online ? "Online" : tidy(e.location_name), price(e)].filter(Boolean).map((x) => esc(x)).join(" &middot; ");
        const cta = e.event_type === "free" ? "Register" : "Get tickets";
        return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;border:1px solid ${C.line};border-radius:16px;overflow:hidden;">` +
          (img ? `<tr><td><a href="${SITE_URL}events/${e.id}"><img src="${esc(img)}" alt="" width="464" style="display:block;width:100%;max-height:240px;object-fit:cover;"></a></td></tr>` : "") +
          `<tr><td style="padding:14px 16px;"><div style="font-size:17px;line-height:1.3;font-weight:800;color:${C.ink};">${esc(tidy(e.title))}</div>` +
          `<div style="margin-top:4px;font-size:13px;line-height:1.5;color:${C.muted};">${meta}</div>` +
          `<div style="margin-top:12px;">${button(`${SITE_URL}events/${e.id}`, cta)}</div></td></tr></table>`;
      };
      const firstName = tidy(body.first_name);
      to = email;
      subject = live.length === 1 ? `${plain(orgName, 50)} just posted: ${plain(live[0].title, 70)}` : `${plain(orgName, 50)} posted ${live.length} new events`;
      const img = httpsOnly(org?.profile_photo);
      let b = section(`<table role="presentation" cellpadding="0" cellspacing="0"><tr>` +
        (img ? `<td width="52" valign="middle"><img src="${esc(img)}" width="44" height="44" alt="" style="display:block;width:44px;height:44px;border-radius:999px;object-fit:cover;"></td>` : "") +
        `<td valign="middle" style="font-size:15px;line-height:1.5;color:${C.body};">${firstName ? `Hi ${esc(firstName)}, ` : ""}<strong style="color:${C.ink};">${esc(orgName)}</strong> just posted ${live.length === 1 ? "a new event" : `${live.length} new events`}.</td></tr></table>`);
      b += section(live.map(card).join(""), "18px 28px 10px");
      b += section(note(`You're getting this because you follow ${esc(orgName)} on TapIN. <a href="${SITE_URL}creator/${encodeURIComponent(org?.email ?? "")}" style="color:${C.indigo};">Unfollow</a> &middot; <a href="${SITE_URL}profile#notifications" style="color:${C.indigo};">Turn off these emails</a>`), "6px 28px 24px");
      html = layout({ preheader: live.length === 1 ? `${when(live[0])}${live[0].location_name ? " \u00b7 " + tidy(live[0].location_name) : ""}` : `See ${orgName}'s new events.`, eyebrow: "New from organizers you follow", body: b });
    } else if (kind === "follow_gigs_batch") {
      // A resource was added to published event lineups an hour ago: notify their followers.
      const resourceId = String(body.resource_id ?? "");
      const { data: alerts } = await admin.from("resource_appearance_alerts").update({ processed_at: new Date().toISOString() })
        .eq("resource_id", resourceId).is("processed_at", null).select("event_id");
      const ids = (alerts ?? []).map((a) => a.event_id);
      if (!ids.length) return skip("nothing new");
      const { data: res } = await admin.from("resources").select("id, display_name, email, status, announce_lineups").eq("id", resourceId).maybeSingle();
      if (!res || res.status !== "active" || res.announce_lineups === false) return skip("resource not announcing");
      // Still on the lineup, published and upcoming?
      const { data: apps } = await admin.rpc("resource_appearances", { p_resource_id: resourceId });
      const live = ((apps ?? []) as { event_id: string; title: string; start_date: string | null }[]).filter((a) => ids.includes(a.event_id))
        .sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)));
      if (!live.length) return skip("no longer on a published upcoming lineup");
      const { data: people } = await admin.rpc("resource_alert_recipients", { p_resource_id: resourceId });
      const list = (people ?? []) as { email: string; first_name: string; wants_email: boolean }[];
      if (!list.length) return skip("no followers");
      const name = tidy(res.display_name) || "An artist you follow";
      const msg = live.length === 1 ? `${name} is on the lineup for ${live[0].title}` : `${name} is on the lineup for ${live.length} upcoming events`;
      for (let i = 0; i < list.length; i += 500) {
        await admin.from("notifications").insert(list.slice(i, i + 500).map((p) => ({
          user_email: p.email, type: "followed_gig", message: msg.slice(0, 240),
          link: live.length === 1 ? `/events/${live[0].event_id}` : `/resources/${resourceId}`,
          related_entity_type: "event", related_entity_id: live[0].event_id,
        })));
      }
      const rows = list.filter((p) => p.wants_email && EMAIL_RE.test(p.email)).map((p) => ({
        kind: "follow_gigs",
        payload: { resource_id: resourceId, event_ids: live.map((e) => e.event_id), email: p.email, first_name: p.first_name },
        dedupe_key: `follow_gigs:${p.email}:${resourceId}:${live[0].event_id}`,
        send_after: new Date().toISOString(),
      }));
      for (let i = 0; i < rows.length; i += 500) await admin.from("email_outbox").insert(rows.slice(i, i + 500));
      return skip(`notified ${list.length}, queued ${rows.length} emails`);
    } else if (kind === "follow_gigs") {
      // One follower's email: where to catch an artist/resource next.
      const email = String(body.email ?? "");
      const resourceId = String(body.resource_id ?? "");
      const ids = Array.isArray(body.event_ids) ? body.event_ids.map(String) : [];
      const { data: wants } = await admin.rpc("notif_wants", { p_email: email, p_key: "followed_gigs" });
      if (wants === false) return skip("preference");
      const { data: res } = await admin.from("resources").select("display_name, profile_image, kind").eq("id", resourceId).maybeSingle();
      const { data: apps } = await admin.rpc("resource_appearances", { p_resource_id: resourceId });
      const live = ((apps ?? []) as { event_id: string; title: string; start_date: string | null; location_name: string | null; is_online: boolean | null; poster_url: string | null; role: string | null }[])
        .filter((a) => ids.includes(a.event_id)).sort((a, b) => String(a.start_date).localeCompare(String(b.start_date))).slice(0, 12);
      if (!live.length) return skip("no longer on the lineup");
      const name = tidy(res?.display_name) || "An artist you follow";
      const when = (d: string | null) => d
        ? new Date(d).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }).replace(":00 ", " ")
        : "Date to be announced";
      const { data: evs } = await admin.from("events").select("id, event_type").in("id", live.map((a) => a.event_id));
      const freeIds = new Set((evs ?? []).filter((e) => e.event_type === "free").map((e) => e.id));
      const card = (a: (typeof live)[number]) => {
        const img = httpsOnly(a.poster_url);
        const meta = [when(a.start_date), a.is_online ? "Online" : tidy(a.location_name)].filter(Boolean).map((x) => esc(x)).join(" &middot; ");
        return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;border:1px solid ${C.line};border-radius:16px;overflow:hidden;">` +
          (img ? `<tr><td><a href="${SITE_URL}events/${a.event_id}"><img src="${esc(img)}" alt="" width="464" style="display:block;width:100%;max-height:240px;object-fit:cover;"></a></td></tr>` : "") +
          `<tr><td style="padding:14px 16px;">` +
          (a.role ? `<div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:${C.indigo};">${esc(tidy(a.role))}</div>` : "") +
          `<div style="margin-top:2px;font-size:17px;line-height:1.3;font-weight:800;color:${C.ink};">${esc(tidy(a.title))}</div>` +
          `<div style="margin-top:4px;font-size:13px;line-height:1.5;color:${C.muted};">${meta}</div>` +
          `<div style="margin-top:12px;">${button(`${SITE_URL}events/${a.event_id}`, freeIds.has(a.event_id) ? "Register" : "Get tickets")}</div></td></tr></table>`;
      };
      const firstName = tidy(body.first_name);
      to = email;
      subject = live.length === 1 ? `${plain(name, 50)} is performing at ${plain(live[0].title, 70)}` : `Catch ${plain(name, 50)} at ${live.length} upcoming events`;
      const img = httpsOnly(res?.profile_image);
      let b = section(`<table role="presentation" cellpadding="0" cellspacing="0"><tr>` +
        (img ? `<td width="52" valign="middle"><img src="${esc(img)}" width="44" height="44" alt="" style="display:block;width:44px;height:44px;border-radius:999px;object-fit:cover;"></td>` : "") +
        `<td valign="middle" style="font-size:15px;line-height:1.5;color:${C.body};">${firstName ? `Hi ${esc(firstName)}, ` : ""}<strong style="color:${C.ink};">${esc(name)}</strong> was just added to ${live.length === 1 ? "an event lineup" : `${live.length} event lineups`}.</td></tr></table>`);
      b += section(live.map(card).join(""), "18px 28px 10px");
      b += section(button(`${SITE_URL}resources/${resourceId}`, `See all of ${name}'s appearances`), "0 28px 16px");
      b += section(note(`You're getting this because you follow ${esc(name)} on TapIN. <a href="${SITE_URL}resources/${resourceId}" style="color:${C.indigo};">Unfollow</a> &middot; <a href="${SITE_URL}profile#notifications" style="color:${C.indigo};">Turn off these emails</a>`), "6px 28px 24px");
      html = layout({ preheader: live.length === 1 ? `${when(live[0].start_date)}${live[0].location_name ? " \u00b7 " + tidy(live[0].location_name) : ""}` : `See where to catch ${name} next.`, eyebrow: "Where to catch them next", body: b });
    } else if (kind === "lineup_invite") {
      // An organizer wants to list this resource (or group) on an event lineup, no payment involved.
      const { data: bk } = await admin.from("resource_bookings").select("id, event_id, resource_email, organizer_email, status, kind, message_from_organizer, booking_details").eq("id", String(body.booking_id ?? "")).maybeSingle();
      if (!bk || bk.kind !== "lineup_invite" || bk.status !== "pending") return skip("invite no longer pending");
      const [{ data: ev }, { data: org }] = await Promise.all([
        admin.from("events").select("title, start_date, location_name, is_online, poster_url").eq("id", bk.event_id).maybeSingle(),
        admin.from("profiles").select("full_name").eq("email", bk.organizer_email).maybeSingle(),
      ]);
      const who = tidy(org?.full_name) || "An organizer";
      const eventTitle = tidy(ev?.title) || "an event";
      const role = tidy((bk.booking_details as Record<string, unknown> | null)?.lineup_role);
      const when = ev?.start_date ? new Date(ev.start_date).toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }).replace(":00 ", " ") : "";
      const img = httpsOnly(ev?.poster_url);
      to = bk.resource_email;
      subject = `${plain(who, 50)} wants you on the lineup for ${plain(eventTitle, 70)}`;
      let b = section(badge("Lineup invite") +
        `<div style="margin-top:10px;font-size:22px;line-height:1.25;font-weight:800;color:${C.ink};">${esc(eventTitle)}</div>` +
        `<div style="margin-top:4px;font-size:14px;color:${C.muted};">${esc([when, ev?.is_online ? "Online" : tidy(ev?.location_name)].filter(Boolean).join(" \u00b7 "))}</div>` +
        (img ? `<img src="${esc(img)}" alt="" width="464" style="display:block;width:100%;max-height:220px;object-fit:cover;border-radius:14px;margin-top:14px;">` : ""));
      b += section(para(`<strong>${esc(who)}</strong> would like to list you on this event's lineup${role ? ` as <strong>${esc(role)}</strong>` : ""}. This is a free listing, not a paid booking.`) +
        (bk.message_from_organizer ? `<div style="margin:0 0 12px;padding:12px 14px;border-radius:12px;background:${C.soft};border:1px solid ${C.line};font-size:14px;line-height:1.5;color:${C.body};">\u201c${esc(plain(bk.message_from_organizer, 600))}\u201d</div>` : "") +
        note("If you accept, you'll appear on the event page and in your Upcoming appearances, and your followers may be told. Nothing is public until you accept."), "16px 28px 0");
      b += section(button(SITE_URL + "resources/dashboard", "Accept or decline"), "20px 28px 24px");
      html = layout({ preheader: `${who} wants to list you on the lineup for ${eventTitle}.`, eyebrow: "You're invited to a lineup", body: b, why: "You're receiving this because an organizer on TapIN invited you to their event's lineup." });
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
