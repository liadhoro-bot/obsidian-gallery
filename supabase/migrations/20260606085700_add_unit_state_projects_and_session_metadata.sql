alter table public.units
  add column if not exists is_featured boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'unit_status'
      and n.nspname = 'public'
  ) then
    create type public.unit_status as enum (
      'complete',
      'active',
      'bench',
      'pile',
      'other'
    );
  end if;
end
$$;

alter table public.units
  add column if not exists status public.unit_status not null default 'active';

create table if not exists public.unit_projects (
  unit_id uuid not null references public.units(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (unit_id, project_id)
);

insert into public.unit_projects (unit_id, project_id, user_id)
select u.id, u.project_id, u.user_id
from public.units u
where u.project_id is not null
  and u.user_id is not null
on conflict (unit_id, project_id) do nothing;

alter table public.unit_projects enable row level security;

drop policy if exists "Users can select their unit projects" on public.unit_projects;
create policy "Users can select their unit projects"
on public.unit_projects
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their unit projects" on public.unit_projects;
create policy "Users can insert their unit projects"
on public.unit_projects
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their unit projects" on public.unit_projects;
create policy "Users can delete their unit projects"
on public.unit_projects
for delete
using (auth.uid() = user_id);

create index if not exists units_user_id_is_featured_true_idx
on public.units (user_id, is_featured)
where is_featured = true;

create index if not exists units_user_id_status_idx
on public.units (user_id, status);

create index if not exists unit_projects_user_id_idx
on public.unit_projects (user_id);

create index if not exists unit_projects_project_id_idx
on public.unit_projects (project_id);

create index if not exists unit_projects_unit_id_idx
on public.unit_projects (unit_id);

create or replace function public.set_featured_unit(p_unit_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  select u.user_id
  into v_user_id
  from public.units u
  where u.id = p_unit_id;

  if v_user_id is null then
    raise exception 'Unit % was not found or has no owner', p_unit_id;
  end if;

  if auth.uid() <> v_user_id then
    raise exception 'Not allowed to feature this unit';
  end if;

  update public.units
  set is_featured = false
  where user_id = v_user_id
    and is_featured = true;

  update public.units
  set is_featured = true
  where id = p_unit_id
    and user_id = v_user_id;
end;
$$;

alter function public.set_featured_unit(uuid) owner to postgres;
revoke execute on function public.set_featured_unit(uuid) from public;
grant execute on function public.set_featured_unit(uuid) to authenticated;

alter table public.unit_sessions
  add column if not exists entry_source text not null default 'timer',
  add column if not exists notes text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'unit_sessions_ended_at_after_started_at_check'
      and conrelid = 'public.unit_sessions'::regclass
  ) then
    alter table public.unit_sessions
      add constraint unit_sessions_ended_at_after_started_at_check
      check (ended_at is null or ended_at > started_at);
  end if;
end
$$;
