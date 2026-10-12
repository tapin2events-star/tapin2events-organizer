send-announcement (deployed v4): sends due rows from public.announcements (TapIN news) to announcement_recipients()
(not banned, email_notifications and product_updates not off). Straight to Resend from news@tapin2events.com, ~1.5/s,
waits and retries on rate limits, never sends twice (announcement_sends claim), finishes over several runs. Cron
'tapin-send-announcements' every 15 min when something is due. Body is plain text: {first name}; "•" bullets; short
heading lines; the CTA URL line becomes a button; footer adds unsubscribe link, email settings, TapIN address.
Campaigns: business-launch-short (sent Oct 12, 2026 to 82), business-launch-full (scheduled Oct 19, 2026 10:00 ET).
