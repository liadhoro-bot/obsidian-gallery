-- Unlisted guides are readable through a direct share link but never listed.
-- Existing draft/private/public visibility and RLS policies stay unchanged.
begin;

alter table public.guides drop constraint if exists guides_visibility_check;
alter table public.guides add constraint guides_visibility_check
  check (visibility in ('draft', 'private', 'unlisted', 'public'));

create or replace function public.save_guide_layout(
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
  if p_visibility is not null and p_visibility not in ('draft', 'private', 'unlisted', 'public') then
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
  if p_publish or p_visibility = 'unlisted' then
    update public.recipes set is_public = true where id = any(p_deck_ids) and user_id = auth.uid();
  end if;
end;
$function$;

grant execute on function public.save_guide_layout(uuid, text, text, text, text, uuid[], jsonb, text[], boolean, text) to authenticated;

commit;
