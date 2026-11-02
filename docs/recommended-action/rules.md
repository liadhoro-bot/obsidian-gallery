# Recommended Action — Rules (ruleset `ra-2026-11-01.1`)

Code: `lib/recommended-action/` · Tests: `tests/recommended-action-engine.test.ts`
(`node --import tsx --test tests/recommended-action-engine.test.ts`)

## Pipeline

1. `snapshot.ts` loads the user's state read-only through the RLS client (two parallel rounds, row caps).
   Any core query failing throws `SnapshotLoadError` — an empty result is never mistaken for "no projects".
2. `persona.ts` resolves the persona from `user_onboarding_flows.goal_key`
   (`paint_miniature`, `organize_hobby`, `create_content`, `look_around`; `unknown` when no row).
3. Each rule in `rules.ts` emits candidates. `engine.ts` drops disabled/unsupported, excluded, dismissed,
   snoozed and cooled-down keys, scores the rest, sorts, removes duplicate intents, caps 2 per rule,
   and always reserves the last slot for the RA17 fallback.
4. `dispatch.ts` is the only place a recommendation becomes a URL (typed allowlist, UUID-checked ids).

## Ordering

`band` → `score` → urgency → most recent relevant change → rule id → key. Fully deterministic.

| Band | Rules |
|---|---|
| 1 Activation | RA01, RA02, RA03, RA13 (organizers) |
| 2 Recovery | RA10, RA15 |
| 3 Unit work | RA04, RA07, RA09 |
| 4 Cross-family | RA13 (everyone else) |
| 5 Fallback | RA17 |

Candidates from a family outside an explicit persona's starting families drop one band, unless the user's own
activity already points there. Score = 30% relevance + 25% one-tap feasibility + 20% activation/urgency +
15% depth + 10% novelty, + persona bonus (12 early / 6 later / 0 when behaviour contradicts), − 15 family
penalty for 14 days after "Not interested". Clamped 0–100.

## Persona starting families

| Persona | Starts in |
|---|---|
| `paint_miniature` | painting |
| `organize_hobby` | painting, then paints |
| `create_content` | guides |
| `look_around` / `unknown` | anywhere; primary family inferred from activity (default painting) |

## Rules

| Rule | Eligible when | Action → destination | Completion signal (`completion.ts`) |
|---|---|---|---|
| RA01 | 0 projects, persona may start in painting | `CREATE_PROJECT` → `/projects?tab=create` | a project exists |
| RA02 | 0 authored guides, persona may start in guides | `CREATE_GUIDE` → `/guides?tab=guides` | an authored guide exists |
| RA03 | a project with 0 units (featured, then newest) | `ADD_UNIT` → `/projects/{id}?tab=units` | that project has a unit |
| RA04 | an active/bench unit with no image at all | `ADD_UNIT_IMAGE` → `/units/{id}?edit=gallery` | the unit has an image |
| RA07 | active/bench unit, no running session, not Done; no stage recorded, or nothing recorded for 7+ days | `UPDATE_UNIT_PROGRESS` → `/units/{id}?tab=progress` | a step status changed |
| RA09 | no running session; an active unit not Done | `START_UNIT_SESSION` → `/units/{id}?tab=paint&autostart=1` | session started (intermediate only) |
| RA10 | a running session, or one ended ≤48 h ago with no notes | `LOG_UNIT_SESSION` → `/units/{unit}?tab=paint` | session ended / notes saved |
| RA13 | organizers: < 5 owned paints; others: 0 owned paints and ≥ 2 meaningful actions | `SEED_PAINT_COLLECTION` → `/paints` | ≥ 1 owned paint |
| RA15 | an authored guide with visibility `draft` | `CONTINUE_GUIDE` → `/guides/{id}?edit=1` | guide `updated_at` after the click |
| RA17 | always (fallback) | `DISCOVER_GUIDES` → `/guides?tab=library` | click only |

RA07 and RA09 share one intent per unit, so a unit never fills two slots with "update" and "continue".

