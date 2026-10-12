create-tier-checkout (deployed v1): Stripe checkout for events with ticket tiers. Validates with validate_tier_selection,
charges paid tiers (free tiers in the same cart come along at $0), fees per paid ticket (3.7% + $1.79, + 2.9% processing),
metadata checkout_type "tiers" -> stripe-webhook "tiers" branch creates the order and one ticket per seat (tickets.tier_id).
