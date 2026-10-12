refund-donation (deployed v1): organizer/admin refunds all or part of a gift (fees non-refundable). Stripe refund with
reverse_transfer when paid out to the organizer; metadata reason=donation_refunded (the webhook's charge.refunded sync skips
those). record_donation_refund() updates refund_amount/status and notifies the donor. Refunds made directly in Stripe are
synced by stripe-webhook v30 (gift alone: refund applies to it; with tickets: tickets first, then the gift; full refund: both).
