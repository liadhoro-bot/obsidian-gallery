-- Run against Frankfurt inside this rollback-only transaction.
begin;
do $$
declare uid uuid; rid uuid; gid uuid; n bigint; result jsonb; alias_name text := '__discover_perf_alias__';
begin
  select id into strict uid from auth.users where email='perf-benchmark@obsidian.gallery';
  insert into public.recipes(user_id,name,is_public) values(uid,'__Discover regression recipe__',false) returning id into rid;
  insert into public.guides(user_id,title,description,visibility,is_auto,difficulty,tags)
    values(uid,'__Discover %_ regression__','Summary fixture','private',false,'Beginner',array[alias_name]) returning id into gid;
  insert into public.guide_decks(guide_id,recipe_id,user_id,position) values(gid,rid,uid,0);
  if exists(select 1 from public.guide_discover_summaries where guide_id=gid) then raise exception 'Private guide leaked'; end if;
  update public.recipes set is_public=true where id=rid;
  update public.guides set visibility='public' where id=gid;
  if not exists(select 1 from public.guide_discover_summaries where guide_id=gid and social_recipe_id=rid) then raise exception 'Publish did not update summary'; end if;
  if exists(select 1 from public.guide_discover_summaries s join public.guides g on g.id=s.guide_id
    join public.guide_decks gd on gd.guide_id=g.id where g.is_auto and gd.recipe_id=rid) then raise exception 'Nested auto-guide leaked'; end if;
  insert into public.recipe_likes(user_id,recipe_id) values(uid,rid);
  insert into public.saved_recipes(user_id,recipe_id) values(uid,rid);
  select popularity into n from public.guide_discover_summaries where guide_id=gid;
  if n<>2 then raise exception 'Social counts did not increment: %',n; end if;
  delete from public.recipe_likes where user_id=uid and recipe_id=rid;
  delete from public.saved_recipes where user_id=uid and recipe_id=rid;
  select popularity into n from public.guide_discover_summaries where guide_id=gid;
  if n<>0 then raise exception 'Social counts did not decrement'; end if;
  insert into public.tag_directory(name,category,aliases,sort_order)
    values('__Discover canonical__','subject',array[alias_name],9999);
  if not exists(select 1 from public.guide_discover_summaries where guide_id=gid and '__discover canonical__'=any(tag_keys)) then raise exception 'Alias did not reindex'; end if;
  result := public.discover_guides_page('%_','new-old',0,'[]');
  if not exists(select 1 from jsonb_array_elements(result->'guides') g where g->>'id'=gid::text) then raise exception 'Literal wildcard search failed'; end if;
  update public.guides set title='__Discover renamed__',image_url='/fixture-thumb.png',primary_recipe_id=rid where id=gid;
  if not exists(select 1 from public.guide_discover_summaries where guide_id=gid and title='__Discover renamed__' and thumbnail_url='/fixture-thumb.png') then raise exception 'Metadata did not reindex'; end if;
  update public.guides set visibility='private' where id=gid;
  if exists(select 1 from public.guide_discover_summaries where guide_id=gid) then raise exception 'Unpublish retained summary'; end if;
  update public.guides set visibility='public' where id=gid;
  delete from public.guides where id=gid;
  if exists(select 1 from public.guide_discover_summaries where guide_id=gid) then raise exception 'Delete retained summary'; end if;
end $$;
-- Verify the public RPC is usable with a real authenticated role and scoped flags.
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='perf-benchmark@obsidian.gallery'),true);
set local role authenticated;
do $$ declare result jsonb; begin
  result := public.discover_guides_page();
  if jsonb_array_length(result->'guides')<>9 then raise exception 'Authenticated pagination failed'; end if;
  if not ((result->'guides'->0) ? 'viewer_has_saved') then raise exception 'Viewer flags missing'; end if;
end $$;
rollback;
