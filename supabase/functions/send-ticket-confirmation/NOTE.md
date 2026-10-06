send-ticket-confirmation (deployed v22):
- Rewrites any link to the old site (tapin2events-star.github.io/tapin2events-organizer/) to https://app.tapin2events.com/ in every outgoing email.
- Emails addressed to a group's internal address (group-<id>@groups.tapin2events.com) go to the group's owner and admins individually, with "[Group name]" in the subject and resource-dashboard links pointed at /groups/<id>/manage.
