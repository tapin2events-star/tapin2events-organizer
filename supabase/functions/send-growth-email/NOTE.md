send-growth-email (deployed v1): nudge_vendor_profile { application_id } — once, when a vendor application is approved and the
vendor has no resource profile (trigger vendor_applications_profile_nudge; profiles.vendor_profile_prompt null/nudged/dismissed/created).
process-email-outbox v10 routes nudge_* here.
