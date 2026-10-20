-- Personal folders on Guides > My Guides and Guides > Saved. Private to
-- their owner: nobody else can read or change them.
--
-- guide_folder_items files one guide into one folder per scope. item_key is
-- the Guides page's own key: 'guide:<guides.id>' or 'deck:<recipes.id>'.
-- It has no foreign key to guides/recipes on purpose: deleting a folder
-- cascades only to these filing rows, never to the guides themselves, and a
-- deleted guide's leftover row is simply ignored by the page.

create table if not exists public.guide_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  scope text not null check (scope in ('mine', 'saved')),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists guide_folders_user_scope_idx
  on public.guide_folders (user_id, scope, position, created_at);

create table if not exists public.guide_folder_items (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  scope text not null check (scope in ('mine', 'saved')),
  item_key text not null check (item_key ~ '^(guide|deck):[0-9a-f-]{36}$'),
  folder_id uuid not null references public.guide_folders (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, scope, item_key)
);

create index if not exists guide_folder_items_folder_idx
  on public.guide_folder_items (folder_id);

alter table public.guide_folders enable row level security;
alter table public.guide_folder_items enable row level security;

drop policy if exists "guide_folders_owner_all" on public.guide_folders;
create policy "guide_folders_owner_all"
on public.guide_folders
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- A guide can only be filed into the viewer's own folder of the same scope.
drop policy if exists "guide_folder_items_owner_all" on public.guide_folder_items;
create policy "guide_folder_items_owner_all"
on public.guide_folder_items
for all
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.guide_folders f
    where f.id = folder_id
      and f.user_id = auth.uid()
      and f.scope = guide_folder_items.scope
  )
);

grant select, insert, update, delete on public.guide_folders to authenticated;
grant select, insert, update, delete on public.guide_folder_items to authenticated;
