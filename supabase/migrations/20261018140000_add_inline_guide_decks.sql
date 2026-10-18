-- Direct cards in a guide. Cards (recipe_steps) must belong to a recipe, so a
-- guide's own cards live in one hidden "inline" deck per guide, marked by
-- recipes.inline_guide_id. The inline deck is an ordinary guide_decks member,
-- so card_layout validation (save_guide_layout), RLS visibility, publishing
-- and the share route all work unchanged. The app hides inline decks from
-- deck lists and pickers and never shows them as a nested guide.
--
-- Additive only. No existing row has inline_guide_id set, so nothing that
-- exists today changes. If a guide is ever deleted, its inline deck is kept
-- (set null) and simply reappears as a normal deck - no cards are lost.

begin;

alter table public.recipes
  add column if not exists inline_guide_id uuid references public.guides(id) on delete set null;

-- One inline deck per guide per owner. Keyed with user_id so another user's
-- recipe pointing at your guide can never block yours; the app only treats a
-- recipe as a guide's inline deck when both belong to the same user.
create unique index if not exists recipes_inline_guide_owner_idx
  on public.recipes (inline_guide_id, user_id)
  where inline_guide_id is not null;

-- Publishing a guide flips its member decks public; an inline deck must not
-- get an auto-guide of its own. Same function as 20260914120000_add_guides.sql
-- plus the inline_guide_id check.
create or replace function public.ensure_guide_for_public_recipe()
returns trigger
language plpgsql
as $$
declare
  gid uuid;
begin
  if new.is_public = true and new.auto_guide_id is null and new.inline_guide_id is null then
    insert into public.guides (user_id, title, is_auto)
    values (new.user_id, new.name, true)
    returning id into gid;

    insert into public.guide_decks (guide_id, recipe_id, user_id, position)
    values (gid, new.id, new.user_id, 0)
    on conflict (guide_id, recipe_id) do nothing;

    update public.recipes set auto_guide_id = gid where id = new.id;
  end if;
  return new;
end;
$$;

commit;
