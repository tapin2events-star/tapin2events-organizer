geocode-events (deployed v2): every 10 minutes (cron 'tapin-geocode-events', only when events are waiting).
Places events missing latitude/longitude: U.S. Census geocoder for street addresses, then Photon (OSM) by venue name.
Marks geocode_status 'ok' or 'failed' (failed ones are listed in Admin > Imports > "Not on the map").
DB trigger reset_event_geocode clears the point when the address changes, so it's looked up again.
