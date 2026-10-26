# Discover summary index

Discover now reads exactly nine prepared guide summaries through `discover_guides_page`.
It does not load member decks, recipe steps, paint links, the user's collections,
folders, tag metadata, or help tours during the initial page request. Guide and
creator links do not prefetch their contents. The next nine rows, search and sort
results are requested explicitly; Tags loads its directory and aggregate facets
when opened. Personal tabs load their collection only on navigation.

`guide_discover_summaries` stores only publicly listed guides, their display and
search metadata, thumbnail sources, creator identity, and like/save totals. B-tree
indexes serve stable chronological, title, popularity, social and owner lookups;
GIN indexes serve canonical tags and substring search. The RPC returns at most
nine summaries with viewer-specific liked/saved flags and a `hasMore` boolean.

Database triggers refresh the affected summaries when guide metadata, membership,
publication, thumbnail sources, creator identity, tags, cards, likes or saves change.
Private guides and nested auto-guides are excluded. Likes and saves retain the
guide's pinned public member deck identity. Card counts are used only to maintain
the existing inferred skill level at write time, never calculated during a list
request. Paint links are not used by this path at all.

Authenticated users have read-only access to the public summaries. Internal
maintenance functions cannot be called by clients. Viewer social flags are scoped
to `auth.uid()` and responses use `private, no-store`; private collection data is
never put in a shared cache.

The Frankfurt migration `20261025190000` was applied and registered on October 25,
2026. It is additive; the older detail/editor data readers remain available. The
summary triggers continue to maintain compatibility with existing write paths.

Validation:

- Production build and TypeScript pass; changed-file lint has no errors (three
  existing unused fixture warnings in `guides-v3-preview.tsx`).
- The new initial data loader makes one request for nine summaries, compared with
  70 requests in the old loader replay. Warm workstation-to-Frankfurt reads were
  98–165 ms; SQL EXPLAIN measured a 19 ms cold RPC execution.
- Authenticated browser checks cover nine initial cards, no detail prefetch or
  eager metadata, loading nine more, search beyond the initial page, popularity,
  tag filtering, personal tabs, and entering creation.
- Rollback-only SQL checks in `tests/discover-summary-regression.sql` cover
  publication/privacy, nested auto-guides, like/save increments and decrements,
  alias reindexing, metadata changes, literal wildcard search, deletion, and RLS.

The browser figures from the isolated local production build use Frankfurt data;
they are not measurements of the public deployed domain. Record hosted timing
separately when promoting a deployment. No physical-device percentiles are implied.
