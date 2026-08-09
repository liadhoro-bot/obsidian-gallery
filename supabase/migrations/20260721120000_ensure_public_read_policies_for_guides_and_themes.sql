drop policy if exists "Public recipes are readable" on public.recipes;
create policy "Public recipes are readable"
on public.recipes
for select
using (is_public = true);

drop policy if exists "Public recipe steps are readable" on public.recipe_steps;
create policy "Public recipe steps are readable"
on public.recipe_steps
for select
using (
  exists (
    select 1
    from public.recipes r
    where r.id = recipe_steps.recipe_id
      and r.is_public = true
  )
);

drop policy if exists "Public recipe step paints are readable" on public.recipe_step_paints;
create policy "Public recipe step paints are readable"
on public.recipe_step_paints
for select
using (
  exists (
    select 1
    from public.recipe_steps rs
    join public.recipes r on r.id = rs.recipe_id
    where rs.id = recipe_step_paints.recipe_step_id
      and r.is_public = true
  )
);

drop policy if exists "Public themes are readable" on public.themes;
create policy "Public themes are readable"
on public.themes
for select
using (is_public = true);

drop policy if exists "Public theme paints are readable" on public.theme_paints;
create policy "Public theme paints are readable"
on public.theme_paints
for select
using (
  exists (
    select 1
    from public.themes t
    where t.id = theme_paints.theme_id
      and t.is_public = true
  )
);

drop policy if exists "Public recipe and theme images are readable" on public.image_assets;
create policy "Public recipe and theme images are readable"
on public.image_assets
for select
using (
  (
    entity_type = 'recipe'
    and exists (
      select 1
      from public.recipes r
      where r.id::text = image_assets.entity_id::text
        and r.is_public = true
    )
  )
  or (
    entity_type = 'theme'
    and exists (
      select 1
      from public.themes t
      where t.id::text = image_assets.entity_id::text
        and t.is_public = true
    )
  )
);
