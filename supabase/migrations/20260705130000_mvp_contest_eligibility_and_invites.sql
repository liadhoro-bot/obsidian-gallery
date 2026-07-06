alter table public.contests
add column if not exists minimum_projects_for_voting integer not null default 0,
add column if not exists minimum_units_for_voting integer not null default 0;

alter table public.contests
drop constraint if exists contests_voter_collection_minimums_check;

alter table public.contests
add constraint contests_voter_collection_minimums_check check (
  minimum_projects_for_voting >= 0
  and minimum_units_for_voting >= 0
);

create table if not exists public.contest_invited_participants (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  identifier text not null,
  email text,
  username text,
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending',
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contest_id, identifier),
  constraint contest_invited_participants_status_check check (status in ('pending', 'matched', 'removed'))
);

create index if not exists contest_invited_participants_contest_idx
on public.contest_invited_participants (contest_id, status, created_at desc);

drop trigger if exists contest_invited_participants_set_updated_at on public.contest_invited_participants;
create trigger contest_invited_participants_set_updated_at before update on public.contest_invited_participants
for each row execute function public.set_contest_updated_at();

alter table public.contest_invited_participants enable row level security;

drop policy if exists "Contest managers can manage invited participants" on public.contest_invited_participants;
create policy "Contest managers can manage invited participants" on public.contest_invited_participants
for all using (public.can_manage_contest(contest_id)) with check (public.can_manage_contest(contest_id));

grant select, insert, update, delete on public.contest_invited_participants to authenticated;

create or replace function public.replace_contest_ballot(
  p_contest_id uuid,
  p_nomination_ids uuid[]
)
returns table(ballot_id uuid, selection_count integer, updated boolean)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_contest public.contests%rowtype;
  v_phase text;
  v_ballot_id uuid;
  v_existing_status text;
  v_count integer;
  v_duplicate_count integer;
  v_is_update boolean := false;
  v_email_confirmed_at timestamptz;
  v_created_at timestamptz;
  v_project_count integer := 0;
  v_unit_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  perform pg_advisory_xact_lock(hashtext('contest_ballot:' || p_contest_id::text || ':' || v_user_id::text));

  select * into v_contest
  from public.contests
  where id = p_contest_id
  for update;

  if not found then
    raise exception 'contest_not_found';
  end if;

  v_phase := public.contest_effective_phase(
    v_contest.publication_status,
    v_contest.submissions_open_at,
    v_contest.submissions_close_at,
    v_contest.voting_open_at,
    v_contest.voting_close_at,
    v_contest.results_published_at,
    now()
  );

  if v_phase <> 'voting_open' then
    raise exception 'voting_not_open';
  end if;

  select email_confirmed_at, created_at into v_email_confirmed_at, v_created_at
  from auth.users
  where id = v_user_id;

  if v_contest.require_verified_email and v_email_confirmed_at is null then
    raise exception 'verified_email_required';
  end if;

  if v_contest.minimum_account_age_hours > 0
    and v_created_at > now() - make_interval(hours => v_contest.minimum_account_age_hours) then
    raise exception 'account_too_new';
  end if;

  if v_contest.minimum_projects_for_voting > 0 then
    select count(*) into v_project_count
    from public.projects
    where user_id = v_user_id;

    if v_project_count < v_contest.minimum_projects_for_voting then
      raise exception 'minimum_projects_required';
    end if;
  end if;

  if v_contest.minimum_units_for_voting > 0 then
    select count(*) into v_unit_count
    from public.units
    where user_id = v_user_id;

    if v_unit_count < v_contest.minimum_units_for_voting then
      raise exception 'minimum_units_required';
    end if;
  end if;

  if v_contest.voter_access_mode = 'allowlist'
    and not exists (
      select 1 from public.contest_voter_allowlist
      where contest_id = p_contest_id and user_id = v_user_id
    ) then
    raise exception 'not_on_allowlist';
  end if;

  if v_contest.voter_access_mode = 'nominees_only'
    and not exists (
      select 1 from public.contest_nominations
      where contest_id = p_contest_id and owner_user_id = v_user_id and status = 'approved'
    ) then
    raise exception 'nominees_only';
  end if;

  select count(*) into v_count from unnest(coalesce(p_nomination_ids, array[]::uuid[])) x;
  select count(distinct x) into v_duplicate_count from unnest(coalesce(p_nomination_ids, array[]::uuid[])) x;

  if v_count <> v_duplicate_count then
    raise exception 'duplicate_nominees';
  end if;

  if v_count < v_contest.minimum_selections_per_ballot then
    raise exception 'too_few_selections';
  end if;

  if v_count > v_contest.maximum_selections_per_ballot then
    raise exception 'too_many_selections';
  end if;

  if v_contest.require_exact_selection_count and v_count <> v_contest.maximum_selections_per_ballot then
    raise exception 'exact_selection_count_required';
  end if;

  if exists (
    select 1
    from unnest(p_nomination_ids) selected(id)
    left join public.contest_nominations n
      on n.id = selected.id
      and n.contest_id = p_contest_id
      and n.status = 'approved'
    where n.id is null
  ) then
    raise exception 'invalid_nomination';
  end if;

  if not v_contest.allow_self_vote and exists (
    select 1
    from public.contest_nominations n
    where n.id = any(p_nomination_ids)
      and n.owner_user_id = v_user_id
  ) then
    raise exception 'self_vote_not_allowed';
  end if;

  select id, status into v_ballot_id, v_existing_status
  from public.contest_ballots
  where contest_id = p_contest_id and voter_user_id = v_user_id
  for update;

  if v_ballot_id is not null then
    v_is_update := true;
    if v_existing_status = 'submitted' and not v_contest.allow_ballot_changes then
      raise exception 'ballot_changes_locked';
    end if;

    update public.contest_ballots
    set status = 'submitted', submitted_at = now(), voided_at = null, voided_by = null, void_reason = null
    where id = v_ballot_id;

    delete from public.contest_ballot_items where ballot_id = v_ballot_id;
  else
    insert into public.contest_ballots (contest_id, voter_user_id, status, submitted_at)
    values (p_contest_id, v_user_id, 'submitted', now())
    returning id into v_ballot_id;
  end if;

  insert into public.contest_ballot_items (ballot_id, nomination_id, selection_rank, points_awarded)
  select
    v_ballot_id,
    selected.id,
    case when v_contest.voting_method = 'ranked' then selected.ordinality::integer else null end,
    case
      when v_contest.voting_method = 'ranked'
        then v_contest.maximum_selections_per_ballot - selected.ordinality::integer + 1
      else 1
    end
  from unnest(p_nomination_ids) with ordinality as selected(id, ordinality);

  insert into public.contest_audit_events (contest_id, actor_user_id, action, target_type, target_id, metadata)
  values (
    p_contest_id,
    v_user_id,
    case when v_is_update then 'contest_ballot_updated' else 'contest_ballot_submitted' end,
    'contest_ballot',
    v_ballot_id,
    jsonb_build_object('selection_count', v_count, 'voting_method', v_contest.voting_method)
  );

  return query select v_ballot_id, v_count, v_is_update;
end;
$$;
