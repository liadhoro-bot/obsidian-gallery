-- Discover reads nine prepared summaries, never recipe_steps/recipe_step_paints.
-- Summaries change with content/social writes, not with page visits.
begin;
create extension if not exists pg_trgm with schema extensions;

create table public.guide_discover_summaries (
  guide_id uuid primary key references public.guides(id) on delete cascade,
  owner_id uuid not null,
  title text not null,
  subtitle text not null,
  thumbnail_url text,
  difficulty text not null,
  tags text[] not null default '{}',
  tag_keys text[] not null default '{}',
  search_text text not null,
  creator_username text,
  creator_avatar text,
  social_recipe_id uuid not null,
  like_count bigint not null default 0,
  save_count bigint not null default 0,
  popularity bigint generated always as (like_count + save_count) stored,
  created_at timestamptz not null
);
create index guide_discover_created_idx on public.guide_discover_summaries(created_at desc, guide_id desc);
create index guide_discover_title_idx on public.guide_discover_summaries(lower(title), guide_id);
create index guide_discover_popularity_idx on public.guide_discover_summaries(popularity desc, guide_id desc);
create index guide_discover_tags_idx on public.guide_discover_summaries using gin(tag_keys);
do $$ declare extension_schema text; begin
  select n.nspname into extension_schema from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pg_trgm';
  execute format('create index guide_discover_search_idx on public.guide_discover_summaries using gin(search_text %I.gin_trgm_ops)',extension_schema);
end $$;
create index guide_discover_social_idx on public.guide_discover_summaries(social_recipe_id);
create index guide_discover_owner_idx on public.guide_discover_summaries(owner_id);
create index if not exists discover_recipe_likes_recipe_idx on public.recipe_likes(recipe_id);
create index if not exists discover_saved_recipes_recipe_idx on public.saved_recipes(recipe_id);
create index if not exists discover_images_entity_created_idx on public.image_assets(entity_type, entity_id, created_at desc);
create index if not exists discover_steps_recipe_idx on public.recipe_steps(recipe_id);

alter table public.guide_discover_summaries enable row level security;
create policy "Authenticated readers see public Discover summaries"
on public.guide_discover_summaries for select to authenticated using (true);
revoke all on public.guide_discover_summaries from anon, authenticated;
grant select on public.guide_discover_summaries to authenticated;
grant all on public.guide_discover_summaries to service_role;

