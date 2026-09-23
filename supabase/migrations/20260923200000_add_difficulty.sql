-- The deck and guide editors both offer a Beginner/Intermediate/Advanced
-- Difficulty select, but neither recipes nor guides had a column to persist
-- it, so the choice silently reset to an inferred value (from card count)
-- every time the editor reopened. Store it as free text, matching how the
-- rest of this schema favors plain text/boolean columns over Postgres enums.
alter table public.recipes
  add column if not exists difficulty text;

alter table public.guides
  add column if not exists difficulty text;
