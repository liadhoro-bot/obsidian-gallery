create table if not exists public.campaign_dice_rolls (
  id uuid primary key default gen_random_uuid(),
  player_name text not null,
  player_key text not null,
  die_one integer not null check (die_one between 1 and 6),
  die_two integer not null check (die_two between 1 and 6),
  total integer not null check (total between 2 and 12),
  ip_address text,
  user_agent text,
  email_sent boolean not null default false,
  email_attempted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint campaign_dice_rolls_total_matches_dice check (total = die_one + die_two)
);

alter table public.campaign_dice_rolls enable row level security;

alter table public.campaign_dice_rolls
add column if not exists roll_reason text;

alter table public.campaign_dice_rolls
add column if not exists reason_key text;

update public.campaign_dice_rolls
set
  roll_reason = coalesce(nullif(roll_reason, ''), 'Unspecified roll'),
  reason_key = coalesce(nullif(reason_key, ''), 'unspecified roll')
where roll_reason is null
  or roll_reason = ''
  or reason_key is null
  or reason_key = '';

alter table public.campaign_dice_rolls
alter column roll_reason set not null;

alter table public.campaign_dice_rolls
alter column reason_key set not null;

alter table public.campaign_dice_rolls
drop constraint if exists campaign_dice_rolls_one_roll_per_player;

create unique index if not exists campaign_dice_rolls_one_roll_per_reason_idx
on public.campaign_dice_rolls (player_key, reason_key);

create index if not exists campaign_dice_rolls_created_at_idx
on public.campaign_dice_rolls (created_at desc);

create or replace function public.record_campaign_dice_roll(
  p_player_name text,
  p_roll_reason text,
  p_ip_address text default null,
  p_user_agent text default null
)
returns table (
  id uuid,
  player_name text,
  roll_reason text,
  die_one integer,
  die_two integer,
  total integer,
  created_at timestamptz,
  duplicate boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_name text := regexp_replace(btrim(coalesce(p_player_name, '')), '\s+', ' ', 'g');
  v_roll_reason text := regexp_replace(btrim(coalesce(p_roll_reason, '')), '\s+', ' ', 'g');
  v_player_key text := lower(regexp_replace(btrim(coalesce(p_player_name, '')), '\s+', ' ', 'g'));
  v_reason_key text := lower(regexp_replace(btrim(coalesce(p_roll_reason, '')), '\s+', ' ', 'g'));
  v_die_one integer;
  v_die_two integer;
  v_roll public.campaign_dice_rolls%rowtype;
begin
  if length(v_player_name) < 2 or length(v_player_name) > 80 then
    raise exception 'invalid_player_name';
  end if;

  if length(v_roll_reason) < 3 or length(v_roll_reason) > 160 then
    raise exception 'invalid_roll_reason';
  end if;

  select *
  into v_roll
  from public.campaign_dice_rolls cdr
  where cdr.player_key = v_player_key
    and cdr.reason_key = v_reason_key
  limit 1;

  if found then
    return query
    select
      v_roll.id,
      v_roll.player_name,
      v_roll.roll_reason,
      v_roll.die_one,
      v_roll.die_two,
      v_roll.total,
      v_roll.created_at,
      true;
    return;
  end if;

  v_die_one := floor(random() * 6)::integer + 1;
  v_die_two := floor(random() * 6)::integer + 1;

  insert into public.campaign_dice_rolls (
    player_name,
    player_key,
    roll_reason,
    reason_key,
    die_one,
    die_two,
    total,
    ip_address,
    user_agent
  )
  values (
    v_player_name,
    v_player_key,
    v_roll_reason,
    v_reason_key,
    v_die_one,
    v_die_two,
    v_die_one + v_die_two,
    p_ip_address,
    p_user_agent
  )
  on conflict (player_key, reason_key) do nothing
  returning *
  into v_roll;

  if not found then
    select *
    into v_roll
    from public.campaign_dice_rolls cdr
    where cdr.player_key = v_player_key
      and cdr.reason_key = v_reason_key
    limit 1;

    return query
    select
      v_roll.id,
      v_roll.player_name,
      v_roll.roll_reason,
      v_roll.die_one,
      v_roll.die_two,
      v_roll.total,
      v_roll.created_at,
      true;
    return;
  end if;

  return query
  select
    v_roll.id,
    v_roll.player_name,
    v_roll.roll_reason,
    v_roll.die_one,
    v_roll.die_two,
    v_roll.total,
    v_roll.created_at,
    false;
end;
$$;

create or replace function public.mark_campaign_dice_roll_email_attempted(
  p_roll_id uuid,
  p_email_sent boolean
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.campaign_dice_rolls
  set
    email_sent = p_email_sent,
    email_attempted_at = now()
  where id = p_roll_id;
$$;

revoke all on function public.record_campaign_dice_roll(text, text, text, text) from public;
grant execute on function public.record_campaign_dice_roll(text, text, text, text) to anon, authenticated, service_role;

revoke all on function public.mark_campaign_dice_roll_email_attempted(uuid, boolean) from public;
grant execute on function public.mark_campaign_dice_roll_email_attempted(uuid, boolean) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
