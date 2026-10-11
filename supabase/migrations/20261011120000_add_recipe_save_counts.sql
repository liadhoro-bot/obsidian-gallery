-- RLS on saved_recipes only lets a user read their own rows, so counting
-- saves from the client returned 0 or 1 (just the viewer's own save).
-- Expose aggregate totals without revealing who saved what, and only for
-- decks the caller can already see: public ones or their own.
create or replace function public.recipe_save_counts(recipe_ids uuid[])
returns table (recipe_id uuid, save_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select sr.recipe_id, count(*)::bigint as save_count
  from public.saved_recipes sr
  join public.recipes r on r.id = sr.recipe_id
  where sr.recipe_id = any(recipe_ids)
    and (r.is_public = true or r.user_id = auth.uid())
  group by sr.recipe_id;
$$;

revoke all on function public.recipe_save_counts(uuid[]) from public;
grant execute on function public.recipe_save_counts(uuid[]) to anon, authenticated;
