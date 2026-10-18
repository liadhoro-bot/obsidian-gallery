-- A guide's likes, saves and Saved Guides membership are keyed to one of its
-- decks (recipe_likes / saved_recipes can only reference recipes). That deck
-- used to be "whichever deck is first", so reordering a guide moved its likes
-- and could drop it from savers' Saved lists. Pin it per guide instead.
--
-- Additive only: one nullable column, a backfill from each guide's current
-- first deck, and a trigger that fills the column for new guides. Existing
-- functions (save_guide_layout, ensure_guide_for_public_recipe) are unchanged.
-- If the pinned deck leaves the guide, the app falls back to the first deck,
-- exactly as before.

begin;

alter table public.guides
  add column if not exists primary_recipe_id uuid references public.recipes(id) on delete set null;

create index if not exists guides_primary_recipe_id_idx
  on public.guides (primary_recipe_id);

-- Backfill without touching updated_at.
alter table public.guides disable trigger set_guides_updated_at;

update public.guides g
set primary_recipe_id = first_deck.recipe_id
from (
  select distinct on (guide_id) guide_id, recipe_id
  from public.guide_decks
  order by guide_id, position, created_at, recipe_id
) first_deck
where first_deck.guide_id = g.id
  and g.primary_recipe_id is null;

alter table public.guides enable trigger set_guides_updated_at;

-- New guides: the first deck inserted (position 0 - guide_decks rows are
-- inserted in position order everywhere) becomes the pinned deck. Rows
-- re-inserted by save_guide_layout leave an existing pin alone.
create or replace function public.set_guide_primary_recipe()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.guides
  set primary_recipe_id = new.recipe_id
  where id = new.guide_id
    and primary_recipe_id is null;
  return new;
end;
$$;

drop trigger if exists guide_decks_set_primary_recipe on public.guide_decks;
create trigger guide_decks_set_primary_recipe
after insert on public.guide_decks
for each row execute function public.set_guide_primary_recipe();

commit;
