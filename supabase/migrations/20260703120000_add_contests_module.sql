create extension if not exists pgcrypto;

create table if not exists public.contests (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  short_description text,
  description text,
  rules_markdown text,
  cover_image_url text,
  created_by uuid not null references auth.users(id) on delete restrict,
  publication_status text not null default 'draft',
  visibility text not null default 'public',
  max_nominations_per_user integer not null default 1,
  requires_nomination_approval boolean not null default true,
  voting_method text not null default 'approval',
  minimum_selections_per_ballot integer not null default 1,
  maximum_selections_per_ballot integer not null default 1,
  require_exact_selection_count boolean not null default false,
  allow_ballot_changes boolean not null default true,
  allow_self_vote boolean not null default false,
  voter_access_mode text not null default 'public_authenticated',
  require_verified_email boolean not null default true,
  minimum_account_age_hours integer not null default 0,
  hide_nominee_identity_during_voting boolean not null default true,
  show_live_results boolean not null default false,
  submissions_open_at timestamptz not null,
  submissions_close_at timestamptz not null,
  voting_open_at timestamptz not null,
  voting_close_at timestamptz not null,
  results_published_at timestamptz,
  published_at timestamptz,
  cancelled_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contests_publication_status_check check (publication_status in ('draft', 'published', 'cancelled', 'archived')),
  constraint contests_visibility_check check (visibility in ('public', 'private', 'unlisted')),
  constraint contests_voting_method_check check (voting_method in ('approval', 'ranked')),
  constraint contests_voter_access_mode_check check (voter_access_mode in ('public_authenticated', 'allowlist', 'nominees_only')),
  constraint contests_schedule_check check (
    submissions_close_at > submissions_open_at
    and voting_open_at >= submissions_close_at
    and voting_close_at > voting_open_at
  ),
  constraint contests_selection_counts_check check (
    minimum_selections_per_ballot >= 1
    and maximum_selections_per_ballot >= minimum_selections_per_ballot
  ),
  constraint contests_ranked_count_check check (
    voting_method <> 'ranked' or maximum_selections_per_ballot > 1
  ),
  constraint contests_account_age_check check (minimum_account_age_hours >= 0),
  constraint contests_nomination_limit_check check (max_nominations_per_user >= 1)
);

create table if not exists public.contest_allowed_nominee_types (
  contest_id uuid not null references public.contests(id) on delete cascade,
  nominee_type text not null,
  created_at timestamptz not null default now(),
  primary key (contest_id, nominee_type),
  constraint contest_allowed_nominee_types_type_check check (nominee_type in ('project', 'unit', 'guide'))
);

create table if not exists public.contest_organizers (
  contest_id uuid not null references public.contests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  primary key (contest_id, user_id),
  constraint contest_organizers_role_check check (role in ('owner', 'admin', 'moderator'))
);

create table if not exists public.contest_nominations (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  submitted_by_user_id uuid not null references auth.users(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  source_type text not null,
  source_project_id uuid null references public.projects(id) on delete set null,
  source_unit_id uuid null references public.units(id) on delete set null,
  source_guide_id uuid null references public.recipes(id) on delete set null,
  snapshot_title text not null,
  snapshot_description text,
  snapshot_image_url text not null,
  snapshot_owner_display_name text,
  snapshot_metadata jsonb not null default '{}',
  status text not null default 'pending',
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  rejection_reason text,
  withdrawn_at timestamptz,
  disqualified_at timestamptz,
  disqualification_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contest_nominations_source_type_check check (source_type in ('project', 'unit', 'guide')),
  constraint contest_nominations_status_check check (status in ('pending', 'approved', 'rejected', 'withdrawn', 'disqualified')),
  constraint contest_nominations_exact_source_check check (
    (source_type = 'project' and source_project_id is not null and source_unit_id is null and source_guide_id is null)
    or (source_type = 'unit' and source_unit_id is not null and source_project_id is null and source_guide_id is null)
    or (source_type = 'guide' and source_guide_id is not null and source_project_id is null and source_unit_id is null)
  )
);

create table if not exists public.contest_voter_allowlist (
  contest_id uuid not null references public.contests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (contest_id, user_id)
);

create table if not exists public.contest_ballots (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  voter_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'submitted',
  submitted_at timestamptz,
  voided_at timestamptz,
  voided_by uuid references auth.users(id) on delete set null,
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contest_id, voter_user_id),
  constraint contest_ballots_status_check check (status in ('draft', 'submitted', 'void'))
);

