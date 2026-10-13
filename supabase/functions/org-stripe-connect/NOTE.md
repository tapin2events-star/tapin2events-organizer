org-stripe-connect (deployed v1): organization payout accounts (Stripe Express) for Owners/Admins: connect (onboarding link),
refresh (save charges/payouts flags), dashboard (login link). DB: organizations.stripe_* (server-only via guard_organization),
event_payout_account(event) -> org account when connected/charges enabled/active, else the event creator's.
Used by create-stripe-checkout v19, create-tier-checkout v7, create-seated-checkout v13, create-series-pass-checkout v9,
create-donation-checkout v4, create-vendor-fee-checkout v7, create-product-checkout v14 (event merch sold by the organizer).
