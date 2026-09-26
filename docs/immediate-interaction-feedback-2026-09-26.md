# Immediate navigation and action feedback

## Behavior

Navigation now has a client-resident loading surface, so an uncached route or a delayed authentication/database response does not leave the previous screen apparently unresponsive. The destination title and Dashboard tab selection appear immediately. The bottom navigation reflects the pending destination and remains available to change destination. Old route content is inert while covered, preventing accidental actions on the previous page.

The overlay follows React/Next navigation state and has no artificial minimum display duration. Next retains responsibility for routing, redirects, history, prefetching, and error handling. The shared Link delegates to Next Link and observes `useLinkStatus`, preserving cancelled clicks and browser modifier-key behavior. The router adapter uses optimistic destination state so existing nested transitions do not defer the feedback itself.

Dashboard's active tab updates optimistically and shows placeholders when its panel is not available. A root loading boundary covers routes without a more specific fallback, and Dashboard uses the same loading surface for the server handoff. The shell uses no account data or additional API requests. Existing data-loading and access rules are unchanged.

Application Link imports and programmatic destination navigation use the shared adapters. The Projects screen's project/unit cards, plus plain internal links in Community, Settings, and Themes, were converted from full-document anchors to client navigation. Browser history, authentication handoffs, downloads, and external navigation retain their native behavior. Vault search deliberately keeps its existing inline optimistic feedback so URL synchronization does not cover the search input or disrupt typing.

## Save actions

`OgButton` displays a spinner and disables duplicate activation when its `loading` prop is true or when it is a submit button inside a pending React form action. It announces pending state without claiming success. The existing `SubmitButton` retains its pending label/spinner and now exposes `aria-busy`; reduced motion is respected.

This establishes shared behavior; it does not infer whether arbitrary asynchronous callbacks have succeeded. Bespoke actions must still pass their own pending state or implement an optimistic update with rollback. Existing inline optimistic controls should remain inline rather than showing a whole-page loading surface.

## Development convention

- Use `app/components/navigation-feedback/navigation-link` for internal destination links, or the existing `PrefetchLink` wrapper.
- Use the router from `navigation-feedback/navigation-provider` for destination `push`/`replace`. Keep purely background URL synchronization local when the UI already updates optimistically.
- For React form actions, use `OgButton type="submit"` or `SubmitButton`. For callback-based saves, pass `loading={pending}` and retain the error/retry path.
- Do not turn off ownership/authentication checks or report a save as successful to make an interaction look faster.
- Measure tap feedback separately from completed data and image loading.

## Verification

- Production-mode build and TypeScript validation pass; targeted ESLint passes.
- `node --test tests/button-feedback.test.mjs` exercises the real shared controls in Chromium, with a held save promise. Both success and failure restore the enabled state. No database mutation is involved.
- `node scripts/check-navigation-feedback.mjs` starts a local production server at `http://127.0.0.1:3126` and holds route RSC responses. It verifies the skeleton appears before releasing the network response, the pending destination/tab is selected, cancelled and Ctrl-click navigation are not intercepted, and changing destination while a request is held clears correctly.
- Final build `fr625PHBpDI-Mh3mIu6mz`: observed client feedback was Dashboard 25 ms, My Progress 11 ms, Project link 6 ms. These are synthetic-click DOM feedback measurements on local desktop Chromium at 430 × 932, not phone measurements or production page-load improvements. Cancelled clicks, modifier clicks, interrupted navigation, and overlay cleanup passed with no browser JavaScript errors.
- Six loaded-view regression checks (Dashboard, completed My Progress, Project Units, Project Details, return to Units, Deck) pass, without browser JavaScript errors. Anonymous Project access still redirects to login.
- Mobile skeleton screenshots were inspected. Local evidence is under `.perf/navigation-feedback/` and `.perf/server-investigation/navigation-feedback-browser/`.

No deployment was performed for this change. The workspace includes unrelated concurrent work; release only a reviewed set of changes. Underlying server waits and achievement-image delivery remain separate performance work.
