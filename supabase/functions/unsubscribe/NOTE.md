unsubscribe (deployed v1): GET ?e=<email>&t=<hmac token> turns off profiles.notification_preferences.product_updates.
Token = HMAC-SHA256(service key, "unsubscribe:"+email) first 32 hex chars. Also sent as a List-Unsubscribe header.
