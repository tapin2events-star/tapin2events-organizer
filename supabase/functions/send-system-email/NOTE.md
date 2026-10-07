send-system-email (deployed v1): server-only, reached through the email queue for kinds starting with "system_".
- system_test { to }: short delivery test; recipient must be a TapIN address (support@tapin2events.com).
process-email-outbox (v5) routes system_ -> send-system-email; group_/announce_/receipt_ -> send-group-email; others -> send-app-email.
