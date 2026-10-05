import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@14.21.0";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Organizer pays an accepted resource booking through TapIN.
// Same fees as tickets (3.7% + $1.79 service, 2.9% processing), paid by the organizer on top.
// The booking price goes straight to the resource's connected Stripe account; TapIN keeps the fees.
// Requires the resource to have payouts connected, so TapIN never ends up holding their money.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "content-type": "application/json" } });

  try {
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecret) return respond({ error: "Payments aren't configured." }, 500);
    const stripe = new Stripe(stripeSecret);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const userEmail = userData?.user?.email;
    if (!userEmail) return respond({ error: "Please sign in." }, 401);
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { booking_id, successUrl, cancelUrl } = await req.json().catch(() => ({}));
    if (!booking_id || !successUrl || !cancelUrl) return respond({ error: "Missing booking details." }, 400);

    const { data: me } = await admin.from("profiles").select("is_banned").eq("email", userEmail).maybeSingle();
    if (me?.is_banned) return respond({ error: "Your account is currently restricted from making payments." }, 403);

    const { data: booking } = await admin.from("resource_bookings").select("*").eq("id", booking_id).maybeSingle();
    if (!booking) return respond({ error: "Booking not found." }, 404);
    if (booking.organizer_email !== userEmail) return respond({ error: "Only the organizer who made this booking can pay for it." }, 403);
    if (booking.payment_status === "paid") return respond({ error: "This booking is already paid." }, 409);
    // Completed-but-unpaid is allowed so a resource marking the job done doesn't block payment
    // (bookings brought over from the old app are excluded; those were settled there).
    const payable = ["accepted", "confirmed"].includes(booking.status) || (booking.status === "completed" && !booking.legacy_id);
    if (!payable) return respond({ error: "This booking isn't ready for payment. It needs to be accepted first." }, 409);
    if (["captured", "paid_out", "refunded"].includes(booking.payment_status)) return respond({ error: "This booking has already been settled." }, 409);
    // The agreed price: the final counter-offer if there was one, otherwise the accepted offer.
    const rate = Number(booking.final_rate ?? booking.offered_rate ?? 0);
    if (!(rate > 0)) return respond({ error: "There's no agreed rate to pay on this booking." }, 409);

    const { data: event } = await admin.from("events").select("id, title, poster_url, status").eq("id", booking.event_id).maybeSingle();
    if (event?.status === "cancelled") return respond({ error: "This event was cancelled." }, 409);
    const { data: resource } = await admin.from("resources").select("display_name, profile_image, kind").eq("id", booking.resource_id).maybeSingle();
    const isGroup = resource?.kind === "group";
    const rateCentsEarly = Math.round(rate * 100);

    // ---- Groups: the price is split among members by their shares ----
    let groupSplit: { email: string; account: string; cents: number }[] | null = null;
    if (isGroup) {
      const { data: members } = await admin.from("group_members").select("user_email, share_pct").eq("group_id", booking.resource_id).eq("status", "active");
      const list = members ?? [];
      const explicitTotal = list.reduce((n, m) => n + Number(m.share_pct ?? 0), 0);
      const explicit = list.some((m) => m.share_pct !== null) && Math.round(explicitTotal * 100) === 10000;
      const pctOf = (m: { share_pct: number | null }) => (explicit ? Number(m.share_pct ?? 0) : 100 / Math.max(list.length, 1));
      const payees = list.filter((m) => pctOf(m) > 0);
      const { data: people } = payees.length
        ? await admin.from("profiles").select("email, full_name, stripe_account_id, stripe_charges_enabled").in("email", payees.map((m) => m.user_email))
        : { data: [] as { email: string; full_name: string | null; stripe_account_id: string | null; stripe_charges_enabled: boolean | null }[] };
      const byEmail = new Map((people ?? []).map((p) => [p.email, p]));
      const notReady = payees.filter((m) => { const p = byEmail.get(m.user_email); return !p?.stripe_account_id || !p?.stripe_charges_enabled; });
      if (payees.length === 0 || notReady.length > 0) {
        const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
        for (const m of notReady) {
          const { data: recent } = await admin.from("notifications").select("id").eq("user_email", m.user_email).eq("type", "payouts_needed").eq("related_entity_id", booking.id).gte("created_at", since).limit(1);
          if (!recent?.length) {
            await admin.from("notifications").insert({
              user_email: m.user_email, type: "payouts_needed",
              message: `An organizer is ready to pay ${resource?.display_name ?? "your group"}${event ? ' for "' + event.title + '"' : ""}. Connect payouts in your Profile so you can receive your share.`,
              link: "/profile#payouts", related_entity_type: "resource_booking", related_entity_id: booking.id,
            });
          }
        }
        const n = notReady.length;
        return respond({ error: n > 0
          ? `${n} member${n === 1 ? " of" : "s of"} ${resource?.display_name ?? "this group"} ${n === 1 ? "hasn't" : "haven't"} connected payouts yet, so the group can't be paid through TapIN. We've let them know.`
          : `${resource?.display_name ?? "This group"} hasn't set up how payments are shared yet.`, code: "payee_not_connected" }, 409);
      }
      // Split to the cent; any leftover cent goes to the largest share.
      const parts = payees.map((m) => ({ email: m.user_email, account: byEmail.get(m.user_email)!.stripe_account_id!, cents: Math.floor(rateCentsEarly * pctOf(m) / 100), pct: pctOf(m) }));
      const leftover = rateCentsEarly - parts.reduce((n, p) => n + p.cents, 0);
      parts.sort((a, b) => b.pct - a.pct);
      if (parts.length) parts[0].cents += leftover;
      groupSplit = parts.filter((p) => p.cents > 0).map(({ email, account, cents }) => ({ email, account, cents }));
      // Lock who gets what for this payment.
      await admin.from("resource_bookings").update({ group_split: groupSplit }).eq("id", booking.id);
    }

    const { data: payee } = isGroup ? { data: { stripe_account_id: "group", stripe_charges_enabled: true } } : await admin.from("profiles").select("stripe_account_id, stripe_charges_enabled")
      .eq("email", booking.resource_email).maybeSingle();
    if (!payee?.stripe_account_id || !payee?.stripe_charges_enabled) {
      // Nudge the resource to connect payouts (at most once a day per booking).
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { data: recent } = await admin.from("notifications").select("id")
        .eq("user_email", booking.resource_email).eq("type", "payouts_needed").eq("related_entity_id", booking.id)
        .gte("created_at", since).limit(1);
      if (!recent?.length) {
        await admin.from("notifications").insert({
          user_email: booking.resource_email, type: "payouts_needed",
          message: `An organizer is ready to pay you for a booking${event ? ' for "' + event.title + '"' : ""}. Connect payouts in your Profile so you can get paid.`,
          link: "/profile#payouts", related_entity_type: "resource_booking", related_entity_id: booking.id,
        });
      }
      return respond({ error: `${resource?.display_name ?? "This resource"} hasn't connected payouts yet, so they can't be paid through TapIN. We've let them know.`, code: "payee_not_connected" }, 409);
    }

    const rateCents = Math.round(rate * 100);
    const serviceFeeCents = Math.round(rateCents * 0.037) + 179;
    const processingFeeCents = Math.round(rateCents * 0.029);
    const totalFeeCents = serviceFeeCents + processingFeeCents;
    const name = `${resource?.display_name ?? "Booking"}${event ? " \u2014 " + event.title : ""}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: userEmail,
      line_items: [
        { price_data: { currency: "usd", product_data: { name: `Booking: ${name}`, images: resource?.profile_image ? [resource.profile_image] : [] }, unit_amount: rateCents }, quantity: 1 },
        { price_data: { currency: "usd", product_data: { name: "Service Fee" }, unit_amount: serviceFeeCents }, quantity: 1 },
        { price_data: { currency: "usd", product_data: { name: "Payment Processing Fee" }, unit_amount: processingFeeCents }, quantity: 1 },
      ],
      custom_text: { submit: { message: "Service and processing fees are non-refundable. If the booking is cancelled, the booking price is refunded. Refund policy: app.tapin2events.com/refund-policy" } },
      // Individuals: the price goes straight to their account (TapIN keeps the fee).
      // Groups: TapIN receives the payment and transfers each member's share once it's paid.
      payment_intent_data: isGroup
        ? { transfer_group: `booking_${booking_id}`, metadata: { checkout_type: "booking", booking_id, group: "1" } }
        : { application_fee_amount: totalFeeCents, transfer_data: { destination: payee.stripe_account_id }, metadata: { checkout_type: "booking", booking_id } },
      metadata: { checkout_type: "booking", booking_id, subtotal_cents: String(rateCents), platform_fee_cents: String(totalFeeCents) },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
    return respond({ url: session.url });
  } catch (e) {
    console.error("[booking-checkout]", e);
    return respond({ error: "Couldn't start checkout. Please try again." }, 500);
  }
});
