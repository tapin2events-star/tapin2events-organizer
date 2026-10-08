release-seat-hold (v1): buyer backed out of a seated checkout. Closes the Stripe checkout (keeps seats if already paid), then calls release_seat_hold(hold_id).
create-seated-checkout (v10): records each hold in seat_holds and adds ?seat_hold=<id> to the cancel link; checkouts expire after 30 minutes.
DB: release_seats() never frees sold seats or seats in another open hold; release_stale_seat_holds() runs every 10 minutes as a safety net (1 hour after expiry).
