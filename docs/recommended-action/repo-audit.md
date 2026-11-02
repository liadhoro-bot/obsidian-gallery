# Recommended Action — Repository Audit & Implementation Assessment

**Date:** 2026-11-01 · **Spec:** NBA / Recommended Action Engine V1 Execution Specification (1 Nov 2026)
**Status:** Phase 0 deliverable. No code, schema or production data changed.

Verification basis: source code on `main` (6b23cf8 + uncommitted working tree), `supabase/migrations/*`, and a read-only
column listing of the live Frankfurt database. **Row-level production data (value distributions, counts per persona) was
not read** — the request was blocked by the session's permission policy. The queries needed are listed in §8.

---

## 0. Owner decisions (2026-11-01)

1. **Personas = the onboarding goals as stored.** Persona keys are `paint_miniature` ("Paint my next miniature"),
   `organize_hobby` ("Sort out my hobby"), `create_content` ("Write a guide") and `look_around` ("Look around").
   The spec's `new_painter / experienced_hobbyist / content_creator` labels are not used. Starting families:
   `paint_miniature` → painting; `organize_hobby` → painting, then paints; `create_content` → guides;
   `look_around` (or no onboarding row) → inferred from activity. `experience_level` is a ranking modifier only.
2. **The Recommended Action card replaces the Next Actions checklist on the dashboard.** The checklist code, its data
   loader, its server action and the onboarding tables stay in the repo untouched; they are just no longer rendered
   when the engine is on. With the kill switch off, the checklist renders as today.
3. **Images stay plain gallery images for V1.** The intended model is "this image belongs to that progress step", but
   that link does not exist today: `image_assets` has no step reference, and any unit upload
   (`uploadUnitGalleryImages`) also marks the onboarding action `add_session_progress_photo` complete. So RA04 =
   "unit has no image at all"; RA05 (inspiration) and RA16 (finished photo) stay disabled. A step-linked photo
   (e.g. nullable `image_assets.progress_step_key`, set when uploading from a stage) is a separate feature; once it
   exists, RA16 becomes "Done step has no photo" and RA07 can offer "add a photo of this stage".
4. **No decks or recipes anywhere in the engine.** Decks and recipes are being retired. Every rule, type, event and
   string says "guide". "Saved guide" = the Save button on a guide, which today writes `saved_recipes` for the guide's
   first card set (`guides-v3-data.ts` `toGuideFile`). That table is read in exactly one adapter function in the
   snapshot loader and mapped back to guide ids, so retiring `recipes`/`saved_recipes` later is a one-place change.
   Guide-to-unit links use only the `content_type = 'guide'` rows of `content_assignments`.
5. **Experiment groups are assigned on the server, inside the engine** (deterministic hash of user id + experiment salt),
   so the dashboard needs no extra network call, never flickers between variants, and the server and card always agree.
   The group is stored on each recommendation and sent to PostHog as an event property; exposure is counted on visible
   impression only.
6. Production data check — open; see §8.6.

---

## 1. Existing architecture relevant to NBA

### 1.1 Dashboard

