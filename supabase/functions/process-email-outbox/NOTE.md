process-email-outbox (deployed v2) routes queued emails whose kind starts with "group_" to send-group-email; all other kinds go to send-app-email.
