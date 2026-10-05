import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@14.21.0";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Cancel a booking that was paid through TapIN and refund the organizer.
// Same policy as events: the booking price comes back, service/processing fees are kept.
// The money comes out of the resource's payout: that transfer is reversed by exactly
// the booking price first, then the organizer is refunded. If the reversal fails
// (e.g. the resource's Stripe balance is too low), nothing is refunded and we say so.
// Idempotency keys make retries safe.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const dollars = (c: number) => "$" + (c / 100).toFixed(2);

function friendlyError(e: any): string {
  const code = e?.code || e?.raw?.code;
  if (code === "balance_insufficient" || /insufficient/i.test(String(e?.message))) return "The resource's Stripe balance doesn't cover this refund yet. Try again later, or contact TapIN support.";
  if (code === "charge_already_refunded") return "This payment was already refunded in Stripe.";
  return "Stripe couldn't process this refund right now. Try again shortly.";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "content-type": "application/json" } });
  try {
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecret) return respond({ error: "Payments aren't configured." }, 500);
    const stripe = new Stripe(stripeSecret);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user?.email) return respond({ error: "Please sign in." }, 401);
    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const bookingId = String(body.booking_id ?? "");
    const reason = String(body.reason ?? "").slice(0, 300) || null;

    const { data: booking } = await admin.from("resource_bookings").select("*").eq("id", bookingId).maybeSingle();
    if (!booking) return respond({ error: "Booking not found." }, 404);
    const { data: me } = await admin.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
    if (booking.organizer_email !== user.email && !me?.is_admin) return respond({ error: "Only the organizer who made this booking can cancel it." }, 403);
    if (booking.status === "cancelled" && booking.payment_status === "refunded") return respond({ ok: true, already: true });
    if (booking.payment_status !== "paid" || !booking.payment_intent_id) return respond({ error: "This booking wasn't paid through TapIN." }, 409);
    if (booking.status === "completed") return respond({ error: "This booking is already marked completed. Contact TapIN support if you need a refund." }, 409);

    const cents = Math.round(Number(booking.amount_paid ?? booking.final_rate ?? booking.offered_rate ?? 0) * 100);
    if (!(cents > 0)) return respond({ error: "Nothing to refund on this booking." }, 409);

    const meta = { reason: "booking_cancelled", booking_id: booking.id };
    const split = Array.isArray(booking.group_split) ? booking.group_split as any[] : null;
    if (split && split.length) {
      // Group booking: take each member's share back, then refund the organizer.
      const updated: any[] = [];
      try {
        for (const part of split) {
          const entry = { ...part };
          if (entry.transfer_id && !entry.reversal_id) {
            const rev = await stripe.transfers.createReversal(entry.transfer_id, { amount: entry.cents, metadata: meta }, { idempotencyKey: `cancel-booking-${booking.id}-reversal-${entry.email}` });
            entry.reversal_id = rev.id;
          }
          updated.push(entry);
        }
        await admin.from("resource_bookings").update({ group_split: updated }).eq("id", booking.id);
        const refund = await stripe.refunds.create({ payment_intent: booking.payment_intent_id, amount: cents, metadata: meta }, { idempotencyKey: `cancel-booking-${booking.id}-refund` });
        await admin.from("resource_bookings").update({
          status: "cancelled", payment_status: "refunded", cancellation_reason: reason ?? "Cancelled by the organizer.",
          refund_amount: cents / 100, refunded_at: new Date().toISOString(), refund_id: refund.id,
        }).eq("id", booking.id);
      } catch (e) {
        if (updated.length) await admin.from("resource_bookings").update({ group_split: [...updated, ...split.slice(updated.length)] }).eq("id", booking.id);
        console.error("[cancel-booking] group refund failed", booking.id, e);
        return respond({ error: friendlyError(e).replace("The resource's", "A member's") }, 409);
      }
      const { data: ev } = await admin.from("events").select("title").eq("id", booking.event_id).maybeSingle();
      const title = ev?.title ? `"${ev.title}"` : "your event";
      await admin.from("notifications").insert([
        { user_email: booking.organizer_email, type: "refund_issued", message: `Your ${dollars(cents)} booking payment for ${title} is being refunded. Service fees aren't refundable.`, link: "/organizer/bookings", related_entity_type: "resource_booking", related_entity_id: booking.id },
        ...split.map((p: any) => ({ user_email: p.email, type: "booking_cancelled", message: `A paid group booking for ${title} was cancelled and your ${dollars(p.cents)} share was returned to the organizer.${reason ? " Reason: " + reason : ""}`, link: "/groups", related_entity_type: "resource_booking", related_entity_id: booking.id })),
      ]);
      return respond({ ok: true, refunded_cents: cents });
    }

    const pi: any = await stripe.paymentIntents.retrieve(booking.payment_intent_id, { expand: ["latest_charge"] });
    const charge: any = pi.latest_charge;
    const transferId = typeof charge?.transfer === "string" ? charge.transfer : charge?.transfer?.id;
    if (!charge || charge.status !== "succeeded" || !transferId) return respond({ error: "This payment can't be refunded automatically. Contact TapIN support." }, 409);

    let reversalId = booking.transfer_reversal_id;
    try {
      if (!reversalId) {
        const rev = await stripe.transfers.createReversal(transferId, { amount: cents, metadata: meta }, { idempotencyKey: `cancel-booking-${booking.id}-reversal` });
        reversalId = rev.id;
        await admin.from("resource_bookings").update({ transfer_reversal_id: reversalId }).eq("id", booking.id);
      }
      const refund = await stripe.refunds.create({ payment_intent: booking.payment_intent_id, amount: cents, metadata: meta }, { idempotencyKey: `cancel-booking-${booking.id}-refund` });
      await admin.from("resource_bookings").update({
        status: "cancelled",
        payment_status: "refunded",
        cancellation_reason: reason ?? "Cancelled by the organizer.",
        refund_amount: cents / 100,
        refunded_at: new Date().toISOString(),
        refund_id: refund.id,
      }).eq("id", booking.id);
    } catch (e) {
      console.error("[cancel-booking] refund failed", booking.id, e);
      return respond({ error: friendlyError(e) }, 409);
    }

    const { data: ev } = await admin.from("events").select("title").eq("id", booking.event_id).maybeSingle();
    const title = ev?.title ? `"${ev.title}"` : "your event";
    await admin.from("notifications").insert([
      { user_email: booking.organizer_email, type: "refund_issued", message: `Your ${dollars(cents)} booking payment for ${title} is being refunded. Service fees aren't refundable.`, link: "/organizer/bookings", related_entity_type: "resource_booking", related_entity_id: booking.id },
      { user_email: booking.resource_email, type: "booking_cancelled", message: `A paid booking for ${title} was cancelled and ${dollars(cents)} was returned to the organizer.${reason ? " Reason: " + reason : ""}`, link: "/resources/dashboard", related_entity_type: "resource_booking", related_entity_id: booking.id },
    ]);
    return respond({ ok: true, refunded_cents: cents });
  } catch (e) {
    console.error("[cancel-booking] error", e);
    return respond({ error: "Something went wrong. Please try again." }, 500);
  }
});