| Item | Location | Notes |
|---|---|---|
| Route | `app/dashboard/page.tsx` | Server component. V3 renders when `hasV3PreviewSession()` is true — always on the production hosts (`isV3DeploymentHost`). The non-V3 branch is legacy. |
| V3 screen | `app/dashboard/dashboard-active-units-screen.tsx` | Loads `getDashboardPaintingTableFeed`, `getDashboardNextActions`, `getDashboardFeaturedProject` in parallel, builds view model. |
| View model | `app/dashboard/dashboard-active-units-model.ts` | `mapNextActions()` — onboarding-flow checklist, or a "Resume {featured unit}" fallback when no flow (`canMutate: false`). |
| Current card UI | `NextActionsObject` in `app/dashboard/dashboard-active-units-view.tsx:206` | Collapsible 3-row checklist with manual check-off, `x/3 complete` progress bar, `Go` deep link per row. Styles in `dashboard-og.module.css` (`.nextAction*`). |
| Manual check-off | `setDashboardNextActionDone` in `app/dashboard/actions.ts` | Lets the user tick a row without doing the action. |
| Data loader | `getDashboardNextActions` in `app/dashboard/dashboard-data.ts:1379` | Reads `user_onboarding_flows` → `onboarding_flow_actions` → `user_onboarding_action_completions`; picks a batch of 3 via `selectVisibleOnboardingActionBatch`. |
| Featured Project / Up Next | same view; `getDashboardFeaturedProject` | Already match the mockup's lower cards. **Not touched by NBA.** |
| Feature-guide / tour copy | `dashboardFeatureGuideFallbacks['dashboard.next_actions.panel']` in `page.tsx`, tour steps in `tour-steps.ts` | Describe the checklist; must be updated when the card changes. |
| Golden fixture | `dashboard-active-units-fixture.ts`, `?golden=dashboard-active-units` (local only) | Useful for visual QA of the new card. |

### 1.2 Onboarding / persona

- Stored in **`user_onboarding_flows`** (one row per user): `goal_key`, `flow_name`, `experience_level`, `started_at`,
  `completed_at`, `dismissed_at`, `subject_{unit,project,guide,session}_id`.
- `goal_key ∈ {paint_miniature, organize_hobby, create_content, look_around}`; `flow_name` = same minus `look_around` (→ `null`).
  `experience_level ∈ {just_starting, know_basics, experienced, professional}` (`app/onboarding/actions.ts`).
- Flow definitions: `lib/onboarding/action-definitions.ts` — 16 / 14 / 13 actions, each with `refPage`/`refComponent`;
  deep links resolved by `lib/onboarding/action-destinations.ts` (already supports `?tab=`, `?edit=header|details|gallery`
  on units, `?tab=` on projects/guides).
- **Server-side completion hooks already exist**: `completeOnboardingAction()` (`lib/onboarding/completion.ts`) is called from
  real mutations in `app/units/new/actions.ts`, `app/units/[id]/actions.ts`, `app/projects/*`, `app/recipes/*`,
  `app/onboarding/actions.ts`. It emits `onboarding_action_completed` / `_milestone_completed` / `_flow_completed` server events.
  Gaps: `mark_paints_owned`, `add_owned_paints`, `create_step_card` have no hook.

### 1.3 Domain model (verified columns, live DB)

