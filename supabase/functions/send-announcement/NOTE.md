send-announcement (restored Oct 30, 2026 as v20; full source in index.ts here): sends due rows from public.announcements
(TapIN news) to announcement_recipients() (not banned, email_notifications and product_updates not off). Audiences: all,
resources, organizers, creators, everyone_else (everyone who isn't an artist or group member). Straight to Resend from
news@tapin2events.com, ~1.5/s, waits and retries on rate limits, never sends twice (announcement_sends claim), finishes
over several runs. Cron 'tapin-send-announcements' every 15 min. Both channels (broadcast, direct) send one email per
person. test_only rows go only to tapin2events@gmail.com and theflowessence@gmail.com. Body is plain text: {first name};
"•" bullets; short heading lines; the CTA URL line becomes a button; footer adds unsubscribe link, email settings,
TapIN address.
NEVER deploy a different function under this name: the cron calls it every 15 minutes.
Campaigns: business-launch-short (Oct 12), resources-update-oct-2026 (Oct 13), business-launch-full (Oct 19),
organizers-update-oct-2026 (Oct 22), music-launch-artists / music-launch-everyone (Oct 30, 2026).
