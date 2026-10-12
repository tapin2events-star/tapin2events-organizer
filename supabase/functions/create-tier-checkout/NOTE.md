create-tier-checkout (deployed v2): reserve_tier_order (locks tiers, validates, applies promo code, holds tickets 30 min) -> Stripe checkout
at discounted prices; fees per paid ticket (3.7% + $1.79, + 2.9%) on the discounted subtotal. Metadata: checkout_type "tiers", tiers
[[tier_id, qty, unit_cents_after_discount]], hold_group, promo_code. Webhook "tiers" branch creates order + one ticket per seat; the
tickets_mark_tier_hold_paid trigger turns the hold into "paid". Abandoned holds expire. Free / fully discounted carts use register_tiers.