create table if not exists public.contest_ballot_items (
  id uuid primary key default gen_random_uuid(),
  ballot_id uuid not null references public.contest_ballots(id) on delete cascade,
  nomination_id uuid not null references public.contest_nominations(id) on delete cascade,
  selection_rank integer,
  points_awarded integer not null default 1,
  created_at timestamptz not null default now(),
  unique (ballot_id, nomination_id),
  constraint contest_ballot_items_rank_check check (selection_rank is null or selection_rank >= 1),
  constraint contest_ballot_items_points_check check (points_awarded >= 0)
);

create table if not exists public.contest_results (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  nomination_id uuid not null references public.contest_nominations(id) on delete cascade,
  valid_ballot_count integer not null,
  selection_count integer not null,
  total_points integer not null,
  first_place_count integer not null default 0,
  final_rank integer not null,
  is_tied boolean not null default false,
  calculation_version integer not null default 1,
  calculated_at timestamptz not null default now(),
  unique (contest_id, nomination_id)
);

create table if not exists public.contest_audit_events (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists contests_status_schedule_idx on public.contests (publication_status, submissions_open_at, submissions_close_at, voting_open_at, voting_close_at);
create index if not exists contest_nominations_contest_status_idx on public.contest_nominations (contest_id, status);
create index if not exists contest_nominations_owner_idx on public.contest_nominations (owner_user_id);
create unique index if not exists contest_nominations_unique_project_idx on public.contest_nominations (contest_id, source_project_id) where source_project_id is not null;
create unique index if not exists contest_nominations_unique_unit_idx on public.contest_nominations (contest_id, source_unit_id) where source_unit_id is not null;
create unique index if not exists contest_nominations_unique_guide_idx on public.contest_nominations (contest_id, source_guide_id) where source_guide_id is not null;
create index if not exists contest_ballots_contest_status_idx on public.contest_ballots (contest_id, status);
create index if not exists contest_ballot_items_ballot_idx on public.contest_ballot_items (ballot_id);
create index if not exists contest_ballot_items_nomination_idx on public.contest_ballot_items (nomination_id);
create unique index if not exists contest_ballot_items_rank_idx on public.contest_ballot_items (ballot_id, selection_rank) where selection_rank is not null;
create index if not exists contest_results_rank_idx on public.contest_results (contest_id, final_rank);
create index if not exists contest_voter_allowlist_user_idx on public.contest_voter_allowlist (user_id);
create index if not exists contest_audit_events_contest_created_idx on public.contest_audit_events (contest_id, created_at desc);

create or replace function public.set_contest_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists contests_set_updated_at on public.contests;
create trigger contests_set_updated_at before update on public.contests
for each row execute function public.set_contest_updated_at();

drop trigger if exists contest_nominations_set_updated_at on public.contest_nominations;
create trigger contest_nominations_set_updated_at before update on public.contest_nominations
for each row execute function public.set_contest_updated_at();

drop trigger if exists contest_ballots_set_updated_at on public.contest_ballots;
create trigger contest_ballots_set_updated_at before update on public.contest_ballots
for each row execute function public.set_contest_updated_at();

create or replace function public.contest_effective_phase(
  p_publication_status text,
  p_submissions_open_at timestamptz,
  p_submissions_close_at timestamptz,
  p_voting_open_at timestamptz,
  p_voting_close_at timestamptz,
  p_results_published_at timestamptz,
  p_now timestamptz default now()
)
returns text
language sql
stable
as $$
  select case
    when p_publication_status = 'draft' then 'draft'
    when p_publication_status = 'cancelled' then 'cancelled'
    when p_publication_status = 'archived' then 'archived'
    when p_results_published_at is not null then 'results_published'
    when p_now < p_submissions_open_at then 'upcoming'
    when p_now >= p_submissions_open_at and p_now < p_submissions_close_at then 'submissions_open'
    when p_now >= p_submissions_close_at and p_now < p_voting_open_at then 'moderation'
    when p_now >= p_voting_open_at and p_now < p_voting_close_at then 'voting_open'
    else 'voting_closed'
  end
$$;

create or replace function public.current_user_is_global_admin()
returns boolean
language plpgsql
security definer
set search_path = public, auth
stable
as $$
declare
  v_is_admin boolean := false;
begin
  if auth.uid() is null then
    return false;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_admin'
  ) then
    execute 'select coalesce(is_admin, false) from public.profiles where id = $1'
      into v_is_admin
      using auth.uid();
  end if;

  return coalesce(v_is_admin, false);
