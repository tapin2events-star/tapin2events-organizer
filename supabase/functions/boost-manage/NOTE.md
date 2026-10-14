boost-manage (v1, JWT): create a Boost checkout (3d $15 / 7d $29 / 14d $49 + processing fee 2.9% + $0.30, paid to TapIN,
metadata {checkout_type:'boost', boost_id} only, so stripe-webhook ignores it), refresh a boost's payment.
boost-sync (v1, cron tapin-boost-sync every 5 min while pending/refund_due): pending -> paid (notify) or cancelled;
refund_due (event cancelled, trigger events_boost_refund) -> Stripe refund of unused days (never the fee) -> refunded.
DB: event_boosts, boost_slots_taken (6 within 80 km), promoted_events(lat,lng), record_boost_impressions, event_boosts_for.
Clicks/sales tracked via the built-in "🚀 Boost (Discover)" event link. Preview feature 'promote'.
