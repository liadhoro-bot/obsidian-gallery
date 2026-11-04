-- Notes per progress stage, typed in the stage's Notes box on the unit page.
-- Create Guide > From Unit carries them into the stage's step card.
alter table public.unit_progress_steps
  add column if not exists notes text;
