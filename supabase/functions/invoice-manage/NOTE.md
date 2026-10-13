invoice-manage (v1): organizer pay-by-invoice (create in Stripe with line items + TapIN fees, finalize, send; resend; void; refresh).
invoice-sync (v1, cron tapin-invoice-sync every 15 min while open invoices exist): paid -> fulfill_invoice (order + tickets to the
billing contact), void/uncollectible -> void. DB: invoices table, fulfill_invoice(), orders.billing, save_order_billing(), order_receipt().
Preview feature 'invoices' (Tickets tab Invoices section, /receipt page, Receipt link on ticket pass).
