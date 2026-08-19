# V3 Silver Page Migration Map

## Canonical Reference

Use the Dashboard Active Units implementation as the live silver reference:

- Route: `/dashboard?golden=dashboard-active-units`
- Production surface: `/dashboard?tab=painting-table`
- Components: `app/dashboard/dashboard-active-units-view.tsx`, `app/dashboard/dashboard-active-units-screen.tsx`
- Styles: `app/dashboard/dashboard-og.module.css`
- Fixture: `app/dashboard/dashboard-active-units-fixture.ts`
- Spec: `docs/design/screens/dashboard-active-units/spec.md`
- Approved image: `docs/design/screens/dashboard-active-units/reference-approved.png`

Do not extend `app/dashboard/dashboard-v3-preview.tsx` for new page migrations. It is an older preview surface and should only be used when explicitly requested.

## Shared Materials

Keep new migrated pages in the same visual universe by reusing:

- Tokens: `src/styles/og-design-tokens.css`
- Primitives: `src/components/v3/**`
- Dashboard-calibrated material assets: `public/og-v3/materials/**`, `public/og-v3/hardware/**`
- Legacy V3 raster assets still referenced by tokens: `public/v3-raster/**`
- Dashboard miniature fixtures: `public/dashboard-golden/**`
- Source/reference sheets: `docs/design/reference/**`

Preferred material mapping:

- Walnut: permanent shell, header, nav, major controls.
- Parchment: main reading/work panels.
- Paper: cards, metadata, secondary records, compact object surfaces.
- Brass: plaques, medallions, small earned accents.
- Paint: progress fills, swatches, miniature-first color emphasis.
- Steel: precise controls only.

## Migration Order

1. Dashboard My Progress: finish profile/progress visuals inside the silver shell.
2. Projects: migrate list/grid/create surfaces from dark preview into parchment cards and walnut controls.
3. Paints/Vault: migrate ownership, filters, selected paint panel, swatches, and custom paint flows.
4. Unit detail: migrate hero, progress tab, session tracker, gallery, and stage paint picker.
5. Project detail: migrate details, units, palette, gallery, add-unit flow.
6. Recipes: migrate list cards, detail tabs, step cards, inventory, guide dialog.
7. Guides: migrate library, guide detail, deck detail.
8. Themes: migrate theme library, detail hero, palette editor, assignment panel.
9. Community/Contests: migrate social cards, contest cards, voting, results, admin surfaces.
10. Settings/Support/Login/Onboarding: bring utility and entry surfaces into the same materials with lower craft density.

## Page Checklist

For each page:

- Identify the page job, primary object, secondary objects, and next action.
- Preserve the existing V3 content, section names, order, and route behavior unless the user explicitly asks for product/content changes.
- Reuse `WorkbenchShell` or an equivalent compact workbench frame unless the route has an approved broader spec.
- Map UI to physical surfaces before styling: panel, card, tray, shelf, drawer, plaque, badge, progress track, swatch.
- Keep miniatures, paints, recipes, or records visually stronger than app controls.
- Remove old cyan/dark SaaS classes where a V3 tokenized class exists.
- Preserve server/client boundaries, auth, data loading, forms, optimistic updates, storage keys, analytics, and route params.
- Verify mobile 390x844 and desktop 1440x900 screenshots before calling a page silver.

## First Files To Inspect Per Area

| Area | Entry files |
| --- | --- |
| Dashboard | `app/dashboard/page.tsx`, `app/dashboard/dashboard-active-units-view.tsx`, `app/dashboard/dashboard-og.module.css` |
| Projects | `app/projects/page.tsx`, `app/projects/projects-v3-preview.tsx`, `app/projects/project-library.tsx`, `components/projects/*` |
| Paints/Vault | `app/paints/page.tsx`, `app/paints/paints-v3-preview.tsx`, `app/vault/page.tsx`, `app/vault/*` |
| Units | `app/units/[id]/page.tsx`, `app/units/[id]/unit-v3-preview.tsx`, `app/units/[id]/components/*` |
| Project Detail | `app/projects/[id]/page.tsx`, `app/projects/[id]/project-v3-preview.tsx`, `app/projects/[id]/*` |
| Recipes | `app/recipes/page.tsx`, `app/recipes/[id]/page.tsx`, `app/recipes/**/*` |
| Guides | `app/guides/page.tsx`, `app/guides/guides-v3-preview.tsx`, `app/guides/[id]/page.tsx` |
| Themes | `app/themes/page.tsx`, `app/themes/themes-v3-preview.tsx`, `app/themes/[id]/*` |
| Community | `app/community/page.tsx`, `app/community/community-v3-preview.tsx`, `app/components/social/*` |
| Contests | `app/contests/**/*.tsx`, `components/contests/*` |
| Settings | `app/settings/page.tsx`, `app/settings/settings-v3-preview.tsx`, `app/settings/*` |
| Entry/Utility | `app/login/*`, `app/onboarding/**/*`, `app/support/*` |
