# Goal-Based Onboarding Action Flows

This document lists the Supabase tables involved in the goal-based onboarding
next-actions flow and the seeded content matrix.

## Tables To Populate

Populate these two content tables.

### `public.onboarding_action_flows`

Defines each selectable onboarding flow/persona.

| Column | Type | Purpose |
| --- | --- | --- |
| `name` | `text primary key` | Stable flow key. Current values: `paint_miniature`, `organize_hobby`, `create_content`. |
| `title` | `text not null` | User-facing title shown in the dashboard Next Actions card. |
| `persona_label` | `text not null` | Short persona label for analytics/admin context. |
| `description` | `text` | Supporting copy shown in the dashboard action drawer. |
| `created_at` | `timestamptz not null default now()` | Creation timestamp. |

### `public.onboarding_flow_actions`

Defines the ordered action list inside each flow.

| Column | Type | Purpose |
| --- | --- | --- |
| `id` | `uuid primary key default gen_random_uuid()` | Stable row id used by completions. |
| `flow_name` | `text not null references public.onboarding_action_flows(name)` | Parent flow. |
| `action_key` | `text not null` | Stable semantic key used by app completion hooks. Unique with `flow_name`. |
| `action_label` | `text not null` | User-facing action label. |
| `action_order` | `integer not null` | Order inside the flow. Unique with `flow_name`. |
| `breadcrumb` | `text not null` | Short route hint shown under the action. |
| `ref_page` | `text not null` | Semantic route target resolved by `lib/onboarding/action-destinations.ts`. Use values like `units`, `unit_builder`, `unit_detail`, `projects`, `project_detail`, `vault`, `paint_detail`, `guide_forge`, `guide_builder`, `guide_detail`, `dashboard`, `active_session`, or `session_summary`. Do not store URL fragments here. |
| `ref_component` | `text` | Semantic component/anchor target appended as one URL hash. Store only the component key, such as `unit_name`; do not include `#`. |
| `created_at` | `timestamptz not null default now()` | Creation timestamp. |
| `milestone_key` | `text` | Stable milestone group key. |
| `milestone_label` | `text` | User-facing milestone heading. |
| `milestone_order` | `integer` | Order of the milestone group inside the flow. |

## App-Owned Runtime Tables

The app writes these. They usually should not be manually populated except for
repair/admin work.

### `public.user_onboarding_flows`

Stores the selected flow for each user and subject context for smart links.

| Column | Type | Purpose |
| --- | --- | --- |
| `user_id` | `uuid primary key references auth.users(id)` | User whose onboarding state this is. |
| `flow_name` | `text references public.onboarding_action_flows(name)` | Active flow, or null when the user chose skip/look around. |
| `goal_key` | `text not null` | Raw onboarding choice: `paint_miniature`, `organize_hobby`, `create_content`, or `look_around`. |
| `experience_level` | `text` | Onboarding experience answer: `just_starting`, `know_basics`, `experienced`, or `professional`. |
| `started_at` | `timestamptz not null default now()` | Flow start time. |
| `completed_at` | `timestamptz` | Set when every action in the active flow is complete. |
| `dismissed_at` | `timestamptz` | Set when the user dismisses dashboard next actions. |
| `updated_at` | `timestamptz not null default now()` | Last onboarding state update. |
| `subject_unit_id` | `uuid` | Current unit target for route resolution. |
| `subject_project_id` | `uuid` | Current project target for route resolution. |
| `subject_guide_id` | `uuid` | Current guide/recipe target for route resolution. |
| `subject_session_id` | `uuid` | Current session target for route resolution. |

### `public.user_onboarding_action_completions`

Records actual completed actions. Completion is created only after a real app
mutation succeeds.

| Column | Type | Purpose |
| --- | --- | --- |
| `user_id` | `uuid not null references auth.users(id)` | User who completed the action. |
| `flow_action_id` | `uuid not null references public.onboarding_flow_actions(id)` | Completed flow action row. |
| `completed_at` | `timestamptz not null default now()` | Completion timestamp. |
| `created_at` | `timestamptz not null default now()` | Audit creation timestamp. |