Not in this ruleset: RA05/RA16 (images have no kind), RA06/RA12/RA14/RA08/RA11 (Phase 3; data and
actions exist).

## Identity and suppression

`recommendationKey = ruleId:targetId:contextFingerprint`. The fingerprint covers the target's relevant state
(stage, last session, image presence, guide `updated_at`), so a real change produces a new key and old
snoozes or dismissals stop applying automatically.

## Feedback and completion (Phase 2)

Tables: `recommended_action_instances` (state per user + key), `recommended_action_events` (append-only
journal), `recommended_action_preferences` (family penalties). All owner-only under RLS.

- The card POSTs to `/api/recommended-action/events` (keepalive): `impression` (≥50% visible for 1 s, once
  per visit), `primary_click`, `show_another`, `snooze` (7 days), `dismiss` (+ 14-day family penalty).
  Rule and target are parsed from the key server-side.
- Three ignored impressions on separate visits (≥30 min apart) → 7-day cooldown on that key.
- A click sets `clicked`. On the next dashboard load `service.ts` checks the snapshot: goal met →
  `completed` (+ `ra_goal_completed`), no outcome after 7 days → `expired`. Completed keys are never served again.
- Show another rotates through the ranked list client-side; when it runs out the card says "You're all caught up".
- Rollout: `RECOMMENDED_ACTION_ENABLED=true`, optionally `RECOMMENDED_ACTION_USER_IDS=<uuid,uuid>`.

## V1.1 contextual ranking (`nba-v1.1.0`)

Plan and owner decisions: `v1.1-audit-and-plan.md`. Code: `context.ts`, `engine-v11.ts`. Tests:
`tests/recommended-action-v1-1.test.ts` (S1–S15 + classifier edges).

- **Shadow mode.** `service.ts` ranks every snapshot with both revisions. `RECOMMENDED_ACTION_RANKING`
  (`v1` default, `v1.1`) picks the one shown; both write a row to `recommended_action_traces` (one per user,
  revision and half hour; ids and numbers only, kept 90 days).
- **Context.** `recommended_action_activity()` (SQL, security invoker) returns meaningful actions from durable
  writes: sessions ≥ 5 min, dated stage changes, unit photos, units, palettes, guide links, owned paints,
  saved guides, guide card edits. From it: lifecycle (new / activated / established / lapsed), observed intent,
  per-family familiarity, confidence. No activity read → entities only, confidence `low`, never "new" when
  real records exist.
- **No bands.** Gates first (reasons: `lifecycle_gate`, `abandoned_project`, `stale_target`,
  `no_real_outcome`, `action_unavailable`, `low_value` below 25), then
  `0.30 actionValue + 0.25 momentum + 0.15 feasibility + 0.12 intentFit + 0.10 timing + 0.08 novelty − penalties`.
  Only a running/just-ended session (RA10) and a project created in the last 2 h are protected.
- **RA03** only for new users, activated users within 14 days of creating the project, or a featured project.
  Abandonment risk ≥ 70 excludes it for everyone but brand-new users.
- **RA07** check-in only when the unit was painted after its last recorded stage change (v1 did the opposite:
  it checked in after a quiet week). `unit_progress_steps.updated_at` dates stage changes from the migration on.
- **Feedback.** Optional reason after "Not interested" (`dismiss_reason`), `action_failed` when a CTA can't be
  built, `invalidated` when a clicked target is gone and the snapshot saw the full list, `evaluation_fault`
  when the snapshot fails. None of these count as preference.
- **Review.** `npx tsx scripts/recommended-action-review.ts --recent 20` (v1 vs v1.1 top three per account,
  read-only). `npx tsx scripts/recommended-action-report.ts --days 7` (weekly counts, unique users,
  "insufficient evidence" below 20 exposures / 8 users; proposals marked "requires approval").

## Copy

Titles and CTAs are plain. Curator quotes live in `quotes.ts`: fixed template ids, only real names and
recorded timestamps, "recorded"/"ledger" wording, no shaming, ≤ 130 characters. A template is skipped
when a value it needs is missing; a quote is stable for the same user, rule and day.
