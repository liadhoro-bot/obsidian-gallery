-- 20260924120000_add_cover_position mistakenly declared cover_position
-- NOT NULL, but null is exactly what represents "no cover card at all" -
-- that state was impossible to save. Drop the constraint; the default of
-- 0 (cover first) for existing/new rows is unaffected.
alter table public.recipes
  alter column cover_position drop not null;