Primary key: (`user_id`, `flow_action_id`).

### `public.user_terms_acceptances`

Audit log for accepting Terms and Conditions and optional product updates.

| Column | Type | Purpose |
| --- | --- | --- |
| `id` | `uuid primary key default gen_random_uuid()` | Acceptance row id. |
| `user_id` | `uuid not null references auth.users(id)` | User who accepted. |
| `terms_version` | `text not null` | Version string accepted by the user. |
| `accepted_at` | `timestamptz not null default now()` | Acceptance time. |
| `product_updates_approved_at` | `timestamptz` | Optional marketing/product-updates opt-in time. |
| `created_at` | `timestamptz not null default now()` | Audit creation timestamp. |

### `public.profiles`

Only these relevant columns are added/used by this work. The base `profiles`
table is not defined in the local migrations.

| Column | Type | Purpose |
| --- | --- | --- |
| `terms_accepted_at` | `timestamptz` | Fast profile-level gate for terms acceptance. |
| `terms_version` | `text` | Latest accepted terms version on the profile. |

## Seeded Flow Matrix

The migration `20260823143000_expand_onboarding_action_flows.sql` seeds three
flows and 43 actions: 16 for painting a miniature, 14 for organizing the hobby,
and 13 for guide creation. The dashboard shows the next three incomplete
actions from the selected flow.

### `paint_miniature` - Paint My Next Miniature

| Order | Action key | Label | Milestone | Completion status |
| --- | --- | --- | --- | --- |
| 1 | `create_unit` | Create a Unit | Set up your miniature | Unit creation from onboarding, `/units/new`, or project detail. |
| 2 | `name_unit` | Give your Unit a name | Set up your miniature | Unit creation/header/detail update with a name. |
| 3 | `add_unit_image` | Add an image of your miniature | Set up your miniature | Unit image upload/selection, unit gallery upload, or onboarding unit image. |
| 4 | `complete_unit_info` | Fill in your miniature's details | Set up your miniature | Unit detail/header update or populated unit creation. |
| 5 | `set_unit_progress_stage` | Tell us where you are in the painting process | Set up your miniature | Unit progress step/stage update. |
| 6 | `choose_unit_guide` | Choose a Guide to follow | Prepare to paint | Assigning a guide to a unit. |
| 7 | `assign_guide_to_unit` | Add the Guide to your Unit | Prepare to paint | Assigning a guide to a unit. |
| 8 | `add_unit_paints` | Add the paints you plan to use | Prepare to paint | Unit palette calculation/slot/stage paint mutation. |
| 9 | `mark_paints_owned` | Mark the paints you already have | Prepare to paint | Paint ownership update to owned. |
| 10 | `set_first_session_goal` | Decide what you'll paint first | Prepare to paint | Pending: no persisted session-goal field exists yet. |
| 11 | `start_first_session` | Start your first painting session | Paint with the app | Starting or manually logging a unit session. |
| 12 | `finish_first_session` | Finish your painting session | Paint with the app | Ending or manually logging a unit session. |
| 13 | `add_session_progress_photo` | Add a photo of your progress | Leave a handoff | Unit gallery upload, used as the available persisted progress-photo surface. |
| 14 | `record_session_paints` | Record the paints you used | Leave a handoff | Pending: no session-summary paint usage model exists yet. |
| 15 | `record_session_note` | Leave yourself a painting note | Leave a handoff | Ending/updating/logging a session with notes. |
| 16 | `set_next_painting_action` | Decide what you'll do next | Leave a handoff | Pending: no persisted next-action field exists yet. |

### `organize_hobby` - Sort Out My Hobby