| Spec concept | Actual table(s) | Notes |
|---|---|---|
| Projects | `projects` (`is_featured`, `hero_image_url`, `theme_id`) + `unit_projects` join | Units link via `unit_projects` (and legacy `units.project_id`). |
| Units | `units` (`status` enum `complete/active/bench/pile/other`, `is_active`, `is_featured`, `image_url`, `deadline`, `updated_at`) | |
| Stage progress | `unit_progress_steps` (`step_key` ∈ assembled, primed, initial_paints, fine_details, base_rim, done; `status`, `progress`) **and** `unit_stage_progress` (`stage_key`, `is_done`) | Two progress tables — must confirm which is canonical for V3 before RA07 (§3). Actions: `updateProgressStep`, `toggleStepDone`. |
| Sessions | `unit_sessions` (`started_at`, `ended_at` null = running, `duration_seconds`, `entry_source`, `notes`) | Actions: `startUnitSession`, `endUnitSession`, `logManualUnitSession`, `expireUnitSessionAtTwoHours`. Events `session_started`, `session_stopped`, `unit_session_manual_logged`. |
| Scheduled sessions | **`unit_scheduled_sessions`** exists (`scheduled_start_at`, `focus`, `notify`, `status`, reminders) | `scheduleUnitSession` action + `unit-session-scheduler.tsx`. **RA08 is not blocked.** |
| Images | `image_assets` (`entity_type` ∈ unit/project/recipe/paint, `entity_id`, `is_primary`, `is_featured`, `sort_order`, `alt_text`) + `units.image_url` | **No image-kind column** (current / inspiration / final). |
| Guides | `guides` (`visibility` ∈ draft/private/public, `image_url`, `tags`, `primary_recipe_id`, `is_auto`, `updated_at`) | Drafts are first-class → RA15 is supportable. |
| Decks (cards) | `recipes` (+ steps), `guide_decks`, inline guide decks | |
| Saved | `saved_recipes` (decks), `saved_themes` | **No saved-guides table**; "Saved" on Guides = saved decks. |
| Guide↔unit | **`content_assignments`** (unit/project × guide/deck, unique per pair, RLS checks target ownership, not content ownership) | `app/guides/assignment-actions.ts` (`setTargetAssignments`, `getTargetAssignmentLibrary`), already used on unit page. **RA06/RA12 not blocked.** Also `assignRecipeToStage` (deck→stage). |
| Paint ownership | `user_paint_ownership` (`is_owned`, `is_wishlist`) | Vault batch actions; `paint_sets`/`paint_set_items` give grounded starter sets for RA13. |
| Unit palette | `unit_stage_paints` | `addPaintToStage`, `editUnitPalette`, `calculateUnitPaletteAction`. |
| Aggregates | `dashboard_user_metrics` (cached per-user totals, last session), `dashboard_unit_feed` | Reusable for a cheap snapshot. |
| Entitlement | Whole-app subscription/trial gate in `proxy.ts` / `lib/subscription/subscription-guard.ts` | **No per-feature freemium gates found** — every in-app CTA is available to anyone past the gate. |

### 1.4 Curator messaging

- DB-driven: `curator_rules` (priority, JSON `conditions`, `cooldown_hours`, `max_shows_per_week`), `curator_message_templates`
  (weighted copy per category), `curator_message_events` (`shown/dismissed/cta_clicked` journal). These tables are not in
  `supabase/migrations` (created out-of-band).
- Live use: `app/components/curator/get-curator-message.ts` + `curator-button.tsx` (header Curator button on V3 pages).
- `utils/curator/get-dashboard-curator-prompt.ts` is a near-NBA rule loop (state → first matching rule → cooldown → template)
  but has **no callers** — dead code, and it does N sequential queries per rule.

### 1.5 Analytics

- Client: `utils/analytics/client.ts` lazily inits posthog-js (`autocapture: false`, `capture_pageview: true`,
  feature flags disabled on first load). `PostHogUserIdentifier` identifies by Supabase `user.id` (+ email, `is_internal`).
  `app/providers/posthog-provider.tsx` (`PHProvider`) is **not mounted** anywhere — dead.
- Server: `utils/analytics/server.ts` posthog-node, `flushAt: 1`, `capture()` not awaited/flushed.
- Only ~5 client events exist (incl. `dashboard_next_action_go_clicked`); ~60 server domain events exist
  (`unit_created`, `project_created`, `guide_created`, `session_started/stopped`, `unit_progress_step_updated`, …).
- Only production (`VERCEL_ENV === 'production'`, `NODE_ENV === 'production'`) sends anything.
- **No PostHog feature flags or experiments are in use.** Flags in the app are env vars (`SUBSCRIPTION_REQUIRED`, etc.).

---

## 2. Requirements → codebase gap analysis

Legend: ✅ exists, reuse · 🟡 exists, needs change · 🔴 new · ⛔ blocked/needs decision

### 2.1 Rules

