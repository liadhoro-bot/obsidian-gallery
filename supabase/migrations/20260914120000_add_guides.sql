create table if not exists public.guides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  is_auto boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.guide_decks (
  guide_id uuid not null references public.guides(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (guide_id, recipe_id)
);

alter table public.recipes
  add column if not exists auto_guide_id uuid references public.guides(id);

create index if not exists guides_user_id_idx
  on public.guides (user_id);

create index if not exists guide_decks_user_id_idx
  on public.guide_decks (user_id);

create index if not exists guide_decks_recipe_id_idx
  on public.guide_decks (recipe_id);

create index if not exists recipes_auto_guide_id_idx
  on public.recipes (auto_guide_id);

-- backfill: one auto-guide per currently-public recipe that doesn't have one yet
do $$
declare
  r record;
  gid uuid;
begin
  for r in
    select id, user_id, name
    from public.recipes
    where is_public = true
      and auto_guide_id is null
  loop
    insert into public.guides (user_id, title, is_auto)
    values (r.user_id, r.name, true)
    returning id into gid;

    insert into public.guide_decks (guide_id, recipe_id, user_id, position)
    values (gid, r.id, r.user_id, 0)
    on conflict (guide_id, recipe_id) do nothing;

    update public.recipes set auto_guide_id = gid where id = r.id;
  end loop;
end
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_guides_updated_at on public.guides;
create trigger set_guides_updated_at
before update on public.guides
for each row execute function public.set_updated_at();

create or replace function public.ensure_guide_for_public_recipe()
returns trigger
language plpgsql
as $$
declare
  gid uuid;
begin
  if new.is_public = true and new.auto_guide_id is null then
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

drop trigger if exists recipes_ensure_guide on public.recipes;
create trigger recipes_ensure_guide
after insert or update of is_public on public.recipes
for each row execute function public.ensure_guide_for_public_recipe();

alter table public.guides enable row level security;

drop policy if exists "Users can select own or public guides" on public.guides;
create policy "Users can select own or public guides"
on public.guides
for select
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.guide_decks gd
    join public.recipes r on r.id = gd.recipe_id
    where gd.guide_id = guides.id
      and r.is_public = true
  )
);

drop policy if exists "Users can insert their own guides" on public.guides;
create policy "Users can insert their own guides"
on public.guides
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own guides" on public.guides;
create policy "Users can update their own guides"
on public.guides
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own guides" on public.guides;
create policy "Users can delete their own guides"
on public.guides
for delete
using (auth.uid() = user_id);

alter table public.guide_decks enable row level security;

drop policy if exists "Users can select own or public guide_decks" on public.guide_decks;
create policy "Users can select own or public guide_decks"
on public.guide_decks
for select
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.recipes r
    where r.id = guide_decks.recipe_id
      and r.is_public = true
  )
);

drop policy if exists "Users can insert their own guide_decks" on public.guide_decks;
create policy "Users can insert their own guide_decks"
on public.guide_decks
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own guide_decks" on public.guide_decks;
create policy "Users can delete their own guide_decks"
on public.guide_decks
for delete
using (auth.uid() = user_id);