end;
$$;

create or replace function public.can_manage_contest(p_contest_id uuid)
returns boolean
language sql
security definer
set search_path = public, auth
stable
as $$
  select public.current_user_is_global_admin()
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
      select 1 from public.contest_organizers
      where contest_id = p_contest_id
        and user_id = auth.uid()
        and role in ('owner', 'admin', 'moderator')
    )
$$;

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
        or public.current_user_is_global_admin()
        or exists (
          select 1 from public.contest_organizers co
          where co.contest_id = c.id and co.user_id = auth.uid()
        )
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
  v_points integer;
  v_is_update boolean := false;
  v_email_confirmed_at timestamptz;
  v_created_at timestamptz;
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

create or replace function public.finalize_contest_results(p_contest_id uuid)
returns table(nomination_id uuid, total_points integer, selection_count integer, first_place_count integer, final_rank integer, is_tied boolean)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_contest public.contests%rowtype;
  v_phase text;
  v_next_version integer;
  v_valid_ballot_count integer;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not public.can_manage_contest(p_contest_id) then
    raise exception 'not_authorized';
  end if;

  select * into v_contest from public.contests where id = p_contest_id for update;
  if not found then
    raise exception 'contest_not_found';
  end if;

  v_phase := public.contest_effective_phase(v_contest.publication_status, v_contest.submissions_open_at, v_contest.submissions_close_at, v_contest.voting_open_at, v_contest.voting_close_at, v_contest.results_published_at, now());
  if v_phase not in ('voting_closed', 'results_published') then
    raise exception 'voting_not_closed';
  end if;

  select coalesce(max(calculation_version), 0) + 1 into v_next_version
  from public.contest_results
  where contest_id = p_contest_id;

  select count(*) into v_valid_ballot_count
  from public.contest_ballots
  where contest_id = p_contest_id and status = 'submitted';

  delete from public.contest_results where contest_id = p_contest_id;

  insert into public.contest_results (
    contest_id,
    nomination_id,
    valid_ballot_count,
    selection_count,
    total_points,
    first_place_count,
    final_rank,
    is_tied,
    calculation_version
  )
  with totals as (
    select
      n.id as nomination_id,
      coalesce(count(i.id), 0)::integer as selection_count,
      coalesce(sum(i.points_awarded), 0)::integer as total_points,
      coalesce(count(i.id) filter (where i.selection_rank = 1), 0)::integer as first_place_count
    from public.contest_nominations n
    left join public.contest_ballot_items i on i.nomination_id = n.id
    left join public.contest_ballots b on b.id = i.ballot_id and b.status = 'submitted'
    where n.contest_id = p_contest_id
      and n.status = 'approved'
      and (i.id is null or b.id is not null)
    group by n.id
  ),
  ranked as (
    select
      *,
      dense_rank() over (order by total_points desc) as final_rank,
      count(*) over (partition by total_points) > 1 as is_tied
    from totals
  )
  select
    p_contest_id,
    nomination_id,
    v_valid_ballot_count,
    selection_count,
    total_points,
    first_place_count,
    final_rank,
    is_tied,
    v_next_version
  from ranked;

  insert into public.contest_audit_events (contest_id, actor_user_id, action, metadata)
  values (p_contest_id, auth.uid(), 'contest_results_finalized', jsonb_build_object('calculation_version', v_next_version));

  return query
  select cr.nomination_id, cr.total_points, cr.selection_count, cr.first_place_count, cr.final_rank, cr.is_tied
  from public.contest_results cr
  where cr.contest_id = p_contest_id
  order by cr.final_rank asc, cr.total_points desc;
end;
$$;