| Rule | Data available | CTA target available | Completion proof available | Status |
|---|---|---|---|---|
| RA01 Create first project | ✅ projects count | ✅ `/projects?tab=create` | ✅ `project_created`, onboarding hook | Ready |
| RA02 Create first guide | ✅ guides by owner (excl. `is_auto`) | ✅ guide forge | ✅ `guide_created` | Ready |
| RA03 Add first unit to project | ✅ `unit_projects` | ✅ `/projects/{id}?tab=units` / `/units/new?project=` (verify param) | ✅ `unit_created` | Ready (verify preselect param) |
| RA04 Add photo of unit | 🟡 "no image at all" only (`units.image_url` null and no `image_assets` row) | ✅ `/units/{id}?edit=gallery` | ✅ `image_uploaded` / `add_unit_image` hook | Ready as "add a photo"; current-vs-inspiration ⛔ |
| RA05 Inspiration image | ⛔ no image kind | — | — | Disabled until image-kind decision |
| RA06 Attach guide to unit | ✅ `content_assignments` | ✅ unit page assignment picker | ✅ assignment row | Ready (needs deep link to open picker) |
| RA07 Record stage | ✅ steps (canonical table TBC) | ✅ `/units/{id}?tab=progress` | ✅ `unit_progress_step_updated` | Ready; quick sheet = Phase 3 |
| RA08 Plan session | ✅ `unit_scheduled_sessions` | ✅ scheduler on unit page | ✅ row with future `scheduled_start_at` | Ready (spec assumed missing) |
| RA09 Start painting | ✅ no open `unit_sessions` | ✅ `startDashboardUnitSession` | ✅ `session_started` (intermediate only) | Ready |
| RA10 Record session | 🟡 define "unlogged": running session, or ended session with no notes/progress change | ✅ finish/session summary | ✅ `endUnitSession` / notes update | Ready with definition |
| RA11 Save a guide | 🟡 only decks can be saved; "relevance" needs tag match | ✅ `toggleRecipeSave` | ✅ `saved_recipes` | ⛔ decide guide-vs-deck save semantics |
| RA12 Use saved guide with unit | ✅ saved decks + assignments | ✅ assignment picker | ✅ assignment row | Ready (as deck) |
| RA13 Log essential paints | ✅ ownership count, `paint_sets` | 🟡 Vault exists; multi-select starter flow is new UI | 🟡 add ownership server event/hook | Deep link now, quick flow Phase 3 |
| RA14 Build unit palette | ✅ `unit_stage_paints` empty + owned > 0 | ✅ unit palette | ✅ `unit_stage_paint_added` | Ready |
| RA15 Continue guide draft | ✅ `visibility='draft'` | ✅ `/recipes/{id}?tab=edit` (verify guide route) | 🟡 `guides.updated_at > clicked_at` | Ready |
| RA16 Photograph finished unit | ⛔ needs "final" kind; fallback = "status complete & no image after completed_at" | ✅ gallery | ✅ | Defer / approximate |
| RA17 Discover guides | ✅ public guides | ✅ `/guides` | n/a (click only) | Ready (fallback) |

### 2.2 Platform

| Spec capability | Status | Notes |
|---|---|---|
| Typed rule registry, snapshot, persona resolver | 🔴 | Follow the `lib/onboarding/*` pattern: pure TS modules + `node:test` tests. |
| Persona field | ✅ reuse `user_onboarding_flows.goal_key/flow_name/experience_level` | No new persona column. `persona_source` derived at evaluation time and logged. |
| Instance / event / preference persistence | 🔴 | `curator_message_events` is the precedent; NBA needs its own tables (§5). |
| Card UI | 🟡 | Replace `NextActionsObject` internals in place; keep data attributes and feature-guide target. |
| Show another / snooze / dismiss | 🔴 | |
| Impression tracking (≥1 s visible) | 🔴 | No IntersectionObserver tracking exists. |
| Server-confirmed completion | 🟡 | Hook pattern exists (`completeOnboardingAction`); add an NBA reconcile-on-read (§5.4). |
| Experiments / flags | 🔴 | No PostHog flags in use. Propose deterministic server-side bucketing (§5.6). |
| Kill switch | 🔴 | Env var `RECOMMENDED_ACTION_ENABLED`, matching existing env-flag style. |
| Navigation tracking | 🟡 | `capture_pageview: true` records only full page loads in posthog-js, not App Router client navigations — likely the "incomplete screen tracking" the reports describe. Fix = `'history_change'`. |
| Server event delivery | 🟡 | Un-flushed posthog-node `capture()` on Vercel serverless can drop events after the response. Use `after()` + `flush()` or `captureImmediate`. Not verified empirically. |
| Internal/test exclusion | 🟡 | `is_internal` only for one email; house account (40,000 Paints) and seeded test users are not flagged. |

