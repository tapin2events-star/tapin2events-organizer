send-system-email (deployed v2): server-only, reached through the email queue for kinds starting with "system_".
- system_test { to }: delivery test; recipient must be support@tapin2events.com.
- system_scout_invite { board_id, email }: invites someone not on TapIN to plan a scouting board (skips if accepted/cancelled).
