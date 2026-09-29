-- Theme cards (types A and B) show a kicker under the title that was
-- hard-coded to "Colour Reference". Let the deck owner set it; null keeps
-- the default ("Color Reference"). Already applied to production by hand.
alter table public.recipe_steps
  add column if not exists subtitle text;