---

## 3. Conflicts between spec and current implementation

1. **Persona taxonomy.** The spec's personas (New Painter / Experienced Hobbyist / Content Creator) don't match the stored
   flows exactly. The stored *goal* is "Paint my next miniature / Sort out my hobby / Write a guide / Look around", and
   *experience* is a separate field. Proposed mapping (needs owner confirmation):
   - `paint_miniature` → `new_painter` (family `painting`)
   - `organize_hobby` → `experienced_hobbyist` (`painting` then `paints`)
   - `create_content` → `content_creator` (`guides`)
   - `look_around` / no row → `unknown`, persona inferred from activity, `persona_source = inferred|default`
   - `experience_level` is kept as a modifier (e.g. `just_starting` boosts guide-attach rules), not a persona.
2. **The existing Next Actions checklist is a different product.** It is a manual-tick, 3-row onboarding checklist with a
   progress bar; the spec forbids progress bars and self-reported completion. Replacing it removes the checklist from the
   dashboard. Onboarding completion tracking (`user_onboarding_action_completions`) keeps working and becomes an *input*
   to the engine. Owner decision: drop the checklist entirely, or keep it reachable elsewhere (e.g. a "Getting started"
   link under the card).
3. **RA08 and RA06/RA12 dependencies already exist** (`unit_scheduled_sessions`, `content_assignments`). No new
   `planned_unit_sessions` or guide-unit table should be created.
4. **"Saved guide" = saved deck.** Guides cannot be saved; `saved_recipes` holds decks. RA11/RA12 should be phrased and
   measured as decks unless guide saving is added.
5. **Image kinds don't exist.** RA04/RA05/RA16 distinctions require a schema change (`image_assets.kind`) and uploader UI
   changes. V1 can ship RA04 as "add a photo" (no image of any kind) and leave RA05/RA16 disabled.
6. **Two progress tables** (`unit_progress_steps` vs `unit_stage_progress`). Must confirm which the V3 unit page writes
   before RA07 reads it; reading the wrong one would produce false "no progress recorded" prompts.
7. **Rules in DB vs code.** The spec suggests `recommended_action_rules` in DB; Curator already does DB rules with JSON
   conditions. Recommendation: rule *logic* in typed code (testable, versioned with git), DB holds only operational
   overrides (enabled, weight overrides, circuit-breaker state) with an audit trail. Avoids a second JSON rule DSL.
8. **Quotes.** Curator templates live in DB. For truthfulness (real names, "last recorded" timestamps) V1 quote templates
   should be code-side with typed placeholders; they may later move into `curator_message_templates` with a
   `recommended_action` category.
9. **Entitlement.** No per-feature premium gates exist, so the "paywall trap" gate is a no-op today; keep the hook in the
   snapshot for later.
10. **Experiment framework.** Spec prefers PostHog flags "if already adopted" — they are not. Server-side deterministic
    bucketing avoids a flag round-trip on the dashboard's critical path.

---

## 4. Proposed technical architecture

```
lib/recommended-action/
  types.ts            RecommendedActionDTO, ActionType allowlist, Persona, Family, Snapshot
  persona.ts          resolvePersona(flowRow, activity) → {persona, source, version}
  snapshot.ts         loadSnapshot(supabase, userId) — bounded, parallel, RLS-scoped (server only)
  rules/              one file per rule: { id, version, family, tier, enabled(flags), evaluate(snapshot) → Candidate[] }
  registry.ts         ordered rule list + RULESET_VERSION
  rank.ts             hard gates → tier → score → fatigue → deterministic tie-break
  quotes.ts           template IDs with typed placeholders; fallback quote per family
  dispatch.ts         ActionType → href / server action (typed allowlist; no arbitrary routes from payload)
  config.ts           env kill switch, weights, experiment assignment (hash(user_id, salt))
app/dashboard/
  recommended-action-card.tsx   client card (replaces NextActionsObject internals)
  recommended-action-actions.ts server actions: showAnother / snooze / dismiss / recordImpression / recordClick
tests/recommended-action-*.test.ts
```

