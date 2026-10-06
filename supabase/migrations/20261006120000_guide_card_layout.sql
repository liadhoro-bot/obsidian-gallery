-- Guide-only card order/visibility. The original recipes and steps stay intact.
alter table public.guides add column if not exists card_layout jsonb not null default '[]'::jsonb
  check (jsonb_typeof(card_layout) = 'array');

create or replace function public.save_guide_layout(
  p_guide_id uuid, p_title text, p_description text, p_image text,
  p_difficulty text, p_deck_ids uuid[], p_card_layout jsonb, p_publish boolean default false
) returns void language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform id from public.guides where id = p_guide_id and user_id = auth.uid() for update;
  if not found then raise exception 'Guide not found or not owned'; end if;
  if coalesce(cardinality(p_deck_ids), 0) = 0 then raise exception 'Choose at least one deck'; end if;
  if (select count(*) from public.recipes where id = any(p_deck_ids) and user_id = auth.uid()) <> cardinality(p_deck_ids) then
    raise exception 'You can only add your own decks';
  end if;
  if p_card_layout is not null then
    if jsonb_typeof(p_card_layout) <> 'array' then raise exception 'Invalid card layout'; end if;
    if exists (
      select 1 from jsonb_array_elements(p_card_layout) c
      where not coalesce((c->>'deckId')::uuid = any(p_deck_ids), false)
         or not coalesce((c->>'groupId')::uuid = any(p_deck_ids), false)
         or jsonb_typeof(c->'hidden') is distinct from 'boolean'
         or not coalesce(c->>'cardId' = 'cover' or exists (
           select 1 from public.recipe_steps s where s.id::text = c->>'cardId' and s.recipe_id::text = c->>'deckId'
         ), false)
    ) then raise exception 'Invalid card reference'; end if;
    if exists (select 1 from jsonb_array_elements(p_card_layout) c group by c->>'deckId', c->>'cardId' having count(*) > 1) then
      raise exception 'Duplicate card reference';
    end if;
  end if;
  update public.guides set title = p_title, description = p_description, image_url = p_image,
    difficulty = p_difficulty, card_layout = coalesce(p_card_layout, card_layout)
    where id = p_guide_id and user_id = auth.uid();
  delete from public.guide_decks where guide_id = p_guide_id and user_id = auth.uid();
  insert into public.guide_decks (guide_id, recipe_id, user_id, position)
    select p_guide_id, id, auth.uid(), ordinality - 1 from unnest(p_deck_ids) with ordinality as d(id, ordinality);
  if p_publish then
    update public.recipes set is_public = true where id = any(p_deck_ids) and user_id = auth.uid();
  end if;
end;
$$;
revoke all on function public.save_guide_layout(uuid, text, text, text, text, uuid[], jsonb, boolean) from public;
grant execute on function public.save_guide_layout(uuid, text, text, text, text, uuid[], jsonb, boolean) to authenticated;
