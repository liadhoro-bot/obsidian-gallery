create or replace function public.can_manage_contest(p_contest_id uuid)
returns boolean
language sql
security definer
set search_path = public, auth
stable
as $$
  select public.current_user_is_global_admin()
    or exists (
      select 1 from public.contests
      where id = p_contest_id
        and created_by = auth.uid()
    )
    or exists (
      select 1 from public.contest_organizers
      where contest_id = p_contest_id
        and user_id = auth.uid()
        and role in ('owner', 'admin')
    )
$$;

create or replace function public.can_moderate_contest(p_contest_id uuid)
returns boolean
language sql
security definer
set search_path = public, auth
stable
as $$
  select public.current_user_is_global_admin()
    or exists (
      select 1 from public.contests
      where id = p_contest_id
        and created_by = auth.uid()
    )
    or exists (
      select 1 from public.contest_organizers
      where contest_id = p_contest_id
        and user_id = auth.uid()
        and role in ('owner', 'admin', 'moderator')
    )
$$;

insert into public.contest_organizers (contest_id, user_id, role)
select id, created_by, 'owner'
from public.contests
where created_by is not null
on conflict (contest_id, user_id) do nothing;
