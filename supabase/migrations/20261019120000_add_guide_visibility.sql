-- A guide's own visibility: draft, private or public. Until now a guide was
-- treated as public whenever any deck inside it was public, so the editor's
-- Status dropdown never stuck and an unpublished guide that reused public
-- guides still showed in Discover and counted toward contest entries.
--
-- Discover, creator pages, contest entries and the logged-out share link now
-- list only guides with visibility = 'public'. Pulling a guide back to
-- private/draft only changes this column: its decks stay readable, so people
-- who saved it or assigned it to a unit/project keep seeing it.
--
-- Additive. The backfill keeps today's public set exactly (any public member
-- deck => 'public'), so nothing listed today - including contest entries -
-- disappears when this runs. Everything else becomes 'private'. New guides
-- default to 'draft'.

begin;

alter table public.guides
  add column if not exists visibility text not null default 'draft';

alter table public.guides
  drop constraint if exists guides_visibility_check;
alter table public.guides
  add constraint guides_visibility_check check (visibility in ('draft', 'private', 'public'));

update public.guides g
set visibility = case
  when exists (
    select 1
    from public.guide_decks gd
    join public.recipes r on r.id = gd.recipe_id
    where gd.guide_id = g.id and r.is_public = true
  ) then 'public'
  else 'private'
end;

create index if not exists guides_public_visibility_idx
  on public.guides (user_id)
  where visibility = 'public';

-- A deck made public gets an auto-guide that is public too. Same function as
-- 20261018140000_add_inline_guide_decks.sql plus the visibility value.
create or replace function public.ensure_guide_for_public_recipe()
returns trigger
language plpgsql
as $$
declare
  gid uuid;
begin
  if new.is_public = true and new.auto_guide_id is null and new.inline_guide_id is null then
    insert into public.guides (user_id, title, is_auto, visibility)
    values (new.user_id, new.name, true, 'public')
    returning id into gid;

    insert into public.guide_decks (guide_id, recipe_id, user_id, position)
    values (gid, new.id, new.user_id, 0)
    on conflict (guide_id, recipe_id) do nothing;

    update public.recipes set auto_guide_id = gid where id = new.id;
  end if;
  return new;
end;
$$;

-- save_guide_layout gains p_visibility. Null keeps the current value, so the
-- app still deployed before this release (which never sends it) keeps
-- working. Publishing still makes the guide's own decks public so viewers can
-- read its cards; unpublishing leaves decks as they are.
drop function if exists public.save_guide_layout(uuid, text, text, text, text, uuid[], jsonb, text[], boolean);

create function public.save_guide_layout(
  p_guide_id uuid,
  p_title text,
  p_description text,
  p_image text,
  p_difficulty text,
  p_deck_ids uuid[],
  p_card_layout jsonb,
  p_tags text[],
  p_publish boolean default false,
  p_visibility text default null
)
returns void
language plpgsql
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform id from public.guides where id = p_guide_id and user_id = auth.uid() for update;
  if not found then raise exception 'Guide not found or not owned'; end if;
  if coalesce(cardinality(p_deck_ids), 0) = 0 then raise exception 'Choose at least one deck'; end if;
  if coalesce(cardinality(p_tags), 0) > 12 then raise exception 'Too many guide tags'; end if;
  if p_visibility is not null and p_visibility not in ('draft', 'private', 'public') then
    raise exception 'Invalid guide visibility';
  end if;
  if exists (select 1 from unnest(coalesce(p_tags, '{}'::text[])) tag where length(tag) > 32 or tag <> btrim(tag) or tag = '') then
    raise exception 'Invalid guide tag';
  end if;
  if (select count(*) from public.recipes where id = any(p_deck_ids) and user_id = auth.uid()) <> cardinality(p_deck_ids) then
    raise exception 'You can only add your own decks';
  end if;
  if p_card_layout is not null then
    if jsonb_typeof(p_card_layout) <> 'array' then raise exception 'Invalid card layout'; end if;
    if exists (
      select 1 from jsonb_array_elements(p_card_layout) c
      where not coalesce((c->>'groupId')::uuid = any(p_deck_ids), false)
         or jsonb_typeof(c->'hidden') is distinct from 'boolean'
         or not (case
           when c->>'cardId' in ('guide-index', 'guide-cover')
             or ((c->>'cardId' like 'guide-index:%' or c->>'cardId' like 'guide-cover:%') and length(c->>'cardId') <= 64)
             then coalesce((c->>'deckId')::uuid = p_guide_id, false)
           else coalesce((c->>'deckId')::uuid = any(p_deck_ids), false)
             and coalesce(c->>'cardId' = 'cover' or exists (
               select 1 from public.recipe_steps s where s.id::text = c->>'cardId' and s.recipe_id::text = c->>'deckId'
             ), false)
         end)
    ) then raise exception 'Invalid card reference'; end if;
    -- Each placement appears once; index cards are told apart by their ids.
    if exists (select 1 from jsonb_array_elements(p_card_layout) c group by c->>'deckId', c->>'cardId' having count(*) > 1) then
      raise exception 'Duplicate card reference';
    end if;
  end if;
  update public.guides set
    title = p_title,
    description = p_description,
    image_url = p_image,
    difficulty = p_difficulty,
    card_layout = coalesce(p_card_layout, card_layout),
    tags = coalesce(p_tags, '{}'::text[]),
    visibility = coalesce(p_visibility, case when p_publish then 'public' else visibility end)
  where id = p_guide_id and user_id = auth.uid();
  delete from public.guide_decks where guide_id = p_guide_id and user_id = auth.uid();
  insert into public.guide_decks (guide_id, recipe_id, user_id, position)
    select p_guide_id, id, auth.uid(), ordinality - 1
    from unnest(p_deck_ids) with ordinality as d(id, ordinality);
  if p_publish then
    update public.recipes set is_public = true where id = any(p_deck_ids) and user_id = auth.uid();
  end if;
end;
$function$;

grant execute on function public.save_guide_layout(uuid, text, text, text, text, uuid[], jsonb, text[], boolean, text) to authenticated;

commit;
