create or replace function public.contest_is_visible_to_user(p_contest_id uuid)
returns boolean
language sql
security definer
set search_path = public, auth
stable
as $$
  select exists (
    select 1
    from public.contests c
    where c.id = p_contest_id
      and (
        (c.publication_status = 'published' and c.visibility in ('public', 'unlisted'))
        or (
          c.publication_status = 'published'
          and c.visibility = 'private'
          and c.voter_access_mode = 'public_authenticated'
          and auth.uid() is not null
        )
        or public.current_user_is_global_admin()
        or exists (
          select 1 from public.contest_voter_allowlist av
          where av.contest_id = c.id and av.user_id = auth.uid()
        )
        or exists (
          select 1 from public.contest_nominations n
          where n.contest_id = c.id and n.owner_user_id = auth.uid() and n.status = 'approved'
        )
      )
  )
$$;
