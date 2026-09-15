# 512Notary private booking pilot · v0.4

Local, persistent test-mode booking system. The previously published v2 site is unchanged: on September 15, 2026, the current Sites connection returned `Sites project not found` for the project in `.openai/hosting.json`; owned Sites listing was empty. Restore the connection to the original OceanBags workspace/account before publishing. Do not create a replacement project or overwrite the project ID.

## What works

- Monday–Saturday, 8 a.m.–6 p.m. America/Chicago, including daylight-saving changes. Last one-hour visit starts at 5 p.m. Initial configurable assumptions: one-hour travel gap, two-hour lead time, 28-day booking horizon.
- Mark: 78732. Haydn: Manor 78653 and Bastrop 78602 on one shared calendar. Adjacent ZIP codes route to saved coverage requests; no broader coverage is assumed.
- Fixed server-authoritative $75 test quote, including travel and up to five routine notarizations for one signer. Quantity 1–5 captured; zero actually charged.
- Persistent test bookings, provider-slot conflict protection, idempotent creation, version-checked rescheduling, cancellation, saved requests, and private record screen.
- Confirmation/reminder content saved as previews, never sent. Cancellation and rescheduling supersede previous reminder previews. No delivery service or scheduled job is connected.
- Basic private test funnel interaction counts and whitelisted UTM source data. These are not unique visitors, paid conversions, or evidence of demand.

## Run locally

Requires Node with `node:sqlite` (verified using Node 25.4.0).

```sh
npm ci
npm run build
npm test
npm run dev
```

Open http://127.0.0.1:8765. Development binds loopback only and substitutes a fixed local test identity. Test data persists in ignored `.local/pilot.sqlite`. Reload after rebuilding and restart the development server to load a new bundle. Use example details only; never enter document contents, ID images, or card information.

## Production architecture / pending verification

`server/worker.mjs` bundles the frontend and APIs into `dist/server/index.js`. `.openai/hosting.json` declares logical D1 binding `DB`. Schema source: `db/schema.ts`; immutable generated migration: `drizzle/0000_whole_pride.sql`. Production migrations are applied by Sites, not by request handlers. The local development adapter applies the same SQL using SQLite; hosted D1 behavior has not yet been integration-tested.

Private API identity comes exclusively from the Sites dispatcher-verified `oai-authenticated-user-id` header. All records are owner-scoped; anonymous booking access fails closed. JSON writes require same-origin requests. Provider-time locks are global across pilot identities. Bookings, locks, and message previews change together in a D1 batch transaction; NOT NULL version checks force rollback on concurrent modifications.

The current app is intentionally private-only and test-only. Public anonymous customer booking requires a separate customer authentication or narrowly scoped secure management-link design, rate limiting, bot protection, consent/privacy policies, real calendar blocks and exceptions, provider readiness, precise address coverage, act-type capture and reviewed fee itemization. Payment integration requires verified webhooks, reservation holds, expiration/retries, reconciliation, and refunds. Email requires a verified sender, delivery adapter, reminder scheduler, and duplicate-delivery protection. None of these are represented as live.

No domain is connected; no credentials, advertising spend, or public launch have been configured.

## Verification · September 15, 2026

12 automated tests pass: hours and Sundays; both DST transitions; fixed quote and no actual charge; idempotent retries; concurrent contenders; shared Haydn calendar/travel gap; rollback-safe rescheduling; concurrent version checks; cancellation; identity/ownership/origin/input checks; inquiries/events; and persistence after database reopen.

Local HTTP returns 200. Browser interaction verified Manor booking at 5 p.m., quantity five at $75, save, reload persistence, and cancellation. One cancelled sample record remains for inspection. Visual inspection at the available browser width found the booking controls readable and usable; no full device/browser matrix was run. The hosted revision and managed D1 deployment remain unverified because the Sites project is inaccessible through the current connection.
