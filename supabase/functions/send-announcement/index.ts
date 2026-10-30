import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// TapIN news (restored v4 behavior): sends due rows from public.announcements (sent_at null, scheduled_at <= now) to
// announcement_recipients(id) (not banned; email notifications and product updates not off; audience: all, resources,
// organizers, creators, everyone_else). Straight to Resend from news@tapin2events.com, ~1.5/s, waits and retries on
// rate limits, never sends twice (announcement_sends claim), finishes over several runs (cron every 15 min).
// Both channels ("broadcast", "direct") are sent directly, one email per person.
// test_only rows go only to TapIN's test inboxes. Body is plain text: {first name}; "\u2022" bullets; short heading
// lines; the CTA URL line becomes a button; footer adds an unsubscribe link, email settings and TapIN's address.
const SITE = "https://app.tapin2events.com/";
const TEST_INBOXES = ["tapin2events@gmail.com", "theflowessence@gmail.com"];
const esc = (t: unknown) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function hmac(key: string, msg: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg)));
  return [...sig].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

function render(body: string, first: string, cta: { label: string | null; url: string | null }, unsubUrl: string) {
  const lines = body.replace(/\{first name\}/gi, first || "there").split(/\r?\n/);
  let html = "", list: string[] = [];
  const flush = () => { if (list.length) { html += `<ul style="margin:8px 0 0;padding-left:20px;font-size:15px;line-height:1.6;color:#374151;">${list.map((l) => `<li style="margin:3px 0;">${l}</li>`).join("")}</ul>`; list = []; } };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    if (/^[\u2022\-*]\s+/.test(line)) { list.push(esc(line.replace(/^[\u2022\-*]\s+/, ""))); continue; }
    flush();
    const isUrl = /^https?:\/\/\S+$/.test(line);
    if (isUrl && (!cta.url || line === cta.url)) {
      html += `<div style="margin-top:20px;"><a href="${esc(line)}" style="display:inline-block;padding:14px 24px;border-radius:999px;background:#0F1B3D;color:#fff;font-size:16px;font-weight:700;text-decoration:none;">${esc(cta.label || "Open TapIN")}</a></div>`;
      continue;
    }
    if (isUrl) { html += `<p style="margin:12px 0 0;font-size:15px;"><a href="${esc(line)}" style="color:#4F46E5;">${esc(line)}</a></p>`; continue; }
    // Short lines without ending punctuation read as headings.
    if (line.length <= 60 && !/[.,:;!?)]$/.test(line) && !/^(hi|hello|hey)\b/i.test(line)) { html += `<p style="margin:18px 0 0;font-size:16px;font-weight:800;color:#111827;">${esc(line)}</p>`; continue; }
    html += `<p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#374151;">${esc(line)}</p>`;
  }
  flush();
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#F4F4F7;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #E5E7EB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">` +
    `<tr><td style="background:#4F46E5;background-image:linear-gradient(135deg,#4F46E5,#7C3AED,#14B8A6);padding:22px 28px;"><div style="font-size:22px;font-weight:800;color:#fff;">TapIN</div><div style="margin-top:6px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.12em;color:#fff;opacity:0.92;">TapIN news</div></td></tr>` +
    `<tr><td style="padding:14px 28px 28px;">${html}</td></tr>` +
    `<tr><td style="padding:16px 28px 22px;border-top:1px solid #E5E7EB;background:#F9FAFB;font-size:12px;line-height:1.6;color:#6B7280;">You're receiving TapIN news because you have a TapIN account.<br><a href="${unsubUrl}" style="color:#6B7280;">Unsubscribe from TapIN news</a> &middot; <a href="${SITE}profile#notifications" style="color:#6B7280;">Email settings</a><br>TapIN LLC &middot; Rolesville, North Carolina</td></tr></table></td></tr></table></body></html>`;
}

Deno.serve(async () => {
  const respond = (b: unknown) => new Response(JSON.stringify(b), { headers: { "content-type": "application/json" } });
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return respond({ error: "no resend key" });
  const admin = createClient(supabaseUrl, serviceKey);
  const started = Date.now();
  const report: Record<string, { sent: number; failed: number; done: boolean }> = {};
  const { data: due } = await admin.from("announcements").select("*").is("sent_at", null).lte("scheduled_at", new Date().toISOString()).order("scheduled_at");
  for (const a of due ?? []) {
    const r = (report[a.id] = { sent: 0, failed: 0, done: false });
    let recipients: { email: string; first_name: string }[];
    if (a.test_only) {
      const { data: sent } = await admin.from("announcement_sends").select("email").eq("announcement_id", a.id);
      const had = new Set((sent ?? []).map((s) => s.email));
      const { data: names } = await admin.from("profiles").select("email, full_name").in("email", TEST_INBOXES);
      recipients = TEST_INBOXES.filter((e) => !had.has(e)).map((e) => ({ email: e, first_name: String((names ?? []).find((n) => n.email === e)?.full_name ?? "").trim().split(/\s+/)[0] }));
    } else {
      const { data } = await admin.rpc("announcement_recipients", { p_announcement_id: a.id });
      recipients = (data ?? []) as { email: string; first_name: string }[];
    }
    for (const p of recipients) {
      if (Date.now() - started > 120_000) break; // finish on the next run
      // Claim first, so nobody is ever sent twice.
      const { error: claimErr } = await admin.from("announcement_sends").insert({ announcement_id: a.id, email: p.email, sent_at: new Date().toISOString() });
      if (claimErr) continue;
      const token = await hmac(serviceKey, `unsubscribe:${p.email}`);
      const unsub = `${supabaseUrl}/functions/v1/unsubscribe?e=${encodeURIComponent(p.email)}&t=${token}`;
      const payload = { from: "TapIN <news@tapin2events.com>", to: [p.email], reply_to: "support@tapin2events.com", subject: a.subject,
        html: render(a.body, p.first_name, { label: a.cta_label, url: a.cta_url }, unsub),
        headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } };
      let ok = false, err = "";
      for (let attempt = 0; attempt < 4 && !ok; attempt++) {
        const res = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) }).catch((e) => { err = String(e); return null; });
        if (res?.ok) ok = true;
        else if (res?.status === 429) { await sleep(1500 * (attempt + 1)); }
        else { err = res ? `${res.status} ${(await res.text()).slice(0, 200)}` : err; break; }
      }
      await admin.from("announcement_sends").update({ ok, error: ok ? null : err }).eq("announcement_id", a.id).eq("email", p.email);
      ok ? r.sent++ : r.failed++;
      await sleep(650); // ~1.5 per second
    }
    const left = a.test_only ? recipients.length - r.sent - r.failed : ((await admin.rpc("announcement_recipients", { p_announcement_id: a.id })).data ?? []).length;
    if (left === 0) { await admin.from("announcements").update({ sent_at: new Date().toISOString() }).eq("id", a.id); r.done = true; }
    if (Date.now() - started > 120_000) break;
  }
  return respond(report);
});