- **Evaluation** runs server-side in `DashboardActiveUnitsScreen`, in the existing `Promise.all`, replacing
  `getDashboardNextActions`. The ranked list (top ~5) is serialized to the card so **Show another** is client-side with no
  refetch; each action persists one event row.
- **Snapshot** (~7 parallel queries, all owner-scoped by RLS): onboarding row; projects (id, name, hero, counts);
  active/bench units with image, progress step, updated_at (reuse `dashboard_unit_feed` where possible); open +
  latest `unit_sessions`; future `unit_scheduled_sessions`; draft guides; owned paint count; saved decks + unit
  assignments for the top units; NBA preferences/snoozes. Capped to N most recent units/drafts.
- **Identity:** `recommendation_key = rule_id + target_id + context_hash`, where `context_hash` covers the target's
  `updated_at`/stage — any material change invalidates snoozes and stale instances automatically.
- **Completion:** never from a click. On each evaluation, reconcile `clicked` instances by checking the rule's goal in the
  fresh snapshot (e.g. RA01 clicked and a project now exists → `completed`, emit `ra_goal_completed` server-side once,
  deduped by instance id). Optional direct hooks later, next to the existing `completeOnboardingAction` calls.
- **Kill switch:** `RECOMMENDED_ACTION_ENABLED !== 'true'` → render the current `NextActionsObject` path unchanged.

---

## 5. Data model (proposed, not applied)

All tables: RLS on, `select` own rows only, writes only through server actions (insert/update policies scoped to
`auth.uid() = user_id`), idempotent migration, retention job later.

1. `recommended_action_instances` — `id`, `user_id`, `recommendation_key` (unique per user while open), `rule_id`,
   `rule_version`, `ruleset_version`, `target_type`, `target_id`, `context_hash`, `persona`, `persona_source`,
   `experiment_id`, `variant`, `score`, `status` (served/clicked/completed/dismissed/snoozed/invalidated/expired),
   `served_at`, `impressed_at`, `clicked_at`, `completed_at`, `snoozed_until`, `ignored_impressions`.
   Indexes `(user_id, status, snoozed_until)`, `(user_id, recommendation_key)`.
2. `recommended_action_events` — immutable journal: `id`, `user_id`, `instance_id`, `event_type`, `dedup_key` unique,
   `client_ts`, `server_ts`, `metadata jsonb` (no names, notes, URLs).
3. `recommended_action_preferences` — `user_id` pk, `family_penalties jsonb` (`{guides: {until, weight}}`), `updated_at`.
4. `recommended_action_overrides` (Phase 4) — `rule_id`, `enabled`, `weight_overrides`, `reason`, `changed_by`,
   `changed_at`, plus append-only history table; read by service role; this is the circuit-breaker and audit trail.

No new persona, scheduling or guide-unit tables.

---

## 6. Phased plan

