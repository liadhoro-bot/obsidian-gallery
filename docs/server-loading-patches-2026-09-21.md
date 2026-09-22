# First server-loading patches

## Changes

- Achievement evaluation starts independent definition, earned-award, and metric reads together. Metric ID lookups share the initial parallel batch. Unit and recipe totals share their existing ID requests, eliminating two HTTP requests while retaining exact counts under API row limits. Award rules and writes are unchanged.
- Project Units fetches display fields during the existing active-owned-unit lookup, eliminating a second fetch of the same rows. Display ordering and direct/linked ownership filters are preserved. Featured-image loading no longer gates the unit/progress chain.
- Deck data executes image, guide-link, social, and step reads together after the existing visibility check. Feature guides load alongside the deck. Missing optional step columns are identified individually, preserving supported fields and propagating unrelated failures.
- No cache was introduced, so these patches do not add a freshness/invalidation dependency. Authentication and ownership checks remain in place.

## Local server measurements

Target: `http://127.0.0.1:3117`. Three sequential authenticated full streamed HTML requests per route, with no browser JavaScript or prefetch. These are local production-mode builds connected to Supabase, not Vercel production measurements.

Baseline build: `2-BHvFnQAX8QrcTVtO_2f`, captured September 19. Patched build: `wCeWb_RiP6hwXlLc874eF`, captured September 21. The baseline was recorded against `16f0856` plus local changes; the workspace HEAD at final inspection was `b3299d5`, with concurrent unrelated edits. This is not an isolated same-day A/B experiment. Network variability and other changes prevent attributing every timing difference to these patches.

| Route | Before median | After median | HTTP requests before → after |
| --- | ---: | ---: | ---: |
| Dashboard / My Progress | 5,295 ms | 3,592 ms | 34 → 32 |
| Project / Units | 4,395 ms | 2,374 ms | 14 → 13 |
| Project / Details | 2,226 ms | 2,059 ms | 13 → 13 |
| Deck Detail | 2,911 ms | 2,022 ms | 13 → 13 |

Request elimination is directly supported by the code and all three samples. Timings are encouraging observations, not production speedup guarantees.

The patched Deck trace reports both `recipe_steps.card_template` and `recipe_steps.youtube_url` missing. It therefore still needs three step queries (two specific failures, then success). The patch avoids a redundant retry when only one optional column is missing; it does not reduce this environment's total request count. The earlier trace exposed the first missing column twice and concealed the second mismatch.

## Validation

- Production build and TypeScript validation passed.
- Targeted ESLint passed; relevant tracked diffs pass `git diff --check`.
- 21 targeted tests passed: recipe-step compatibility and unrelated failures, exact achievement totals under truncated row responses, project ownership/deduplication/order, and existing onboarding action flows.
- Browser target: `http://127.0.0.1:3118`, Chromium at 430 × 932. Dashboard, My Progress, Project Units, Project Details, return to Units, and Deck navigation completed without JavaScript errors. Anonymous Project access redirected to login.
- Initial before/after browser captures used builds `LMbuYSoRa4Hng1EjCjnFY` and `wCeWb_RiP6hwXlLc874eF`. All six body texts matched. Dashboard, Project Units, Project Details, and Deck PNGs were byte-identical. Browser transition timings were mixed; no consistent transition speedup is established.
- Screenshot inspection revealed the My Progress readiness marker precedes its streamed panels. The initial captures only compared loading states. The local browser check was tightened to wait for the visible achievement collection and rerun; initial marker timings must not be treated as completed-content timings.
- The tightened six-view rerun passed without JavaScript errors and again verified the anonymous redirect. My Progress displayed its four earned achievements and metadata (including two owned units); the completed panel was visually inspected. Its one-sample readiness was 4,378 ms, with no equivalent settled baseline for comparison.

## Remaining work and evidence

Shared authentication/terms roundtrips, the unrelated Active Units feed before My Progress, and the broad Guides payload on Unit Progress remain opportunities for a separately validated pass. The connected environment still reports missing terms-acceptance and admin schema fields, as well as both optional recipe-step fields. No database migrations, push, or deployment were performed by this patch task.

Raw local evidence (ignored): `.perf/server-investigation/after-results.json`, `after-server.log`, `after-browser/`, and `after-settled-browser/`. Baseline evidence is in the same directory under `results.json` and `before-browser/`. The browser comparisons do not cover every mutation or every collection size; targeted tests cover the changed data-loading invariants.