create function public.refresh_discover_guide(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  g public.guides%rowtype;
  r public.recipes%rowtype;
  first_image text;
  canonical_tags text[];
  level_name text;
  card_count bigint;
begin
  -- Serialize refreshes of the same guide (including simultaneous social writes).
  perform pg_advisory_xact_lock(hashtextextended('discover-guide:' || p_id::text, 0));
  select * into g from public.guides where id = p_id;
  if not found or g.visibility <> 'public' or not exists (
    select 1 from public.guide_decks gd join public.recipes d on d.id = gd.recipe_id
    where gd.guide_id = p_id and d.is_public = true
  ) or (g.is_auto and exists (
    select 1 from public.guide_decks own_deck
    join public.guide_decks parent_deck on parent_deck.recipe_id = own_deck.recipe_id
    join public.guides parent on parent.id = parent_deck.guide_id
    where own_deck.guide_id = p_id and parent.id <> p_id and parent.is_auto = false
  )) then
    delete from public.guide_discover_summaries where guide_id = p_id;
    return;
  end if;

  -- Social identity follows the pinned member, falling back to position order.
  -- Only public members may provide the public thumbnail/description.
  select d.* into r from public.guide_decks gd join public.recipes d on d.id = gd.recipe_id
  where gd.guide_id = p_id and d.is_public = true
  order by (gd.recipe_id = g.primary_recipe_id) desc nulls last, gd.position, gd.recipe_id limit 1;
  select coalesce(nullif(d.image_url, ''), (
    select a.image_url from public.image_assets a where a.entity_type = 'recipe' and a.entity_id = d.id
    order by a.created_at desc limit 1
  )) into first_image from public.guide_decks gd join public.recipes d on d.id = gd.recipe_id
  where gd.guide_id = p_id and d.is_public = true order by gd.position, gd.recipe_id limit 1;

  select count(*) into card_count from public.recipe_steps s
  join public.guide_decks gd on gd.recipe_id = s.recipe_id
  join public.recipes d on d.id = gd.recipe_id
  where gd.guide_id = p_id and d.is_public = true;
  level_name := case when g.difficulty in ('Beginner','Intermediate','Advanced') then g.difficulty
    when card_count >= 12 then 'Advanced' when card_count >= 6 then 'Intermediate' else 'Beginner' end;
  select coalesce(array_agg(distinct coalesce(t.name, btrim(raw.tag))), '{}') into canonical_tags
  from unnest(coalesce(g.tags, '{}')) raw(tag)
  left join lateral (
    select name from public.tag_directory td
    where lower(td.name) = lower(btrim(raw.tag)) or exists (
      select 1 from unnest(td.aliases) alias where lower(alias) = lower(btrim(raw.tag))
    ) order by td.sort_order, td.name limit 1
  ) t on true where btrim(raw.tag) <> '';

  insert into public.guide_discover_summaries (
    guide_id,owner_id,title,subtitle,thumbnail_url,difficulty,tags,tag_keys,search_text,
    creator_username,creator_avatar,social_recipe_id,like_count,save_count,created_at
  ) select g.id,g.user_id,coalesce(nullif(btrim(g.title),''),r.name || ' Guide','Untitled Guide'),
    coalesce(nullif(btrim(g.description),''),nullif(btrim(r.description),''),'A public painting guide.'),
    coalesce(nullif(g.image_url,''),first_image),level_name,canonical_tags,
    array(select distinct lower(t) from unnest(canonical_tags || array[level_name]) t),
    lower(concat_ws(' ',g.title,g.description,r.name,r.description,level_name,array_to_string(canonical_tags,' '))),
    p.username,p.avatar_url,r.id,
    (select count(*) from public.recipe_likes where recipe_id = r.id),
    (select count(*) from public.saved_recipes where recipe_id = r.id),g.created_at
  from (select 1) seed left join public.profiles p on p.id = g.user_id
  on conflict (guide_id) do update set
    owner_id=excluded.owner_id,title=excluded.title,subtitle=excluded.subtitle,thumbnail_url=excluded.thumbnail_url,
    difficulty=excluded.difficulty,tags=excluded.tags,tag_keys=excluded.tag_keys,search_text=excluded.search_text,
    creator_username=excluded.creator_username,creator_avatar=excluded.creator_avatar,
    social_recipe_id=excluded.social_recipe_id,like_count=excluded.like_count,save_count=excluded.save_count,created_at=excluded.created_at;
end $$;

create function public.refresh_discover_recipe(p_recipe uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare gid uuid;
begin
  for gid in select guide_id from (
    select guide_id from public.guide_decks where recipe_id = p_recipe
    union select guide_id from public.guide_discover_summaries where social_recipe_id = p_recipe
  ) affected order by guide_id loop perform public.refresh_discover_guide(gid); end loop;
end $$;

create function public.sync_discover_summary() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare rid uuid; gid uuid;
begin
  if tg_table_name = 'guides' then
    if tg_op <> 'DELETE' then
      perform public.refresh_discover_guide(new.id);
      for rid in select recipe_id from public.guide_decks where guide_id = new.id order by recipe_id
        loop perform public.refresh_discover_recipe(rid); end loop;
    end if;
  elsif tg_table_name = 'guide_decks' then
    if tg_op <> 'INSERT' then
      perform public.refresh_discover_guide(old.guide_id);
      perform public.refresh_discover_recipe(old.recipe_id);
    end if;
    if tg_op <> 'DELETE' then
      perform public.refresh_discover_guide(new.guide_id);
      perform public.refresh_discover_recipe(new.recipe_id);
    end if;
  elsif tg_table_name = 'profiles' then
    update public.guide_discover_summaries set creator_username=new.username,creator_avatar=new.avatar_url where owner_id=new.id;
  elsif tg_table_name = 'tag_directory' then
    for gid in select id from public.guides where visibility='public' order by id
      loop perform public.refresh_discover_guide(gid); end loop;
  elsif tg_table_name = 'image_assets' then
    if tg_op <> 'INSERT' and old.entity_type='recipe' then perform public.refresh_discover_recipe(old.entity_id); end if;
    if tg_op <> 'DELETE' and new.entity_type='recipe' then perform public.refresh_discover_recipe(new.entity_id); end if;
  else
    if tg_table_name = 'recipes' then
      if tg_op <> 'INSERT' then perform public.refresh_discover_recipe(old.id); end if;
      if tg_op <> 'DELETE' then perform public.refresh_discover_recipe(new.id); end if;
    else
      if tg_op <> 'INSERT' then perform public.refresh_discover_recipe(old.recipe_id); end if;
      if tg_op <> 'DELETE' then perform public.refresh_discover_recipe(new.recipe_id); end if;
    end if;
  end if;
  return null;
end $$;

create trigger zz_discover_guide after insert or update of title,description,image_url,difficulty,tags,is_auto,primary_recipe_id,visibility on public.guides for each row execute function public.sync_discover_summary();
create trigger zz_discover_members after insert or update or delete on public.guide_decks for each row execute function public.sync_discover_summary();
create trigger zz_discover_recipe after insert or update of name,description,image_url,is_public on public.recipes for each row execute function public.sync_discover_summary();
create trigger zz_discover_likes after insert or update or delete on public.recipe_likes for each row execute function public.sync_discover_summary();
create trigger zz_discover_saves after insert or update or delete on public.saved_recipes for each row execute function public.sync_discover_summary();
create trigger zz_discover_steps after insert or update of recipe_id or delete on public.recipe_steps for each row execute function public.sync_discover_summary();
create trigger zz_discover_images after insert or update of image_url,entity_id,entity_type or delete on public.image_assets for each row execute function public.sync_discover_summary();
create trigger zz_discover_profile after update of username,avatar_url on public.profiles for each row execute function public.sync_discover_summary();
create trigger zz_discover_tag_directory after insert or update or delete on public.tag_directory for each statement execute function public.sync_discover_summary();

-- Internal maintenance functions are executable only by their owner/triggers.
revoke all on function public.refresh_discover_guide(uuid), public.refresh_discover_recipe(uuid), public.sync_discover_summary() from public, anon, authenticated;

-- The query compiler supplies OR groups within a tag category, AND across them.
create function public.discover_guides_page(
  p_search text default '', p_sort text default 'new-old', p_offset integer default 0, p_groups jsonb default '[]'
) returns jsonb language plpgsql stable security invoker set search_path = public, pg_temp as $$
declare result jsonb; ordering text; pattern text;
begin
  if p_offset < 0 or p_offset > 100000 or length(p_search) > 200 or jsonb_typeof(p_groups) <> 'array' or jsonb_array_length(p_groups) > 20 then
    raise exception 'Invalid Discover query' using errcode = '22023';
  end if;
  ordering := case p_sort when 'name-asc' then 'lower(s.title) asc, s.guide_id asc'
    when 'name-desc' then 'lower(s.title) desc, s.guide_id desc'
    when 'popularity' then 's.popularity desc, s.guide_id desc'
    when 'old-new' then 's.created_at asc, s.guide_id asc'
    else 's.created_at desc, s.guide_id desc' end;
  pattern := '%' || replace(replace(replace(lower(btrim(p_search)), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%';
  execute format($query$
    with candidates as materialized (
      select s.* from public.guide_discover_summaries s
      where ($1 = '%%' or s.search_text like $1)
      and not exists (select 1 from jsonb_array_elements($2) grp
        where not (s.tag_keys && array(select lower(value) from jsonb_array_elements_text(grp))))
      order by %s limit 10 offset $3
    ), page as (select s.* from candidates s order by %s limit 9)
    select jsonb_build_object('hasMore',(select count(*) > 9 from candidates),'guides',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',s.guide_id,'owner_id',s.owner_id,'title',s.title,'subtitle',s.subtitle,'thumbnail_url',s.thumbnail_url,
        'difficulty',s.difficulty,'tags',s.tags,'creator_username',s.creator_username,'creator_avatar',s.creator_avatar,
        'social_recipe_id',s.social_recipe_id,'like_count',s.like_count,'save_count',s.save_count,'created_at',s.created_at,
        'viewer_has_liked',exists(select 1 from public.recipe_likes l where l.recipe_id=s.social_recipe_id and l.user_id=auth.uid()),
        'viewer_has_saved',exists(select 1 from public.saved_recipes b where b.recipe_id=s.social_recipe_id and b.user_id=auth.uid())
      ) order by %s) from page s),'[]'::jsonb))
  $query$,ordering,ordering,ordering) into result using pattern,p_groups,p_offset;
  return result;
end $$;
revoke all on function public.discover_guides_page(text,text,integer,jsonb) from public,anon;
grant execute on function public.discover_guides_page(text,text,integer,jsonb) to authenticated,service_role;

-- Facets are requested when Tags is opened, not with the first nine guides.
create function public.discover_guide_facets(p_search text default '', p_groups jsonb default '[]')
returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
  with searched as materialized (
    select tag_keys from public.guide_discover_summaries
    where search_text like '%' || replace(replace(replace(lower(left(btrim(p_search),200)), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%'
  ), counts as (
    select key,count(*) n from searched,unnest(tag_keys) key group by key
  ) select jsonb_build_object('counts',coalesce((select jsonb_object_agg(key,n) from counts),'{}'::jsonb),
    'total',(select count(*) from searched s where not exists (
      select 1 from jsonb_array_elements(p_groups) grp
      where not (s.tag_keys && array(select lower(value) from jsonb_array_elements_text(grp)))
    )));
$$;
revoke all on function public.discover_guide_facets(text,jsonb) from public,anon;
grant execute on function public.discover_guide_facets(text,jsonb) to authenticated,service_role;

do $$ declare gid uuid; begin
  for gid in select id from public.guides where visibility='public' order by id
    loop perform public.refresh_discover_guide(gid); end loop;
end $$;
analyze public.guide_discover_summaries;
notify pgrst, 'reload schema';
commit;
