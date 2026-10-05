import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@14.21.0";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!stripeSecret || !webhookSecret) {
      return new Response("Stripe webhook not configured yet (STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET)", { status: 500 });
    }
    const stripe = new Stripe(stripeSecret);

    const signature = req.headers.get("stripe-signature");
    const rawBody = await req.text();

    let stripeEvent;
    try {
      stripeEvent = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
    } catch (err) {
      return new Response("Signature verification failed: " + String(err), { status: 400 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const admin = createClient(supabaseUrl, serviceKey);

    // All emails are built by send-app-email from the saved records, so they
    // share one design (tickets, merchandise, vendor fees, tips, refunds).
    async function sendAppEmail(kind, payload) {
      try {
        const res = await fetch(supabaseUrl + "/functions/v1/send-app-email", {
          method: "POST",
          headers: { Authorization: "Bearer " + serviceKey, "Content-Type": "application/json" },
          body: JSON.stringify({ kind, ...payload }),
        });
        if (!res.ok) console.error("Email failed:", kind, res.status, await res.text());
      } catch (e) {
        console.error("Email failed:", kind, e);
      }
    }

    // ---- Refunds issued in Stripe (dashboard or API) ----
    // Keeps TapIN in sync when a payment is refunded outside TapIN's own
    // cancel-and-refund flows. Those flows tag their refunds with
    // metadata.reason = "event_cancelled" / "booking_cancelled" and update
    // records themselves, so those are skipped here. A refund covering the full
    // purchase price (fees aside) marks the order refunded and cancels its
    // tickets; a smaller, partial refund is recorded and the ticket stays valid.
    if (stripeEvent.type === "charge.refunded") {
      const charge = stripeEvent.data.object;
      const piId = typeof charge.payment_intent === "string" ? charge.payment_intent : (charge.payment_intent && charge.payment_intent.id);
      const refundedCents = charge.amount_refunded || 0;
      if (piId && refundedCents > 0) {
        let fromTapin = false;
        try {
          const recent = await stripe.refunds.list({ payment_intent: piId, limit: 1 });
          const reason = recent.data[0] && recent.data[0].metadata && recent.data[0].metadata.reason;
          fromTapin = reason === "event_cancelled" || reason === "booking_cancelled";
        } catch (e) {
          console.error("Refund lookup failed:", e);
        }
        if (!fromTapin) {
          const nowIso = new Date().toISOString();
          const dollars = (cents) => "$" + (cents / 100).toFixed(2);

          const { data: order } = await admin.from("orders").select("id, customer_email, subtotal, refund_amount, event_id").eq("payment_intent_id", piId).maybeSingle();
          if (order && refundedCents > Math.round((Number(order.refund_amount) || 0) * 100)) {
            const newCents = refundedCents - Math.round((Number(order.refund_amount) || 0) * 100);
            const covers = refundedCents >= Math.round((Number(order.subtotal) || 0) * 100);
            const update = { refund_amount: refundedCents / 100, refunded_at: nowIso };
            if (covers) update.payment_status = "refunded";
            await admin.from("orders").update(update).eq("id", order.id);
            if (covers) await admin.from("tickets").update({ status: "cancelled" }).eq("order_id", order.id);
            let label = "your order";
            if (order.event_id) {
              const { data: ev } = await admin.from("events").select("title").eq("id", order.event_id).maybeSingle();
              if (ev) label = '"' + ev.title + '"';
            }
            await admin.from("notifications").insert({
              user_email: order.customer_email,
              type: "refund_issued",
              message: "A " + dollars(refundedCents) + " refund for " + label + " was issued to your card." + (covers ? "" : " Your ticket is still valid."),
              link: "/activity",
              related_entity_type: "order",
              related_entity_id: order.id,
            });
            await sendAppEmail("refund_issued", { order_id: order.id, amount_cents: newCents, reason: "refund", partial: !covers });
          }

          const { data: application } = await admin.from("event_vendor_applications").select("id, resource_email, agreed_fee, refund_amount, event_id").eq("payment_intent_id", piId).maybeSingle();
          if (application && refundedCents > Math.round((Number(application.refund_amount) || 0) * 100)) {
            const newCents = refundedCents - Math.round((Number(application.refund_amount) || 0) * 100);
            const covers = refundedCents >= Math.round((Number(application.agreed_fee) || 0) * 100);
            const update = { refund_amount: refundedCents / 100, refunded_at: nowIso };
            if (covers) update.status = "refunded";
            await admin.from("event_vendor_applications").update(update).eq("id", application.id);
            const { data: ev } = await admin.from("events").select("title").eq("id", application.event_id).maybeSingle();
            await admin.from("notifications").insert({
              user_email: application.resource_email,
              type: "refund_issued",
              message: "A " + dollars(refundedCents) + " refund of your vendor fee" + (ev ? ' for "' + ev.title + '"' : "") + " was issued to your card.",
              link: "/vendor-applications",
              related_entity_type: "vendor_application",
              related_entity_id: application.id,
            });
            await sendAppEmail("refund_issued", { application_id: application.id, amount_cents: newCents, reason: "refund", partial: !covers });
          }

          // Resource bookings refunded directly in Stripe
          const { data: booking } = await admin.from("resource_bookings").select("id, organizer_email, final_rate, refund_amount, event_id").eq("payment_intent_id", piId).maybeSingle();
          if (booking && refundedCents > Math.round((Number(booking.refund_amount) || 0) * 100)) {
            const covers = refundedCents >= Math.round((Number(booking.final_rate) || 0) * 100);
            const update = { refund_amount: refundedCents / 100, refunded_at: nowIso };
            if (covers) update.payment_status = "refunded";
            await admin.from("resource_bookings").update(update).eq("id", booking.id);
            await admin.from("notifications").insert({
              user_email: booking.organizer_email,
              type: "refund_issued",
              message: "A " + dollars(refundedCents) + " refund for a resource booking was issued to your card.",
              link: "/organizer/bookings",
              related_entity_type: "resource_booking",
              related_entity_id: booking.id,
            });
          }

          if (charge.refunded) {
            await admin.from("tips").update({ payment_status: "refunded" }).eq("payment_intent_id", piId).eq("payment_status", "paid");
          }
        }
      }
      return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "content-type": "application/json" } });
    }

    // A checkout session that reserved seats but was never completed --
    // release those seats back into the pool rather than leaving them
    // permanently held.
    if (stripeEvent.type === "checkout.session.expired") {
      const session = stripeEvent.data.object;
      const metadata = session.metadata || {};
      if (metadata.checkout_type === "seating" && metadata.event_id && metadata.seats) {
        const seats = JSON.parse(metadata.seats);
        await admin.rpc("release_seats", { p_event_id: metadata.event_id, p_seats: seats });
      }
      // An abandoned tip checkout is marked failed so it never shows as pending.
      if (metadata.checkout_type === "tip" && metadata.tip_id) {
        await admin.from("tips").update({ payment_status: "failed" }).eq("id", metadata.tip_id).eq("payment_status", "pending");
      }
      return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "content-type": "application/json" } });
    }

    if (stripeEvent.type === "checkout.session.completed") {
      const session = stripeEvent.data.object;
      const paymentIntentId = session.payment_intent;
      const metadata = session.metadata || {};

      if (metadata.checkout_type === "tip" && metadata.tip_id) {
        // ---- Tip path ----
        // Only a pending tip flips to paid, so a retried webhook can't
        // count or announce the same tip twice.
        const { data: paidTip } = await admin
          .from("tips")
          .update({ payment_status: "paid", payment_intent_id: paymentIntentId })
          .eq("id", metadata.tip_id)
          .eq("payment_status", "pending")
          .select("id")
          .maybeSingle();
        if (paidTip) await sendAppEmail("tip_received", { tip_id: paidTip.id });
        return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "content-type": "application/json" } });
      }

      if (metadata.checkout_type === "booking" && metadata.booking_id) {
        // ---- Resource booking payment path ----
        // Only an unpaid booking flips to paid, so a retried webhook can't
        // announce the same payment twice. An accepted booking becomes confirmed.
        const { data: current } = await admin.from("resource_bookings").select("id, status, payment_status, organizer_email, resource_email, event_id").eq("id", metadata.booking_id).maybeSingle();
        if (current && current.payment_status !== "paid") {
          const subtotalCents = parseInt(metadata.subtotal_cents || "0", 10);
          const feeCents = parseInt(metadata.platform_fee_cents || "0", 10);
          const { data: paid } = await admin
            .from("resource_bookings")
            .update({
              payment_status: "paid",
              status: current.status === "accepted" ? "confirmed" : current.status,
              payment_intent_id: paymentIntentId,
              platform_fee: feeCents / 100,
              amount_paid: subtotalCents / 100,
              paid_at: new Date().toISOString(),
            })
            .eq("id", current.id)
            .neq("payment_status", "paid")
            .select("id")
            .maybeSingle();
          if (paid) {
            const { data: ev } = await admin.from("events").select("title").eq("id", current.event_id).maybeSingle();
            const amt = "$" + (subtotalCents / 100).toFixed(2);
            const title = ev ? '"' + ev.title + '"' : "an event";
            const { data: full } = await admin.from("resource_bookings").select("group_split, resource_id").eq("id", current.id).maybeSingle();
            const split = Array.isArray(full?.group_split) ? full.group_split : null;
            if (split && split.length) {
              // ---- Group booking: send each member their share ----
              const { data: grp } = await admin.from("resources").select("display_name").eq("id", full.resource_id).maybeSingle();
              let chargeId = null;
              try {
                const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
                chargeId = typeof pi.latest_charge === "string" ? pi.latest_charge : pi.latest_charge && pi.latest_charge.id;
              } catch (e) { console.error("Group payout: couldn't load payment", current.id, e); }
              const updated = [];
              for (const part of split) {
                const entry = { ...part };
                if (!entry.transfer_id && chargeId && entry.cents > 0) {
                  try {
                    const t = await stripe.transfers.create(
                      { amount: entry.cents, currency: "usd", destination: entry.account, source_transaction: chargeId, transfer_group: "booking_" + current.id, metadata: { booking_id: current.id, member: entry.email } },
                      { idempotencyKey: "booking-" + current.id + "-transfer-" + entry.email },
                    );
                    entry.transfer_id = t.id;
                    await admin.from("notifications").insert({ user_email: entry.email, type: "booking_paid", message: "You've been paid your share, $" + (entry.cents / 100).toFixed(2) + ", for " + ((grp && grp.display_name) || "your group") + " at " + title + ". It's on its way to your bank through Stripe.", link: "/groups/" + full.resource_id + "/manage", related_entity_type: "resource_booking", related_entity_id: current.id });
                  } catch (e) {
                    entry.transfer_error = String((e && e.message) || e).slice(0, 200);
                    console.error("Group payout transfer failed", current.id, entry.email, e);
                  }
                }
                updated.push(entry);
              }
              await admin.from("resource_bookings").update({ group_split: updated }).eq("id", current.id);
              await admin.from("notifications").insert({ user_email: current.organizer_email, type: "booking_paid", message: "Payment of " + amt + " sent for your booking at " + title + ". The booking is confirmed.", link: "/organizer/bookings", related_entity_type: "resource_booking", related_entity_id: current.id });
            } else {
              await admin.from("notifications").insert([
                { user_email: current.resource_email, type: "booking_paid", message: "You've been paid " + amt + " for your booking at " + title + ". It's on its way to your bank through Stripe.", link: "/resources/dashboard?tab=bookings", related_entity_type: "resource_booking", related_entity_id: current.id },
                { user_email: current.organizer_email, type: "booking_paid", message: "Payment of " + amt + " sent for your booking at " + title + ". The booking is confirmed.", link: "/organizer/bookings", related_entity_type: "resource_booking", related_entity_id: current.id },
              ]);
            }
          }
        }
        return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "content-type": "application/json" } });
      }

      if (metadata.checkout_type === "vendor_fee") {
        // ---- Vendor fee payment path ----
        // Only an application that isn't already paid flips to paid, so a
        // retried webhook can't send the receipt twice.
        const applicationId = metadata.application_id;
        const { data: paidApp } = await admin
          .from("event_vendor_applications")
          .update({ status: "paid", payment_intent_id: paymentIntentId })
          .eq("id", applicationId)
          .neq("status", "paid")
          .select("id")
          .maybeSingle();
        if (paidApp) await sendAppEmail("vendor_fee_receipt", { application_id: paidApp.id });
        return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "content-type": "application/json" } });
      }

      const { data: existingOrder } = await admin.from("orders").select("id").eq("payment_intent_id", paymentIntentId).maybeSingle();

      if (!existingOrder && metadata.checkout_type === "series_pass") {
        // ---- Series pass path ----
        // One ticket per occurrence, all linked to the same order, so
        // existing per-occurrence check-in and display logic works
        // unchanged -- the only thing distinguishing these is ticket_type.
        const parentEventId = metadata.parent_event_id;
        const occurrenceIds = JSON.parse(metadata.occurrence_ids || "[]");
        const userEmail = metadata.user_email;
        const subtotalCents = parseInt(metadata.subtotal_cents || "0", 10);
        const platformFeeCents = parseInt(metadata.platform_fee_cents || "0", 10);
        const totalAmountCents = session.amount_total || 0;

        const { data: parentEvent } = await admin.from("events").select("title").eq("id", parentEventId).single();
        const { data: occurrences } = await admin.from("events").select("id, start_date").in("id", occurrenceIds);
        const { data: profile } = await admin.from("profiles").select("full_name").eq("email", userEmail).single();

        const { data: order } = await admin
          .from("orders")
          .insert({
            order_number: "TAPIN-" + Date.now(),
            event_id: parentEventId,
            customer_email: userEmail,
            customer_name: (profile && profile.full_name) || userEmail,
            items: [{ type: "ticket", item_id: parentEventId, item_name: (parentEvent ? parentEvent.title : "Event") + " \u2014 Series Pass", quantity: (occurrences || []).length, unit_price: subtotalCents / 100 / ((occurrences || []).length || 1), total_price: subtotalCents / 100 }],
            subtotal: subtotalCents / 100,
            platform_fee: platformFeeCents / 100,
            total_amount: totalAmountCents / 100,
            payment_status: "paid",
            payment_intent_id: paymentIntentId,
          })
          .select()
          .single();

        const ticketRows = (occurrences || []).map((occ) => ({
          event_id: occ.id,
          attendee_email: userEmail,
          order_id: order ? order.id : null,
          ticket_type: "series_pass",
          occurrence_date: occ.start_date ? occ.start_date.split("T")[0] : null,
          price_paid: subtotalCents / 100 / ((occurrences || []).length || 1),
          quantity: 1,
          status: "confirmed",
        }));
        const { data: tickets, error: ticketError } = await admin.from("tickets").insert(ticketRows).select();
        if (ticketError) console.error("Series pass ticket insert failed:", ticketError);

        if (order && tickets && tickets.length > 0) await sendAppEmail("order_confirmation", { order_id: order.id });
        return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "content-type": "application/json" } });
      }

      if (!existingOrder && metadata.checkout_type === "seating") {
        // ---- Seated ticket path ----
        const eventId = metadata.event_id;
        const sectionName = metadata.section_name;
        const seats = JSON.parse(metadata.seats || "[]");
        const userEmail = metadata.user_email;
        const subtotalCents = parseInt(metadata.subtotal_cents || "0", 10);
        const platformFeeCents = parseInt(metadata.platform_fee_cents || "0", 10);
        const totalAmountCents = session.amount_total || 0;
        const bundleProductId = metadata.bundle_product_id || null;

        const { data: ev } = await admin.from("events").select("title").eq("id", eventId).single();
        const { data: profile } = await admin.from("profiles").select("full_name").eq("email", userEmail).single();
        const perSeatPrice = seats.length > 0 ? subtotalCents / 100 / seats.length : 0;

        const orderItems = [{ type: "ticket", item_id: eventId, item_name: (ev ? ev.title : "Ticket") + " \u2014 " + sectionName, quantity: seats.length, unit_price: perSeatPrice, total_price: subtotalCents / 100 }];

        let bundledProduct = null;
        if (bundleProductId) {
          const { data: product } = await admin.from("products").select("*").eq("id", bundleProductId).single();
          if (product) {
            bundledProduct = product;
            orderItems.push({
              type: "product",
              item_id: product.id,
              item_name: product.name,
              quantity: seats.length,
              unit_price: 0,
              total_price: 0,
              image_url: product.images && product.images[0] ? product.images[0] : null,
            });
          }
        }

        const { data: order } = await admin
          .from("orders")
          .insert({
            order_number: "TAPIN-" + Date.now(),
            event_id: eventId,
            customer_email: userEmail,
            customer_name: (profile && profile.full_name) || userEmail,
            items: orderItems,
            subtotal: subtotalCents / 100,
            platform_fee: platformFeeCents / 100,
            total_amount: totalAmountCents / 100,
            payment_status: "paid",
            payment_intent_id: paymentIntentId,
            fulfillment_status: bundledProduct ? "pending" : null,
          })
          .select()
          .single();

        if (bundledProduct) {
          await admin.from("products").update({ sold_quantity: bundledProduct.sold_quantity + seats.length }).eq("id", bundledProduct.id);
        }

        const ticketRows = seats.map((seatLabel) => ({
          event_id: eventId,
          attendee_email: userEmail,
          order_id: order ? order.id : null,
          ticket_type: "seated",
          section_name: sectionName,
          seat_assignment: seatLabel,
          price_paid: perSeatPrice,
          quantity: 1,
          status: "confirmed",
        }));
        const { data: tickets, error: ticketError } = await admin.from("tickets").insert(ticketRows).select();
        if (ticketError) console.error("Seated ticket insert failed:", ticketError);

        if (order && tickets && tickets.length > 0) await sendAppEmail("order_confirmation", { order_id: order.id });
        return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "content-type": "application/json" } });
      }

      if (!existingOrder && metadata.checkout_type === "product") {
        const productId = metadata.product_id;
        const variantId = metadata.variant_id || null;
        const variantLabel = metadata.variant_label || "";
        const quantity = parseInt(metadata.quantity || "1", 10);
        const fulfillmentMethod = metadata.fulfillment_method;
        const shippingAddress = metadata.shipping_address ? JSON.parse(metadata.shipping_address) : null;
        const buyerEmail = metadata.buyer_email;
        const subtotalCents = parseInt(metadata.subtotal_cents || "0", 10);
        const platformFeeCents = parseInt(metadata.platform_fee_cents || "0", 10);
        const totalAmountCents = session.amount_total || 0;

        const { data: product } = await admin.from("products").select("*").eq("id", productId).single();
        if (product && buyerEmail) {
          const { data: buyerProfile } = await admin.from("profiles").select("full_name").eq("email", buyerEmail).single();
          const itemName = variantLabel ? product.name + " (" + variantLabel + ")" : product.name;
          const shippingCents = fulfillmentMethod === "shipping" ? Math.round((product.shipping_cost || 0) * 100) : 0;
          const itemsCents = subtotalCents - shippingCents;

          const orderPayload = {
            order_number: "TAPIN-" + Date.now(),
            customer_email: buyerEmail,
            customer_name: (buyerProfile && buyerProfile.full_name) || buyerEmail,
            items: [{
              type: "product",
              item_id: productId,
              variant_id: variantId,
              variant_label: variantLabel || null,
              item_name: itemName,
              quantity,
              unit_price: itemsCents / 100 / quantity,
              total_price: itemsCents / 100,
              image_url: product.images && product.images[0] ? product.images[0] : null,
            }],
            subtotal: subtotalCents / 100,
            platform_fee: platformFeeCents / 100,
            total_amount: totalAmountCents / 100,
            payment_status: "paid",
            payment_intent_id: paymentIntentId,
            fulfillment_status: "pending",
            pickup_instructions: fulfillmentMethod === "pickup" ? "Pickup arranged directly with the seller." : null,
            shipping_address: shippingAddress,
            event_id: product.event_id,
            resource_id: product.resource_id,
          };

          const { data: newOrder } = await admin.from("orders").insert(orderPayload).select("id").single();
          // Variant stock was already atomically reserved (and decremented)
          // at checkout creation time -- only decrement the product-level
          // count here for products that have no variants, to avoid
          // double-counting the same sale twice.
          if (!variantId) {
            await admin.from("products").update({ sold_quantity: product.sold_quantity + quantity }).eq("id", productId);
          }
          if (newOrder) await sendAppEmail("product_order_confirmation", { order_id: newOrder.id });
        }
        return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "content-type": "application/json" } });
      }

      const eventId = metadata.event_id;
      const userEmail = metadata.user_email;
      const ticketPriceCents = parseInt(metadata.ticket_price_cents || "0", 10);
      const platformFeeCents = parseInt(metadata.platform_fee_cents || "0", 10);
      const totalAmountCents = session.amount_total || 0;

      if (!existingOrder && eventId && userEmail) {
        const { data: ev } = await admin.from("events").select("title").eq("id", eventId).single();
        const { data: profile } = await admin.from("profiles").select("full_name").eq("email", userEmail).single();

        const ticketPrice = ticketPriceCents / 100;
        const platformFee = platformFeeCents / 100;
        const totalAmount = totalAmountCents / 100;

        const { data: order } = await admin
          .from("orders")
          .insert({
            order_number: "TAPIN-" + Date.now(),
            event_id: eventId,
            customer_email: userEmail,
            customer_name: (profile && profile.full_name) || userEmail,
            items: [{ type: "ticket", item_id: eventId, item_name: ev ? ev.title : "Ticket", quantity: 1, unit_price: ticketPrice, total_price: ticketPrice }],
            subtotal: ticketPrice,
            platform_fee: platformFee,
            total_amount: totalAmount,
            payment_status: "paid",
            payment_intent_id: paymentIntentId,
          })
          .select()
          .single();

        const { data: ticket } = await admin
          .from("tickets")
          .insert({
            event_id: eventId,
            attendee_email: userEmail,
            order_id: order ? order.id : null,
            ticket_type: "general",
            price_paid: ticketPrice,
            quantity: 1,
            status: "confirmed",
          })
          .select()
          .single();

        if (order && ticket) await sendAppEmail("order_confirmation", { order_id: order.id });
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "content-type": "application/json" } });
  }
});
