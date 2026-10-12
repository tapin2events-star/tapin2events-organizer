send-system-email (deployed v3): server-only, reached through the email queue for kinds starting with "system_".
- system_test { to }: delivery test; recipient must be support@tapin2events.com.
- system_scout_invite { board_id, email }: invites someone not on TapIN to plan a scouting board.
- system_sale_notice { notice_id }: sale/registration notice for the organizer + event admins (in-app notification always,
  email unless Profile > Notifs > "Ticket sales" is off). First sale and sold-out get their own headline.
  Notices come from the tickets_sale_notice trigger, which groups one buyer's tickets within a few minutes (sale_notices table)
  and skips test events and listed-from-elsewhere events.
