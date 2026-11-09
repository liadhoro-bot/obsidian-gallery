-- Unit Workflow: guide-driven progress.
--
-- A unit's progress is its checklist through the cards of the guides and
-- decks assigned to it (content_assignments, plus legacy unit_stage_recipes).
-- The checklist itself is derived from those guides at read time; this table
-- only records which cards (recipe_steps) are done for which unit. The source
-- guide is never touched, so two units on the same guide progress separately.
--
-- The old six fixed stages (unit_progress_steps) stay in place for the
-- dashboard and Paint Mode until they are migrated.
create table if not exists public.unit_guide_step_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete cascade,
  recipe_step_id uuid not null references public.recipe_steps (id) on delete cascade,
  -- The painting session the card was ticked off in, when there was one.
  unit_session_id uuid references public.unit_sessions (id) on delete set null,
  completed_at timestamptz not null default now(),
  constraint unit_guide_step_completions_unit_step_unique unique (unit_id, recipe_step_id)
);

create index if not exists unit_guide_step_completions_user_unit_idx
  on public.unit_guide_step_completions (user_id, unit_id);

alter table public.unit_guide_step_completions enable row level security;

drop policy if exists "Users manage their own unit step completions"
  on public.unit_guide_step_completions;
create policy "Users manage their own unit step completions"
on public.unit_guide_step_completions
for all
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.units u where u.id = unit_id and u.user_id = auth.uid()
  )
);

grant select, insert, update, delete on public.unit_guide_step_completions to authenticated;

-- Upcoming Sessions show how long a planned session is meant to run.
alter table public.unit_scheduled_sessions
  add column if not exists planned_minutes integer;
alter table public.unit_scheduled_sessions
  drop constraint if exists unit_scheduled_sessions_planned_minutes_positive;
alter table public.unit_scheduled_sessions
  add constraint unit_scheduled_sessions_planned_minutes_positive
  check (planned_minutes is null or planned_minutes > 0);