| Order | Action key | Label | Milestone | Completion status |
| --- | --- | --- | --- | --- |
| 1 | `create_project` | Create a Project | Map your hobby | Project creation from onboarding, `/projects`, `/units/new`, or project actions. |
| 2 | `add_project_unit` | Add something you're currently painting | Map your hobby | Unit creation with a project or adding a unit from project detail. |
| 3 | `set_unit_status` | Decide where this Unit belongs | Map your hobby | Unit status update. |
| 4 | `organize_set_progress_stage` | Mark where you left off | Map your hobby | Unit progress step/stage update. |
| 5 | `add_unit_to_active_bench` | Put a Unit on your Active Bench | Map your hobby | Unit status update to active/bench. |
| 6 | `feature_unit` | Choose what deserves your attention first | Map your hobby | Feature-unit toggle from unit or project detail. |
| 7 | `add_owned_paints` | Add some paints from your collection | Sort your paints | Paint ownership update to owned. |
| 8 | `create_project_palette` | Build a palette for your Project | Sort your paints | Project palette slot set or palette calculation. |
| 9 | `use_project_palette` | Use your Project palette on a Unit | Sort your paints | Unit palette calculation/slot/stage paint mutation. |
| 10 | `organize_set_next_action` | Decide the next thing you'll do | Establish your working loop | Pending: no persisted next-action field exists yet. |
| 11 | `start_session_from_dashboard` | Start a session from your Painting Table | Establish your working loop | Starting a unit session, including dashboard start. |
| 12 | `organize_finish_session` | Finish the painting session | Establish your working loop | Ending or manually logging a unit session. |
| 13 | `update_unit_progress` | Update your progress | Establish your working loop | Unit progress step/stage update. |
| 14 | `organize_set_followup_action` | Leave your next task ready | Establish your working loop | Pending: no persisted follow-up action field exists yet. |

### `create_content` - Write a Guide

| Order | Action key | Label | Milestone | Completion status |
| --- | --- | --- | --- | --- |
| 1 | `choose_guide_source` | Choose how to start your Guide | Start the Guide | Guide creation from onboarding or Guide Forge. |
| 2 | `create_guide` | Create your Guide | Start the Guide | Guide creation from onboarding or Guide Forge. |
| 3 | `name_guide` | Give your Guide a title | Start the Guide | Guide creation/header update. |
| 4 | `add_guide_cover` | Add a cover image | Start the Guide | Guide cover/upload image or onboarding guide cover. |
| 5 | `name_first_guide_deck` | Name your first Deck | Build the painting instructions | Seeded and routed to guide edit. Pending: current recipes have steps/cards, not a separate deck entity/name UI. |
| 6 | `create_step_card` | Add your first painting step | Build the painting instructions | Adding/updating the first recipe step. |
| 7 | `add_step_paints` | Add the paints used in this step | Build the painting instructions | Adding/updating a recipe step with paints. |
| 8 | `add_step_image` | Show what this step looks like | Build the painting instructions | Uploading a recipe image or updating a step with image data. |
| 9 | `add_second_guide_card` | Add another Card | Build the painting instructions | Adding a second or later recipe step. |
| 10 | `reorder_guide_cards` | Put your Guide in the right order | Build the painting instructions | Reordering recipe steps. |
| 11 | `preview_guide` | Preview your Guide as a painter | Finish the Guide | Opening the guide preview as the guide owner. |
| 12 | `set_guide_visibility` | Choose who can see your Guide | Finish the Guide | Updating recipe visibility. |
| 13 | `finish_first_guide` | Save or publish your Guide | Finish the Guide | Updating recipe visibility/save-publish controls. |

## Onboarding Choices

The onboarding goal selection maps choices as follows:

| Onboarding choice | Stored `goal_key` | Active `flow_name` |
| --- | --- | --- |
| Paint a mini | `paint_miniature` | `paint_miniature` |
| Sort out hobby | `organize_hobby` | `organize_hobby` |
| Write a guide | `create_content` | `create_content` |
| Skip for later / look around | `look_around` | `null` |

When a flow starts, the app reconciles existing user data and pre-completes
obvious setup actions, such as an existing unit/project/guide or owned paints.