| Phase | Scope | Depends on | DB changes |
|---|---|---|---|
| **1 — Engine core (no UI, no writes)** | types, persona resolver, snapshot loader, registry with RA01, RA02, RA03, RA04 (any-photo), RA07, RA09, RA10, RA13 (deep link), RA15, RA17; ranking, hard gates, tie-break, fallback; quotes; ≥12 snapshot tests | owner answers Q1, Q6 | none |
| **2 — Card + persistence (flagged)** | migration (instances, events, preferences); card UI per mockup replacing `NextActionsObject` internals; dispatch; Show another / snooze / dismiss; visible impression; reconcile-on-read completion; kill switch; enabled for internal accounts only | Phase 1; migration approval | 3 tables |
| **3 — Coverage** | RA06/RA12 (picker deep link), RA08, RA14, RA13 starter quick sheet (paint_sets), RA07 stage quick sheet; optional `image_assets.kind` for RA05/RA16 | Phase 2; Q2–Q4 | optional `kind` column |
| **4 — Observability & rollout** | PostHog `ra_*` mirror events; fix pageview (`history_change`) and server flush; internal/house exclusion list; E01 bucketing + holdout; overrides table + circuit breaker; PostHog dashboard; runbook; 10→25→50→100 % | Phase 2 | overrides tables |

Instrumentation note: Phase 2 already writes the DB event journal (source of truth); Phase 4 mirrors to PostHog. The two
PostHog fixes in Phase 4 are small and independent — they could be pulled forward as a separate change now since they
affect baseline measurement before the A/B starts.

### Phase 1 acceptance criteria

- `lib/recommended-action/*` compiles under `tsc --noEmit`; lint clean.
- `node:test` suite covering at least: new-painter blank → RA01; creator blank → RA02; creator with draft → RA15 outranks
  RA02; project no units → RA03 with project id; unit no photo → RA04; unit at fine_details → RA07 phrased as check-in,
  never "start"; active timer → RA10, never RA09; organizer no paints → RA13; look_around with authored guides → inferred
  creator; snoozed key hidden, changed context un-hides it; deleted/archived target excluded; nothing eligible → RA17
  fallback; deterministic tie-break; persona bonus decays after 2 meaningful actions.
- Snapshot loader exercised against a local/test account via a dev script, output reviewed; no production writes.
- No dashboard behaviour change shipped.

---

## 7. Risks and regressions

| Risk | Severity | Mitigation |
|---|---|---|
| Dashboard latency (adds ~7 queries) | Medium | Replace, don't add, `getDashboardNextActions`; reuse `dashboard_unit_feed`; cap rows; perf timer marks already exist (`createPerfTimer`). |
| Losing onboarding checklist users rely on | Medium | Owner decision (§3.2); keep flag to restore. |
| Wrong progress table → false prompts | Medium | Resolve §3.6 before RA07. |
| Supabase refresh-token rotation when testing on localhost with prod session | Medium | Per prior incident: user signs in fresh on localhost; never reuse prod cookies. |
| Tour / feature-guide copy describing the old checklist | Low | Update `dashboard.next_actions.panel` copy and tour step in Phase 2. |
| PostHog event loss on serverless | Medium (measurement) | DB journal is source of truth; flush fix in Phase 4. |
| Small sample (≈33 WAU) makes A/B results noisy | High (decision quality) | Start with internal + staged rollout; treat E01 as directional; holdout only once eligible counts are known. |
| Uncommitted unrelated work in the tree (community, guides) | Low | NBA work in its own commits touching only NBA files. |

**Genuine blockers:** none for Phase 1. Phase 2 is blocked only on migration approval and the checklist decision.
**Minor implementation decisions (I'll make them):** file layout, score constants, quote copy, cache strategy,
dispatch mechanics.

---

## 8. Decisions needed from the product owner

1. Persona mapping in §3.1 (especially `paint_miniature` → `new_painter`, and `experience_level` as modifier only).
2. Replace the onboarding checklist entirely, or keep a secondary "Getting started" entry?
3. Image kinds: add `image_assets.kind` in Phase 3, or keep RA05/RA16 disabled for V1?
4. RA11/RA12: treat "saved guide" as saved deck for V1?
5. Experiments: OK to use server-side deterministic bucketing instead of PostHog flags?
6. Permission to run read-only production queries for: onboarding goal/experience distribution, users per state
   (no project / no unit / draft guide / zero owned paints), active-unit image coverage, and which progress table is
   populated. These size the holdout and confirm §3.6.
