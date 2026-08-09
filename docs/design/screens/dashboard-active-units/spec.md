# Dashboard Active Units

## Status
- Golden Candidate - failed first visual review; reconstructed candidate pending human visual approval
- Owner: Product/design
- Last reviewed: 2026-08-07

## Route
`/dashboard?tab=painting-table`

## Objective
Give the painter a calm first stop for resuming work: see the current featured/in-progress unit, choose the next meaningful action, and scan active units without leaving the dashboard.

## Primary next action
Resume or start a painting session on the featured unit.

## References
- Approved visual/compositional target: `docs/design/screens/dashboard-active-units/reference-approved.png`.
- Deterministic fixture captures, not approved golden references:
  - `mobile-390x844.png` - viewport: 390x844
  - `tablet-768x1024.png` - viewport: 768x1024
  - `desktop-1440x900.png` - viewport: 1440x900
- Component references:
  - `docs/design/reference/surfaces/panel.webp`
  - `docs/design/reference/surfaces/card.webp`
  - `docs/design/reference/surfaces/button.webp`
  - `docs/design/reference/surfaces/image-mount-photo-mount.webp`
  - `docs/design/reference/surfaces/label.webp`
  - `docs/design/reference/surfaces/progress-track.webp`
  - `docs/design/reference/surfaces/swatch.webp`
  - `docs/design/reference/typography/obsidian-gallery-typography-system.webp`

## Golden implementation
None yet. This screen remains a golden candidate and is not golden until human visual approval.

## Deterministic Golden Fixture
- Dev-only invocation: `/dashboard?golden=dashboard-active-units&tab=painting-table`.
- Fixture data lives in `app/dashboard/dashboard-active-units-fixture.ts`.
- The fixture feeds the same `DashboardActiveUnitsView` presentation component as production; it does not replace production data, write to the database, or create a separate fake Dashboard implementation.
- The auth proxy bypass for this fixture is development-only and scoped to this exact query string.

## Preserve behavior
- Auth redirect behavior in `app/dashboard/page.tsx`.
- `preview=1` V3 preview path and data loading behavior.
- Query-param tab behavior: `tab=profile` shows My Progress; otherwise Active Units.
- Active Units tab switcher labels and `window.history.replaceState` behavior.
- Next actions data, completion toggles, dismiss behavior, optimistic rollback, and links.
- Quick actions: start project/unit dialog, theme link, paint picker dialog.
- Featured unit link to `/units/[id]` and resume route `/units/[id]?session=started&autostart=1`.
- Unit status filtering, stored display mode in `localStorage`, display-mode analytics event, and max visible unit behavior.
- Existing server/client boundaries and Suspense fallbacks.

## Information hierarchy
1. Walnut application header: hamburger/settings on the left, `Dashboard` centered, help and create/add controls on the right.
2. Primary segmented control: `Active Units` and `My Progress` in the same compact phone-format position on every viewport.
3. Compact Next Actions object with progress and optional expanded checklist.
4. Dominant Featured Unit parchment surface: brass plaque, large miniature image, unit name, squad descriptor, campaign progress, stage/status, and Resume CTA.
5. Up Next / Active Units parchment surface: brass plaque, status filter, grid/list selector, and miniature-led active unit cards.
6. Integrated bottom navigation, centered with the canonical app canvas on desktop.

## Composition
- The production route renders through `DashboardActiveUnitsView`, fed by a typed view model from live Dashboard data.
- The dev-only golden fixture renders the same `DashboardActiveUnitsView`, so screenshot QA exercises the same presentation component as production.
- Remove visible legacy Dashboard introduction pieces from the Active Units composition: avatar/profile header, `OBSIDIAN GALLERY`, level label, standalone Support button, welcome heading, and onboarding-style welcome copy.
- Use a single phone-format workbench column: walnut header, tab band, body stack, and fixed bottom navigation.
- Keep Next Actions compact enough that Featured Unit remains dominant in the first viewport.
- Treat Featured Unit as the visual anchor: image mount and resume action receive more scale and contrast than filters or secondary controls.
- Keep Active Units dense enough that the first row of unit cards is visible in the 390 x 844 viewport.

## OG-WDS component mapping

| Content | Component | Variant |
|---|---|---|
| Dashboard shell | WorkbenchShell | compact phone-format app canvas |
| App header controls | OgIconButton / linked icon controls | walnut circular controls |
| Dashboard title | Display typography token via route header | centered workbench title |
| Primary tabs | DashboardActiveUnitsView segmented tabs | dark inset + parchment active segment |
| Next actions object | SurfacePanel-style Dashboard object, ProgressTrack pattern | compact checklist disclosure |
| Featured unit plaque | OgPlaque | brass |
| Featured unit | Dashboard featured surface, ImageMount pattern, ProgressTrack pattern, DashboardResumeButton | dominant campaign card |
| Active unit surface | SurfacePanel-style Dashboard section + OgPlaque | Up Next / Active Units |
| Status filter | tokenized dark inset menu control | compact filter |
| Grid/list selector | tokenized dark inset icon toggle | compact selector |
| Active unit cards | EntityCard/ImageMount/ProgressTrack patterns | miniature-first paper cards |
| Empty states | SurfacePanel, BodyText | calm secondary |
| Bottom navigation | MobileNav tokenized walnut control surface | integrated fixed nav |

## Materials
- structural: walnut workbench shell.
- primary surface: parchment for featured/current work.
- secondary: paper cards for unit list and controls.
- special accents: brass only for status/progress highlights and restrained labels.
- prohibited on this screen: pins/screws, wax, leather navigation, excessive fantasy treatment, or ornament that competes with miniatures.

