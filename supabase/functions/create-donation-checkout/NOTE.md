create-donation-checkout (deployed v1): standalone gift to a nonprofit event. Fees: 3.7% + 2.9% + $0.50 (donation_fee_cents).
Cover the fees (default) adds fees on top; otherwise deducted. $5 minimum (or the event's higher minimum).
Saves a pending donation, Stripe metadata checkout_type "donation" + donation_id; webhook marks paid; trigger on_donation_paid
queues system_donation_receipt and notifies the organizer. Gifts added to ticket orders go through create-tier-checkout (v4)
with fees 3.7% + 2.9% only when the payment includes paid tickets.
