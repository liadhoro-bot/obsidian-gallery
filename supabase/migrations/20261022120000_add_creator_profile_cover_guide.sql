-- Entry covers are chosen per published guide now that guide photos live on
-- guides. cover_recipe_id stays as the older, per-deck choice.
alter table public.contest_creator_profiles
  add column if not exists cover_guide_id uuid references public.guides(id) on delete set null;