## Physicality
- highest physicality object: featured unit card and its image mount.
- shadow types: contact for cards and buttons; medium only for the featured unit card.
- hardware count/role: restrained brass plaques and control bevels only; no extra fasteners unless a later approved mockup requires them.

## Typography
- title: centered Dashboard header title / Cormorant Garamond semibold.
- section headings: plaque labels for `Featured Unit` and `Up Next`; `Active Units` as the section heading inside the lower surface.
- body: Source Sans 3 for descriptions, counts, state copy, and empty states.
- labels: Source Sans 3 semibold for status, counts, filters, and control copy; plaque labels use display typography.
- technical data: IBM Plex Mono only for percentages or measured values where used.


## Task 4C Calibration Targets
- Header: 58-64px visual height, 28-31px Dashboard title, 38-42px circular controls.
- Header-to-tabs gap: 10-12px; segmented control: 38-42px visual height.
- Horizontal app gutter: 16-18px; primary section gaps: 10-12px.
- Next Actions: 54-60px visual height.
- Featured Unit: 144px image column, 12px image/content gap, content column uses remaining phone width.
- Bottom navigation: 66-72px visual height including safe visual padding.
- Walnut, parchment, dark inset, and brass corrections are global token/component calibrations, not Dashboard-local material patches.
## Responsive behavior

### Mobile
- order: walnut app header, segmented tabs, next actions, featured unit, active units surface, bottom navigation.
- scrolling: one vertical column with bottom-nav safe area clearance.
- collapsible content: Next Actions disclosure, status menu, grid/list selector, and existing start-project/unit dialog.
- fixed elements: bottom navigation remains fixed and centered to the compact app canvas.

### Tablet
- Preserve the same phone-format information hierarchy and visual composition unless a later approved spec explicitly introduces a broader workspace.
- Keep the workbench app column centered; do not use tablet width as additional content space for this route.

### Desktop
- At a 1440 x 900 browser viewport, keep the application itself in the same mobile-format composition and target the canonical 390 x 844 portrait proportion.
- Center the app horizontally inside the browser viewport; walnut/environmental workbench space fills the unused desktop area.
- Do not stretch panels to desktop width, reorganize the dashboard into desktop columns, enlarge Active Units into horizontal desktop cards, or move navigation into a desktop-specific navigation system.

## States not shown in the mockup
- loading: keep Suspense skeletons, but material treatment may be tuned later.
- empty: show calm SurfacePanel/EntityCard empty copy for missing featured units and empty status filters.
- error: preserve existing silent fallback behavior where data wrappers return null or fallback data.
- disabled: navigation buttons must visibly disable while routing.
- permission: auth redirect remains unchanged.
- long text: unit names and breadcrumbs must truncate without overlapping actions/progress.
- many items: existing display cap remains; no new pagination or IA.

## Accessibility
- focus expectations: all buttons/links receive visible OG focus rings.
- keyboard behavior: tabs, menus, dialogs, and links remain keyboard reachable.
- labels/aria: preserve `aria-pressed`, menu semantics, dialog labels, link labels, and progressbar labels.
- color-independent status: status text remains visible alongside accent color.

## Do not infer
- Do not migrate My Progress content in this task beyond preserving it behind the existing tab.
- Do not replace the live data feed with preview fallback data.
- Do not add decorative hardware to unit cards.
- Do not change dashboard route semantics, tab names, next-action behavior, or quick-action destinations.
- Do not make the dashboard a wide desktop analytics screen.

## Acceptance checklist
- Active Units tab uses OG-WDS foundation tokens and primitives.
- Current task and miniatures are more visually prominent than controls.
- No raw route-local colors, radii, shadows, or spacing are introduced without global token calibration.
- Mobile 390x844 has no text overlap or bottom-nav collision.
- Tablet 768x1024 remains readable and centered.
- Desktop 1440x900 shows the phone-format application centered in environmental workbench space, with the same mobile hierarchy and composition.
- Typecheck, lint, and build pass or any pre-existing warnings are documented.
- Human approves screenshots before this route is recorded as golden.







## Task 4D Fidelity Corrections
- Featured Unit image mount: the miniature image is the mounted object and must fill/crop within the left-column frame; no empty parchment sub-card area may appear below the photo.
- Active Unit cards: each card is one unified image-first card: image, unit name, stage/status, compact progress. Do not nest or embed another complete card inside it, and do not use fixture imagery that already contains metadata text.
- Active Units panel: recovered space from the card hierarchy correction should enlarge miniature imagery, not become additional padding. Keep filter, grid/list selector, and the three-column grid.
- Brass plaques: `Featured Unit` and `Up Next` labels use graphical component fasteners only. There must be no text bullet/dot before the plaque label.
- Mobile navigation: selected Dashboard uses the approved compass-style icon asset and a restrained inset selected state; no invented lettermark or oversized selected frame.
## Task 4E Final Material / Physicality Corrections
- Major Dashboard panels must show restrained outer and inner frame construction while preserving the established section heights and phone-format composition.
- Header controls, segmented tabs, Resume CTA, status filter, grid/list toggle, and bottom navigation use constructed ebonized/walnut/brass control treatments rather than flat colored shapes.
- The grid/list toggle target is a compact two-segment control around 87 x 40px total, with balanced 38 x 32px segments and consistent icon treatment.
- Bottom navigation icons are rendered through the approved icon assets using a layered mask treatment so they read as crafted controls, not flat pasted SVGs.
- Material priority remains: miniature images first, paper content second, brass accents third, walnut as environment/background.