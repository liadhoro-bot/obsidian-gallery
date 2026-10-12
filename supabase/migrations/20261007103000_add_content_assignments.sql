create table if not exists public.content_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('project', 'unit')),
  project_id uuid references public.projects(id) on delete cascade,
  unit_id uuid references public.units(id) on delete cascade,
  content_type text not null check (content_type in ('guide', 'deck')),
  guide_id uuid references public.guides(id) on delete cascade,
  recipe_id uuid references public.recipes(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint content_assignments_target_check check (
    (target_type = 'project' and project_id is not null and unit_id is null)
    or (target_type = 'unit' and unit_id is not null and project_id is null)
  ),
  constraint content_assignments_content_check check (
    (content_type = 'guide' and guide_id is not null and recipe_id is null)
    or (content_type = 'deck' and recipe_id is not null and guide_id is null)
  )
);

create unique index if not exists content_assignments_project_guide_unique
  on public.content_assignments (user_id, project_id, guide_id)
  where target_type = 'project' and content_type = 'guide';
create unique index if not exists content_assignments_project_deck_unique
  on public.content_assignments (user_id, project_id, recipe_id)
  where target_type = 'project' and content_type = 'deck';
create unique index if not exists content_assignments_unit_guide_unique
  on public.content_assignments (user_id, unit_id, guide_id)
  where target_type = 'unit' and content_type = 'guide';
create unique index if not exists content_assignments_unit_deck_unique
  on public.content_assignments (user_id, unit_id, recipe_id)
  where target_type = 'unit' and content_type = 'deck';

alter table public.content_assignments enable row level security;

create policy "Users manage their own content assignments"
on public.content_assignments
for all
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and (
    (target_type = 'project' and exists (
      select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()
    ))
    or (target_type = 'unit' and exists (
      select 1 from public.units u where u.id = unit_id and u.user_id = auth.uid()
    ))
  )
);

grant select, insert, update, delete on public.content_assignments to authenticated;