create or replace function public.publish_contest_results(p_contest_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not public.can_manage_contest(p_contest_id) then
    raise exception 'not_authorized';
  end if;

  if not exists (select 1 from public.contest_results where contest_id = p_contest_id) then
    raise exception 'results_not_finalized';
  end if;

  update public.contests
  set results_published_at = coalesce(results_published_at, now())
  where id = p_contest_id;

  insert into public.contest_audit_events (contest_id, actor_user_id, action)
  values (p_contest_id, auth.uid(), 'contest_results_published');
end;
$$;

alter table public.contests enable row level security;
alter table public.contest_allowed_nominee_types enable row level security;
alter table public.contest_organizers enable row level security;
alter table public.contest_nominations enable row level security;
alter table public.contest_voter_allowlist enable row level security;
alter table public.contest_ballots enable row level security;
alter table public.contest_ballot_items enable row level security;
alter table public.contest_results enable row level security;
alter table public.contest_audit_events enable row level security;

create policy "Visible contests are readable" on public.contests
for select using (public.contest_is_visible_to_user(id));

create policy "Global admins can create contests" on public.contests
for insert with check (public.current_user_is_global_admin() and created_by = auth.uid());

create policy "Contest managers can update contests" on public.contests
for update using (public.can_manage_contest(id)) with check (public.can_manage_contest(id));

create policy "Allowed nominee types follow visible contests" on public.contest_allowed_nominee_types
for select using (public.contest_is_visible_to_user(contest_id));

create policy "Managers can mutate allowed nominee types" on public.contest_allowed_nominee_types
for all using (public.can_manage_contest(contest_id)) with check (public.can_manage_contest(contest_id));

create policy "Organizers can read organizer rows" on public.contest_organizers
for select using (public.current_user_is_global_admin() or user_id = auth.uid() or public.can_manage_contest(contest_id));

create policy "Managers can mutate organizer rows" on public.contest_organizers
for all using (public.can_manage_contest(contest_id) or public.current_user_is_global_admin()) with check (public.can_manage_contest(contest_id) or public.current_user_is_global_admin());

create policy "Approved nominations are readable in visible contests" on public.contest_nominations
for select using (
  (status = 'approved' and public.contest_is_visible_to_user(contest_id))
  or owner_user_id = auth.uid()
  or public.can_moderate_contest(contest_id)
);

create policy "Entrants can insert own nominations" on public.contest_nominations
for insert with check (submitted_by_user_id = auth.uid() and owner_user_id = auth.uid());

create policy "Entrants and moderators can update nominations" on public.contest_nominations
for update using (owner_user_id = auth.uid() or public.can_moderate_contest(contest_id))
with check (owner_user_id = auth.uid() or public.can_moderate_contest(contest_id));

create policy "Allowlist readable by user or managers" on public.contest_voter_allowlist
for select using (user_id = auth.uid() or public.can_manage_contest(contest_id));

create policy "Managers can mutate allowlists" on public.contest_voter_allowlist
for all using (public.can_manage_contest(contest_id)) with check (public.can_manage_contest(contest_id));

create policy "Voters can read their own ballots" on public.contest_ballots
for select using (voter_user_id = auth.uid());

create policy "Ballot items readable through own ballot" on public.contest_ballot_items
for select using (
  exists (
    select 1 from public.contest_ballots b
    where b.id = ballot_id and b.voter_user_id = auth.uid()
  )
);

create policy "Results visible after publication or to managers" on public.contest_results
for select using (
  public.can_manage_contest(contest_id)
  or exists (
    select 1 from public.contests c
    where c.id = contest_id and c.results_published_at is not null and public.contest_is_visible_to_user(c.id)
  )
);

create policy "Audit visible to contest managers" on public.contest_audit_events
for select using (public.can_manage_contest(contest_id));

revoke all on public.contest_ballots from anon, authenticated;
revoke all on public.contest_ballot_items from anon, authenticated;
grant select, insert, update on public.contests to authenticated;
grant select, insert, update, delete on public.contest_allowed_nominee_types to authenticated;
grant select, insert, update, delete on public.contest_organizers to authenticated;
grant select, insert, update on public.contest_nominations to authenticated;
grant select, insert, update, delete on public.contest_voter_allowlist to authenticated;
grant select on public.contest_ballots to authenticated;
grant select on public.contest_ballot_items to authenticated;
grant select on public.contest_results to anon, authenticated;
grant select, insert on public.contest_audit_events to authenticated;
grant execute on function public.replace_contest_ballot(uuid, uuid[]) to authenticated;
grant execute on function public.finalize_contest_results(uuid) to authenticated;
grant execute on function public.publish_contest_results(uuid) to authenticated;
