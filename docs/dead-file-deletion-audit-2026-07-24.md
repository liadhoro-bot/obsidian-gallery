# Dead-File Deletion Audit - 2026-07-24

This audit was produced during the first cleanup sprint after checking imports with `rg`.
The deletion-only Phase 0 pass has now removed the verified-dead source files and
generated `downloads/` artifacts listed below.

## Verified Unreferenced Candidates

These files had no app/lib/component imports in the current checkout and were removed:

- `app/components/NavBar.tsx`
- `app/dashboard/dashboard-contest-card.tsx`
- `app/dashboard/dashboard-recent-projects.tsx`
- `app/dashboard/dashboard-recent-recipes.tsx`
- `app/dashboard/dashboard-recent-units.tsx`
- `app/projects/[id]/project-header.tsx`
- `app/projects/[id]/project-units-section.tsx`
- `app/projects-page-client.tsx`
- `app/recipes/recipes-filters.tsx`
- `app/recipes/recipes-list.tsx`
- `app/recipes/recipes-skeletons.tsx`
- `app/recipes/recipes-stats.tsx`
- `app/themes/[id]/palette-utils.ts`
- `app/themes/[id]/theme-owner-actions.tsx`
- `app/units/page.tsx`
- `app/units/unit-library.tsx`
- `app/vault/vault-filters-form.tsx`
- `app-structure.txt`

## Deferred Product Decisions

These are still not deletion-only cleanup items because they represent product surface,
not just dead code:

- `app/vault/actions.ts`: appears to be a stale custom-paint path, but there are current
  local edits in the file.
- Contest, dice roller, barcode scanner, and Themes surface: hide or merge behind product
  decisions rather than deleting in a cleanup commit.

## Generated/Repository Hygiene

These should be ignored or kept out of routine source tooling:

- `playwright-report/**`
- `test-results/**`
- `.perf/**`
- `.tmp/**`
- `downloads/**` dataset/import artifacts. Phase 0 decision: remove from the working tree
  and add `downloads/` to `.gitignore`; regenerate/import artifacts should stay outside
  committed runtime source unless deliberately promoted.
