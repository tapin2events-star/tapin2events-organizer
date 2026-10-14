org-newsletter (v2, verify_jwt false): test / send (Owners/Admins via user JWT) and process (cron tapin-org-newsletters every
15 min while direct sends are queued). Modes via app_settings.org_newsletter_mode: broadcast (Resend Broadcasts, one segment
per org stored in app_settings resend_segment_org_<id>, needs RESEND_FULL_API_KEY) or direct (one-to-one, daily cap
org_newsletter_direct_daily_cap). org-unsubscribe (v1): per-organization unsubscribe (signed one-click or confirm page).
DB: org_contacts, org_unsubscribes, org_campaigns, org_campaign_sends, org_resend_contacts; org_audience(_counts/_base),
import_org_contacts, save_org_campaign, org_campaign_recipients, org_campaigns_list, newsletter_admin_status, set_newsletter_mode.
Preview feature 'newsletters' (OrgManage Newsletter tab; Admin > Usage Newsletters panel).
