# Dashboard Progress performance

## Change

The V3 My Progress route no longer waits for the Active Units feed or Next Actions. When `tab=profile`, `DashboardActiveUnitsScreen` renders the shared Dashboard shell with an empty inactive-units model and immediately exposes the existing independent achievement and metadata Suspense streams. Switching to Active Units still performs the normal authenticated route request before showing those units.

Dashboard return memory now keeps separate, account-scoped snapshots for Active Units and My Progress. The same five-minute, tab-memory-only lifetime and conservative invalidation rules apply to both. Native Next route-cache restoration can satisfy browser Back before the custom snapshot is needed; both paths keep real content visible.

Achievement seals now use the configured Next image optimizer at their actual 82, 116, or 138 pixel display widths instead of transferring original public-storage assets directly. The existing remote allowlist and 24-hour minimum image cache TTL apply.

## Validation

- Production build and TypeScript passed.
- Targeted ESLint and the two-tab account isolation/expiry test passed.
- Authenticated server tracing with `PERF_DEBUG=true` showed Active Units model work at 367–408 ms for the Active Units tab and `0.0 ms` for all three My Progress samples. This confirms the unrelated feed/actions work left the Progress critical path. Full Progress responses still took 2.6–3.7 seconds and about 29 data calls in this local trace; achievement evaluation is now the dominant server bottleneck.
- The mobile browser check delayed Dashboard server responses for two seconds. Active Units returned cached real content in 8 ms; My Progress restored real content in 92 ms, stayed visible while the response was held, and matched the fresh panel. Eight optimized seal image responses returned successfully with no image request or browser errors.
- The existing cold-navigation, Progress-tab, modifier/cancelled-click, and interrupted-navigation regression check passed (17 ms, 9 ms, and 5 ms immediate feedback in this run).

These figures come from the local production build, not the Samsung device or live production. No database changes are included.
