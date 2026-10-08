# Current task — 2026-10-08

Port the published radar fixes and 83-destination catalogue to the existing
GitHub/Netlify source, retaining Next.js, runtime-env and Netlify Blobs.

Completed: ground/manual-only catalogue, rotating seven-day samples in months
6–12, bounded route concurrency, saved savings/baselines by travel month, honest
history/error/empty UI, origin/traveller-aware seller checks, changed-price
confirmation and route-specific manual fallback. Existing source history and
Netlify deployment configuration are retained.

Tests: core regressions and mocked radar/API/Blobs flow. These do not verify
real provider quota, Netlify deployment or an actual seller checkout.
No scheduled scans or Android push notifications have been added.

Next: authenticated production provider and seller-flow verification, then
scheduling the existing monitor with clear success/error reporting.
