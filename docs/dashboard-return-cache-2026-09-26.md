# Dashboard return visits

Returning to the V3 Dashboard's Active Units tab now shows the last loaded units, featured unit, and next actions while the authenticated server route loads. Both the immediate navigation overlay and Next's route loading boundary use the snapshot, avoiding a skeleton between URL commit and completion of the server stream.

The snapshot lives only in this browser tab's memory, expires after five minutes, and is matched to the current Supabase account. It contains the units view model and feature guide data, not streamed Progress components. The renderer is registered by the loaded Dashboard module, avoiding an eager import of the Dashboard UI into every route. Cached tab navigation uses the destination URL rather than the underlying page's URL. Cached displays do not trigger extra tab prefetches or report themselves as freshly loaded performance indicators.

The normal server route remains responsible for authentication and fresh data; there is no additional feed API request or polling loop. First visits, full reloads, expired snapshots, and My Progress still use their loading states. Existing Next route-cache hits remain immediate.

Form submissions, explicit router refreshes, next-action changes, and existing Dashboard sync notifications invalidate the snapshot. This is deliberately conservative: a return after an edit can show the skeleton until fresh data arrives. Sign-out/account changes discard private content; late snapshots from another account are ignored. The cache is not stored in localStorage or the service worker.

## Validation

- Production build and TypeScript passed; targeted ESLint passed.
- `node --test tests/dashboard-return-cache.test.mjs`: account confirmation, account switching, late previous-account snapshot, sign-out, mutation invalidation, and expiry passed.
- `node scripts/check-dashboard-return.mjs`: authenticated local production build at `http://127.0.0.1:3127`, mobile viewport, Dashboard RSC responses deliberately held for two seconds. Checks real text and unit links, replacement by the fresh route, and subsequent tab navigation. Output: `.perf/dashboard-return/results.json`; screenshot: `.perf/dashboard-return/held-return.png`.
- `node scripts/check-navigation-feedback.mjs`: cold navigation, tab feedback, cancelled/modifier clicks, and interrupted navigation passed at `http://127.0.0.1:3126`. Local V3 preview cookies explicitly select the production UI.

These are local production-build results, not live production or Samsung timings. This change has not been deployed. No database changes are required.

Final checked build: `YuP8PrY0WC_ySl4irHeCr`. Real content appeared after **9 ms**, remained visible throughout the two-second held response, and was replaced by the fresh route successfully. Subsequent tab navigation passed with no browser errors. This single-run latency is evidence that display does not wait for the server, not a device-wide latency guarantee.
