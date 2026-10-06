# Guides and decks feedback implementation — 2026-10-06

## Implemented order

1. Navigation: guide/deck back controls traverse browser history; guide browsing tabs, searches, sort/view settings and loaded result count are retained in the history entry. Editor tabs are retained in the URL. The decks index now opens the Decks tab.
2. Browsing: Discover descriptions and titles wrap; social controls sit below the text. Eye/View links open cards directly, with separate Info and owner-only Edit actions across lists/grids. Guide viewing combines the member decks into one card sequence.
3. Editors: full-width title, difficulty/status side by side, static counts removed. Deck details retain description, gallery and danger zone; inventory/expert-tip and palette-ownership panels removed. Existing note values are preserved when saving.
4. Templates: full titles wrap and scale by title length, consistently in previews/viewers/exports.
5. Guide composition: collapsed deck groups expand into card lists. Cards can be hidden/unhidden, reordered, or moved to another group without modifying source recipe steps. New source cards are appended; stale references are ignored. Newly selected decks load on demand.
6. Follow-up repairs: card titles use explicit length-aware sizes and bounded multi-line wrapping; editable-guide actions sit in the bottom action row; the guide image picker is labeled Gallery; guide tags can be added and removed as pills and participate in guide search and Discover tag filters.
7. List-card refresh: Discover, Guides, and Decks list cards use separate squircle surfaces, a thumbnail-height title/description area, and a divided action row. View is the primary control; guide Info and owner Edit follow; love/save controls stay grouped at the far edge. Deck social counts now come from the same recipe social-state load used by guides.

## Data and release

Apply `supabase/migrations/20261006120000_guide_card_layout.sql` and `supabase/migrations/20261006130000_add_guide_tags.sql` before releasing the application changes. They add guide-owned JSON card references, guide tags, and the authenticated `save_guide_layout` RPC. The RPC verifies ownership, card membership, and tag limits, then updates guide metadata, deck membership, tags, and card layout atomically. Existing publication behavior is retained.

The migration has **not** been applied to a database and production has **not** been deployed. Live database persistence remains unverified. Use the sole active `obsidian-gallery-v3` production pipeline; pushing main triggers deployment.

## Validation

- `node --import tsx --test tests/guide-card-layout.test.ts`: 3 passing tests covering ordering/visibility/transfers, source immutability and stale-reference reconciliation.
- `node --test tests/guide-ui.test.mjs`: 3 passing isolated browser tests covering guide-editor behavior, all eight card templates with long titles at 320/390/1280 widths, and mobile Discover links/layout.
- `node --test tests/editor-navigation-protection.test.mjs`: 3 passing existing browser tests for dirty-state/save handling and Back/Forward protection.
- Targeted ESLint checks passed.
- Full repository `tsc --noEmit` is blocked by generated `.next/dev/types` errors and unrelated pre-existing scripts (`backfill-vallejo-true-metallic-metal.ts`, `tmp-decks/test-cap.mts`). Application-only type checking passed, excluding those generated validators and scripts.

Browser tests use isolated fixtures and mocked Next.js adapters/server actions, not live authenticated production or database calls. Screenshots are generated under `test-results/guide-ui/`.
