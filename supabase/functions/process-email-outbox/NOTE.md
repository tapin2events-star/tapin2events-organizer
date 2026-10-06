process-email-outbox (deployed v3) routes queued emails whose kind starts with "group_" or "announce_" to send-group-email; all other kinds go to send-app-email.
