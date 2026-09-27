# Precomputed Dashboard Progress snapshot

## Problem

The live My Progress trace still made about 29 Supabase calls. Achievement evaluation scanned units, sessions, paints, recipes, contests, progress steps, and images during navigation. Metadata independently read overlapping units, sessions, ownership, and stage-paint data. Streaming hid part of the delay but did not remove the work.

## Implementation

Migration `20260927120000_add_dashboard_progress_snapshots.sql` adds one RLS-protected row per user, keyed by `user_id`. It stores achievement metrics, qualifying painting-day keys, and raw metadata summary values. Supporting composite indexes cover every refresh relation.

AFTER-row triggers refresh the snapshot when relevant units, sessions, progress steps, images, paints, recipes, saves, or contest records change. This moves aggregation to the write that invalidates the data. The trigger functions are not callable by anonymous or authenticated clients; users can only select their own snapshot. Existing definitions and award logic remain authoritative.

Achievement evaluation first reads the snapshot. Painting-day and streak rules are derived from the stored day keys at read time, so day-window rules continue to age correctly without a write. If the table or user row is absent during rollout, the existing calculation runs unchanged.

Dashboard metadata uses the same snapshot and formats time-sensitive display values at request time. It also retains the current six-query implementation as a fallback. With the migration applied and backfilled, the Progress route should use two snapshot reads plus achievement definitions and earned achievements, instead of about 29 data calls. A future small optimization could share the snapshot read between the two Suspense branches and reduce four reads to three.

## Verification

- Live schema metadata was checked for every referenced production table and column without exposing values.
- Production Next build and TypeScript passed.
- Targeted ESLint passed.
- Achievement tests cover both paths: legacy exact-count behavior remains intact, while a precomputed snapshot performs exactly one table request and no metric fan-out.

The migration has not been applied and this branch has not been deployed. Before release, apply it in a transaction-capable staging or local Postgres environment and compare snapshot values with the legacy evaluator for representative empty and populated accounts. The application fallback makes app-first or migration-first rollout safe, but the performance improvement begins only after the migration and backfill complete.
