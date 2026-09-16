# Family-and-friends guest booking

Public booking uses a server-signed, per-request capability, not a ChatGPT account. The private URL carries the capability in its fragment; API calls carry it in `X-Booking-Access`. Booking IDs alone grant no access. Guest capabilities never authorize operator decisions. Existing ChatGPT-owned records remain accessible using their original identity.

Production requires secret `GUEST_LINK_SECRET`, secret `RESEND_API_KEY`, `NOTIFICATION_EMAIL=mlw903@gmail.com`, and `CUSTOMER_EMAIL_ENABLED=true`. Keep secrets in Sites environment settings, never Git. Rotating the guest secret invalidates existing private links. Issued draft capabilities expire in 60 days; emailed management links expire 30 days after the selected appointment time. Do not share these links.

Guest issuance and writes are rate-limited in D1 using hashed source-IP buckets; new bookings are additionally capped at five per IP per hour and three per email per day. This is a bounded review pilot, not a production-grade anti-abuse system. No payment is taken and no real service is scheduled.

Customer acknowledgment, confirmation/decline, reschedule, and cancellation messages are sent from appointments@512notary.com with replies directed to mlw903@gmail.com. Operator alerts still go directly to Gmail; admin@ forwarding has not been validated. Outbox retries use provider idempotency and stop after 23 hours. Provider acceptance is not proof of inbox delivery. Automated reminders remain disabled.

Run `npm test` for booking isolation, link integrity, rate limits, operator authorization, lifecycle transitions, and email-outbox tests. Older README implementation notes describe earlier stages and are not current launch status.
