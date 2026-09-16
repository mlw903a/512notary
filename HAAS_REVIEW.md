# Haas family review — reversible shared pilot

This is a temporary rebrand, NOT an independent duplicate. Both custom domains
serve the same application, records, admin permissions, and calendar. Haas areas
are Bastrop 78602, Elgin 78621, and Manor 78653, all on Haydn's shared calendar.
The pre-Haas source is preserved at branch `restore/512-before-haas`, commit
`eb0eab687089694aa5163c0aa377619f0bf9986c` (published version 13).

## Switch back safely

Set the Sites runtime variable `PILOT_BRAND` to `512`, then redeploy the newest
saved version. Do NOT roll the database back or remove Elgin from `ZONES`.
The new code retains historical zones so old and Haas-era appointments can still
be read, cancelled, rescheduled, confirmed and declined after switching.
Set `PILOT_BRAND=haas` and redeploy to return to Haas branding/coverage.
No migrations or record deletions are needed. Keep GUEST_LINK_SECRET unchanged.

Emails and private management links intentionally still use 512notary.com.
Operator alerts and reply-to remain mlw903@gmail.com; no payments are collected.
Admin is still restricted to the existing two Mark accounts. This does not grant
Haydn, Toni or Zane admin access. The site remains a noindex family-review test.

## Haas DNS before connection (September 16, 2026)

Squarespace Defaults preset (recoverable with Add Preset):
- A @: 198.185.159.144, 198.185.159.145, 198.49.23.144, 198.49.23.145; TTL 4h.
- CNAME www: ext-sq.squarespace.com; TTL 4h.
- HTTPS @: `1 . alpn="h2,http/1.1" ipv4hint="198.185.159.144,198.185.159.145,198.49.23.144,198.49.23.145"`; TTL 4h.

Preserve Domain Connect and Email Security presets. No custom records existed.
512notary.com DNS must remain unchanged.
