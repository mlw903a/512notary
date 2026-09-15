# 512Notary private prototype

Static customer booking prototype, not a live service. Pilot ZIPs: 78732 (Mark), 78653 and 78602 (Haydn). Other ZIPs route to a sample coverage-review request; neighboring ZIP coverage has not been assumed.

All dates/times are sample inventory in Central Time. Payments, confirmations, requests, cancellations, and rescheduling are simulated in volatile browser memory. No payment credentials, real appointments, outgoing messages, backend data, analytics requests, or browser persistence. Fonts load from Google Fonts with system fallbacks.

The proposed $75 offer covers travel plus up to five routine notarizations for one signer. The live system will need to capture the number and type of notarial acts and itemize statutory and non-notarial charges correctly while preserving the quoted total. Fees, supported acts, identification guidance, provider readiness, address boundaries, travel buffers, availability, policies, payment integration, and communications require completion before live launch.

## Validation

JavaScript syntax and local static asset references are checked before deployment. Browser visual/interaction testing was not requested. Optional WebMCP is feature-detected; a supported WebMCP verification context was unavailable, so its runtime registration has not been verified.

## Local preview

Serve dist over HTTP. No build step or dependencies required.
