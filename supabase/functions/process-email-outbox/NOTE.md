process-email-outbox (deployed v4) routes queued emails whose kind starts with "group_", "announce_" or "receipt_" to send-group-email; all other kinds go to send-app-email.
